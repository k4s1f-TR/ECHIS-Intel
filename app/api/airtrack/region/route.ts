import { NextResponse } from "next/server";
import { fetchAdsbLolPointContacts } from "@/lib/airtrack/adsblolAdapter";
import type { AirTrackFeedPayload } from "@/types/airtrack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Regional fast lane — adsb.lol /v2/point around the operator's viewport.
// The client polls every 10 s while zoomed in; the query center is rounded
// to 0.5° so tiny camera drifts share one cache entry (and one upstream
// request across every viewer of the same area).
const REGION_RADIUS_NM = 250;
const REGION_CACHE_TTL_MS = 8_000;
const REGION_CACHE_MAX_ENTRIES = 32;
// adsb.lol rate limits are in the ~1 req/sec class; keep a global floor
// between outbound calls even when several distinct regions are watched.
const REGION_MIN_REQUEST_INTERVAL_MS = 1_100;

const regionCache = new Map<
  string,
  { payload: AirTrackFeedPayload; fetchedAt: number }
>();
const regionInFlight = new Map<string, Promise<AirTrackFeedPayload>>();
let lastRegionAttemptAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

async function fetchRegionWithCooldown(
  lat: number,
  lon: number,
  cacheKey: string,
): Promise<AirTrackFeedPayload> {
  const elapsed = Date.now() - lastRegionAttemptAt;
  if (elapsed < REGION_MIN_REQUEST_INTERVAL_MS) {
    await sleep(REGION_MIN_REQUEST_INTERVAL_MS - elapsed);
  }

  lastRegionAttemptAt = Date.now();
  const { contacts, upstreamTotal, source } = await fetchAdsbLolPointContacts(
    lat,
    lon,
    REGION_RADIUS_NM,
  );
  const payload: AirTrackFeedPayload = {
    contacts,
    upstreamTotal,
    collectedAt: new Date().toISOString(),
    cacheStatus: "fresh",
    source,
  };
  regionCache.set(cacheKey, { payload, fetchedAt: Date.now() });
  // FIFO eviction — Map iteration order is insertion order.
  while (regionCache.size > REGION_CACHE_MAX_ENTRIES) {
    const oldest = regionCache.keys().next().value;
    if (oldest === undefined) break;
    regionCache.delete(oldest);
  }
  return payload;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latRaw = Number.parseFloat(params.get("lat") ?? "");
  const lonRaw = Number.parseFloat(params.get("lon") ?? "");
  if (!Number.isFinite(latRaw) || !Number.isFinite(lonRaw)) {
    return NextResponse.json({ error: "lat and lon are required." }, { status: 400 });
  }
  const lat = roundHalf(Math.max(-85, Math.min(85, latRaw)));
  const lon = roundHalf(((lonRaw + 540) % 360) - 180);
  const cacheKey = `${lat},${lon}`;

  const cached = regionCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < REGION_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  let attempt = regionInFlight.get(cacheKey);
  if (!attempt) {
    attempt = fetchRegionWithCooldown(lat, lon, cacheKey);
    regionInFlight.set(cacheKey, attempt);
  }
  try {
    const payload = await attempt;
    return NextResponse.json(payload);
  } catch (error) {
    // Serve the last good frame as stale rather than dropping the layer;
    // the global layers still cover the area at their own cadence.
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
    if (regionInFlight.get(cacheKey) === attempt) {
      regionInFlight.delete(cacheKey);
    }
  }
}
