import { NextResponse } from "next/server";
import { fetchAdsbLolMilContacts } from "@/lib/airtrack/adsblolAdapter";
import type { AirTrackFeedPayload } from "@/types/airtrack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache TTL: 8 seconds.  The Air Track screen polls every 10 seconds, so a
// slightly shorter TTL guarantees each client tick gets a fresh upstream
// frame while burst reloads / multiple open tabs are absorbed by the cache —
// the whole user base costs adsb.lol at most ~6 requests per minute, still
// an order of magnitude under its ~1 req/sec rate-limit class.
const MIL_CACHE_TTL_MS = 8_000;
// Floor between sequential outbound requests.  adsb.lol's rate limits are
// dynamic (~1 req/sec class); a 5-second floor keeps ECHIS a polite client
// even if the cache is bypassed by racing requests.
const MIL_MIN_REQUEST_INTERVAL_MS = 5_000;

let milCache: { payload: AirTrackFeedPayload; fetchedAt: number } | null = null;
let milInFlight: Promise<AirTrackFeedPayload> | null = null;
let lastMilAttemptAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMilWithCooldown(): Promise<AirTrackFeedPayload> {
  const elapsed = Date.now() - lastMilAttemptAt;
  if (elapsed < MIL_MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIL_MIN_REQUEST_INTERVAL_MS - elapsed);
  }

  lastMilAttemptAt = Date.now();
  const { contacts, upstreamTotal, source } = await fetchAdsbLolMilContacts();
  const payload: AirTrackFeedPayload = {
    contacts,
    upstreamTotal,
    collectedAt: new Date().toISOString(),
    cacheStatus: "fresh",
    source,
  };
  milCache = { payload, fetchedAt: Date.now() };
  return payload;
}

export async function GET() {
  const cached = milCache;
  if (cached && Date.now() - cached.fetchedAt < MIL_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  if (milInFlight) {
    try {
      const payload = await milInFlight;
      return NextResponse.json(payload);
    } catch {
      // Fall through to a fresh attempt below.
    }
  }

  const attempt = fetchMilWithCooldown();
  milInFlight = attempt;
  try {
    const payload = await attempt;
    return NextResponse.json(payload);
  } catch (error) {
    // Serve the last good frame as stale rather than blanking the globe.
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
    if (milInFlight === attempt) milInFlight = null;
  }
}
