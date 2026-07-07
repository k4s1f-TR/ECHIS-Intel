import type { AirTrackContact } from "@/types/airtrack";

// adsb.lol — community ADS-B network, open data (ODbL 1.0), no API key.
// /v2/mil returns every aircraft the network currently flags as military
// (dbFlags bit 1), worldwide.  Response schema follows the ADS-B Exchange
// v2 convention, so this adapter also works for airplanes.live / adsb.fi
// by swapping the base URL if a failover is ever needed.
const ADSBLOL_MIL_URL = "https://api.adsb.lol/v2/mil";
const UPSTREAM_TIMEOUT_MS = 15_000;

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
  lat?: number;
  lon?: number;
  seen_pos?: number;
};

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
};

export async function fetchAdsbLolMilContacts(): Promise<AdsbLolMilResult> {
  const response = await fetch(ADSBLOL_MIL_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`adsb.lol /v2/mil responded ${response.status}`);
  }

  const body = (await response.json()) as V2Response;
  const aircraft = Array.isArray(body.ac) ? body.ac : [];

  const contacts: AirTrackContact[] = [];
  for (const ac of aircraft) {
    const hex = cleanString(ac.hex);
    if (!hex) continue;
    if (!Number.isFinite(ac.lat) || !Number.isFinite(ac.lon)) continue;
    const positionAgeSec = Number.isFinite(ac.seen_pos)
      ? (ac.seen_pos as number)
      : Number.POSITIVE_INFINITY;
    if (positionAgeSec > MAX_POSITION_AGE_SEC) continue;

    const onGround = ac.alt_baro === "ground";
    contacts.push({
      icao24: hex.toLowerCase(),
      callsign: cleanString(ac.flight),
      registration: cleanString(ac.r),
      typeCode: cleanString(ac.t),
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
      squawk: cleanString(ac.squawk),
      military: true,
      source: "adsblol",
      positionAgeSec: Math.round(positionAgeSec * 10) / 10,
    });
  }

  return {
    contacts,
    upstreamTotal: typeof body.total === "number" ? body.total : aircraft.length,
  };
}
