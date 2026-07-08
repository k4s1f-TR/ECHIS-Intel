import type { AirTrackContact, AirTrackSource } from "@/types/airtrack";
import { lookupTypeName, lookupWatchlist } from "@/lib/airtrack/staticDb";

// adsb.lol — community ADS-B network, open data (ODbL 1.0), no API key.
// Two feeds are consumed here, both in the ADS-B Exchange v2 schema:
//   /v2/mil                     — every military-flagged aircraft, worldwide
//   /v2/point/{lat}/{lon}/{nm}  — all traffic (civil + military) within a
//                                 radius; the regional fast lane that lets
//                                 the viewport refresh far quicker than the
//                                 credit-bound OpenSky global frame
// airplanes.live serves as a drop-in failover for both: when adsb.lol
// errors out, the same request is retried there before giving up.
// (airplanes.live is non-commercial-friendly; it stays a backup only, per
// docs/AIR-TRACK-PROVIDERS.md §5.)
const V2_UPSTREAMS: Array<{ base: string; source: AirTrackSource }> = [
  { base: "https://api.adsb.lol", source: "adsblol" },
  { base: "https://api.airplanes.live", source: "airplaneslive" },
];
const UPSTREAM_TIMEOUT_MS = 15_000;
// dbFlags bit 0 marks aircraft the network's database flags as military.
const DBFLAGS_MILITARY = 1;

// Positions older than this are dropped — a five-minute-old fix on a fast
// mover is hundreds of km stale and reads as misinformation on the globe.
const MAX_POSITION_AGE_SEC = 300;

type V2Aircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  dbFlags?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  emergency?: string;
  lat?: number;
  lon?: number;
  seen_pos?: number;
};

const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

type V2Response = {
  ac?: V2Aircraft[];
  total?: number;
};

function cleanString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type AdsbLolMilResult = {
  contacts: AirTrackContact[];
  upstreamTotal: number;
  source: AirTrackSource;
};

async function fetchV2Frame(
  path: string,
): Promise<{ body: V2Response; source: AirTrackSource }> {
  let lastError: unknown = null;
  for (const upstream of V2_UPSTREAMS) {
    try {
      const response = await fetch(`${upstream.base}${path}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`${upstream.base}${path} responded ${response.status}`);
      }
      return {
        body: (await response.json()) as V2Response,
        source: upstream.source,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All v2 upstreams failed.");
}

function normalizeV2Aircraft(
  ac: V2Aircraft,
  source: AirTrackSource,
  fetchTime: number,
  // /v2/mil implies military by construction; /v2/point derives it from
  // the per-aircraft dbFlags bit.
  forceMilitary: boolean,
): AirTrackContact | null {
  const hex = cleanString(ac.hex);
  if (!hex) return null;
  if (!Number.isFinite(ac.lat) || !Number.isFinite(ac.lon)) return null;
  const positionAgeSec = Number.isFinite(ac.seen_pos)
    ? (ac.seen_pos as number)
    : Number.POSITIVE_INFINITY;
  if (positionAgeSec > MAX_POSITION_AGE_SEC) return null;

  const onGround = ac.alt_baro === "ground";
  const icao24 = hex.toLowerCase();
  const typeCode = cleanString(ac.t);
  const squawk = cleanString(ac.squawk);
  const watchlistHit = lookupWatchlist(icao24);
  return {
    icao24,
    callsign: cleanString(ac.flight),
    registration: cleanString(ac.r),
    typeCode,
    // Watchlist rows carry curated names ("CASA C-295M"); the generic
    // type-code map covers the rest of the fleet.
    typeName: watchlistHit?.typeName ?? lookupTypeName(typeCode),
    operator: watchlistHit?.operator ?? null,
    watchlist: watchlistHit
      ? { category: watchlistHit.category, priority: watchlistHit.priority }
      : null,
    emergency:
      (squawk !== null && EMERGENCY_SQUAWKS.has(squawk)) ||
      (typeof ac.emergency === "string" &&
        ac.emergency !== "none" &&
        ac.emergency !== ""),
    lat: ac.lat as number,
    lon: ac.lon as number,
    altitudeFt:
      typeof ac.alt_baro === "number" && Number.isFinite(ac.alt_baro)
        ? Math.round(ac.alt_baro)
        : null,
    onGround,
    groundSpeedKt: Number.isFinite(ac.gs) ? Math.round(ac.gs as number) : null,
    track: Number.isFinite(ac.track) ? (ac.track as number) : null,
    verticalRateFpm: Number.isFinite(ac.baro_rate)
      ? (ac.baro_rate as number)
      : Number.isFinite(ac.geom_rate)
        ? (ac.geom_rate as number)
        : null,
    squawk,
    military:
      forceMilitary || ((ac.dbFlags ?? 0) & DBFLAGS_MILITARY) === DBFLAGS_MILITARY,
    source,
    positionAgeSec:
      positionAgeSec === Number.POSITIVE_INFINITY
        ? MAX_POSITION_AGE_SEC
        : Math.round(positionAgeSec * 10) / 10,
    posTimestamp:
      fetchTime -
      (positionAgeSec === Number.POSITIVE_INFINITY ? 0 : positionAgeSec * 1000),
  };
}

function normalizeV2Frame(
  body: V2Response,
  source: AirTrackSource,
  forceMilitary: boolean,
): AdsbLolMilResult {
  const aircraft = Array.isArray(body.ac) ? body.ac : [];
  const fetchTime = Date.now();
  const contacts: AirTrackContact[] = [];
  for (const ac of aircraft) {
    const contact = normalizeV2Aircraft(ac, source, fetchTime, forceMilitary);
    if (contact) contacts.push(contact);
  }
  return {
    contacts,
    upstreamTotal: typeof body.total === "number" ? body.total : aircraft.length,
    source,
  };
}

export async function fetchAdsbLolMilContacts(): Promise<AdsbLolMilResult> {
  const { body, source } = await fetchV2Frame("/v2/mil");
  return normalizeV2Frame(body, source, true);
}

/** Regional fast lane — all traffic within `radiusNm` of a point (max 250). */
export async function fetchAdsbLolPointContacts(
  lat: number,
  lon: number,
  radiusNm: number,
): Promise<AdsbLolMilResult> {
  const { body, source } = await fetchV2Frame(
    `/v2/point/${lat.toFixed(2)}/${lon.toFixed(2)}/${Math.round(radiusNm)}`,
  );
  return normalizeV2Frame(body, source, false);
}
