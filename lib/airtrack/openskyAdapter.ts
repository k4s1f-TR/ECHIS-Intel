import type { AirTrackContact } from "@/types/airtrack";
import { lookupWatchlist } from "@/lib/airtrack/staticDb";

// OpenSky Network — the only free API with a true global civil snapshot
// (/states/all).  Auth is OAuth2 client-credentials (basic auth was retired
// in March 2026); the token lives ~30 minutes and is cached at module level
// so one token serves every proxy request until shortly before expiry.
// Credits are per account (registered: 4,000/day, global frame = 4 credits),
// which is why this adapter must only ever be called through the cached
// /api/airtrack/global route — never per client.
const OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_TIMEOUT_MS = 15_000;
// A global frame is a multi-MB payload; give it more room than the token call.
const STATES_TIMEOUT_MS = 30_000;
// Renew the token a minute before OpenSky expires it so a request never
// races the expiry boundary.
const TOKEN_RENEW_MARGIN_MS = 60_000;

// Positions older than this are dropped — same freshness rule as the
// military layer (adsblolAdapter).
const MAX_POSITION_AGE_SEC = 300;

const METERS_TO_FEET = 3.28084;
const MPS_TO_KNOTS = 1.94384;
const MPS_TO_FPM = 196.85;

const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

// /states/all rows are positional arrays:
// [0] icao24 · [1] callsign · [2] origin_country · [3] time_position ·
// [4] last_contact · [5] lon · [6] lat · [7] baro_altitude (m) ·
// [8] on_ground · [9] velocity (m/s) · [10] true_track ·
// [11] vertical_rate (m/s) · [12] sensors · [13] geo_altitude ·
// [14] squawk · [15] spi · [16] position_source
type OpenSkyStateVector = Array<string | number | boolean | null>;

type OpenSkyStatesResponse = {
  time?: number;
  states?: OpenSkyStateVector[] | null;
};

/** Raised on HTTP 429 so the route can honor the advertised backoff. */
export class OpenSkyRateLimitError extends Error {
  readonly retryAfterSec: number | null;

  constructor(retryAfterSec: number | null) {
    super("OpenSky rate limit exhausted (429).");
    this.name = "OpenSkyRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAt - TOKEN_RENEW_MARGIN_MS) {
    return tokenCache.token;
  }

  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "OpenSky credentials missing — set OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET in .env.local.",
    );
  }

  const response = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OpenSky token endpoint responded ${response.status}`);
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new Error("OpenSky token response did not include an access token.");
  }
  const ttlSec =
    typeof body.expires_in === "number" && body.expires_in > 0
      ? body.expires_in
      : 1800;
  tokenCache = { token: body.access_token, expiresAt: now + ttlSec * 1000 };
  return body.access_token;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function requestStates(): Promise<Response> {
  const token = await getAccessToken();
  return fetch(OPENSKY_STATES_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(STATES_TIMEOUT_MS),
  });
}

export type OpenSkyGlobalResult = {
  contacts: AirTrackContact[];
  upstreamTotal: number;
};

export async function fetchOpenSkyGlobalContacts(): Promise<OpenSkyGlobalResult> {
  let response = await requestStates();
  if (response.status === 401) {
    // Token invalidated server-side before its advertised expiry — refresh
    // once and retry.
    tokenCache = null;
    response = await requestStates();
  }
  if (response.status === 429) {
    const retryHeader = response.headers.get("x-rate-limit-retry-after-seconds");
    const retryAfterSec = retryHeader ? Number.parseInt(retryHeader, 10) : NaN;
    throw new OpenSkyRateLimitError(
      Number.isFinite(retryAfterSec) ? retryAfterSec : null,
    );
  }
  if (!response.ok) {
    throw new Error(`OpenSky /states/all responded ${response.status}`);
  }

  const body = (await response.json()) as OpenSkyStatesResponse;
  const frameTime = asFiniteNumber(body.time) ?? Math.floor(Date.now() / 1000);
  const states = Array.isArray(body.states) ? body.states : [];

  const contacts: AirTrackContact[] = [];
  for (const state of states) {
    const icao24 = asString(state[0])?.toLowerCase();
    if (!icao24) continue;
    const lon = asFiniteNumber(state[5]);
    const lat = asFiniteNumber(state[6]);
    if (lon === null || lat === null) continue;
    const timePosition = asFiniteNumber(state[3]);
    const positionAgeSec =
      timePosition !== null
        ? Math.max(0, frameTime - timePosition)
        : Number.POSITIVE_INFINITY;
    if (positionAgeSec > MAX_POSITION_AGE_SEC) continue;

    const baroAltitudeM = asFiniteNumber(state[7]);
    const velocityMps = asFiniteNumber(state[9]);
    const track = asFiniteNumber(state[10]);
    const verticalRateMps = asFiniteNumber(state[11]);
    const squawk = asString(state[14]);
    const watchlistHit = lookupWatchlist(icao24);

    contacts.push({
      icao24,
      callsign: asString(state[1]),
      // OpenSky state vectors carry no registration or type designator —
      // those stay null unless the watchlist row provides curated values.
      registration: null,
      typeCode: null,
      typeName: watchlistHit?.typeName ?? null,
      operator: watchlistHit?.operator ?? null,
      watchlist: watchlistHit
        ? { category: watchlistHit.category, priority: watchlistHit.priority }
        : null,
      emergency: squawk !== null && EMERGENCY_SQUAWKS.has(squawk),
      lat,
      lon,
      altitudeFt:
        baroAltitudeM !== null ? Math.round(baroAltitudeM * METERS_TO_FEET) : null,
      onGround: state[8] === true,
      groundSpeedKt:
        velocityMps !== null ? Math.round(velocityMps * MPS_TO_KNOTS) : null,
      track,
      verticalRateFpm:
        verticalRateMps !== null ? Math.round(verticalRateMps * MPS_TO_FPM) : null,
      squawk,
      military: false,
      source: "opensky",
      positionAgeSec:
        positionAgeSec === Number.POSITIVE_INFINITY
          ? MAX_POSITION_AGE_SEC
          : Math.round(positionAgeSec * 10) / 10,
      // OpenSky reports the fix time directly; fall back to the frame time.
      posTimestamp: (timePosition ?? frameTime) * 1000,
    });
  }

  return { contacts, upstreamTotal: states.length };
}
