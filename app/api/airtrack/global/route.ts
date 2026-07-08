import { NextResponse } from "next/server";
import {
  fetchOpenSkyGlobalContacts,
  OpenSkyRateLimitError,
} from "@/lib/airtrack/openskyAdapter";
import type { AirTrackFeedPayload } from "@/types/airtrack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache TTL: 90 seconds.  The client polls every 95 seconds, so the worst
// case is ~909 upstream frames per day = ~3,636 OpenSky credits — safely
// inside the registered-account budget of 4,000/day, independent of how many
// clients are connected (one upstream frame serves everyone).
const GLOBAL_CACHE_TTL_MS = 90_000;
// Floor between sequential outbound requests — a burst of racing clients
// can never drain credits faster than the cadence budget assumes.
const GLOBAL_MIN_REQUEST_INTERVAL_MS = 30_000;
// Backoff applied on HTTP 429 when OpenSky does not advertise one.
const RATE_LIMIT_DEFAULT_BACKOFF_MS = 300_000;

let globalCache: { payload: AirTrackFeedPayload; fetchedAt: number } | null =
  null;
let globalInFlight: Promise<AirTrackFeedPayload> | null = null;
let lastGlobalAttemptAt = 0;
// While rate-limited, serve stale frames without touching upstream.
let rateLimitedUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGlobalWithCooldown(): Promise<AirTrackFeedPayload> {
  const elapsed = Date.now() - lastGlobalAttemptAt;
  if (elapsed < GLOBAL_MIN_REQUEST_INTERVAL_MS) {
    await sleep(GLOBAL_MIN_REQUEST_INTERVAL_MS - elapsed);
  }

  lastGlobalAttemptAt = Date.now();
  const { contacts, upstreamTotal } = await fetchOpenSkyGlobalContacts();
  const payload: AirTrackFeedPayload = {
    contacts,
    upstreamTotal,
    collectedAt: new Date().toISOString(),
    cacheStatus: "fresh",
    source: "opensky",
  };
  globalCache = { payload, fetchedAt: Date.now() };
  return payload;
}

export async function GET() {
  const cached = globalCache;
  const now = Date.now();
  if (cached && now - cached.fetchedAt < GLOBAL_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }
  if (now < rateLimitedUntil) {
    if (cached) {
      return NextResponse.json({
        ...cached.payload,
        cacheStatus: "stale" as const,
      });
    }
    return NextResponse.json(
      { error: "OpenSky rate limit reached; retrying later." },
      { status: 503 },
    );
  }

  if (globalInFlight) {
    try {
      const payload = await globalInFlight;
      return NextResponse.json(payload);
    } catch {
      // Fall through to a fresh attempt below.
    }
  }

  const attempt = fetchGlobalWithCooldown();
  globalInFlight = attempt;
  try {
    const payload = await attempt;
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof OpenSkyRateLimitError) {
      rateLimitedUntil =
        Date.now() +
        (error.retryAfterSec !== null
          ? error.retryAfterSec * 1000
          : RATE_LIMIT_DEFAULT_BACKOFF_MS);
    }
    // Serve the last good frame as stale rather than blanking the layer.
    if (cached) {
      return NextResponse.json({
        ...cached.payload,
        cacheStatus: "stale" as const,
      });
    }
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    if (globalInFlight === attempt) globalInFlight = null;
  }
}
