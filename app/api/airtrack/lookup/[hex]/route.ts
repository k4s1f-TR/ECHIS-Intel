import { NextResponse } from "next/server";
import { fetchAirTrackLookup } from "@/lib/airtrack/lookupAdapter";
import type { AirTrackLookupPayload } from "@/types/airtrack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Registry data, routes and photos change on the order of days; five minutes
// keeps repeat clicks on the same aircraft free while an operator works a
// contact.  The cache is capped so a long session browsing thousands of
// contacts cannot grow it unbounded.
const LOOKUP_CACHE_TTL_MS = 5 * 60_000;
const LOOKUP_CACHE_MAX_ENTRIES = 500;

const lookupCache = new Map<
  string,
  { payload: AirTrackLookupPayload; fetchedAt: number }
>();
const lookupInFlight = new Map<string, Promise<AirTrackLookupPayload>>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hex: string }> },
) {
  const { hex } = await params;
  if (!hex || hex.length > 12) {
    return NextResponse.json({ error: "Invalid hex." }, { status: 400 });
  }
  const callsign = new URL(request.url).searchParams.get("callsign");
  const cacheKey = `${hex.toLowerCase()}|${callsign?.toUpperCase() ?? ""}`;

  const cached = lookupCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < LOOKUP_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  let attempt = lookupInFlight.get(cacheKey);
  if (!attempt) {
    attempt = fetchAirTrackLookup(hex, callsign);
    lookupInFlight.set(cacheKey, attempt);
  }
  try {
    const payload = await attempt;
    lookupCache.set(cacheKey, { payload, fetchedAt: Date.now() });
    // FIFO eviction — Map iteration order is insertion order.
    while (lookupCache.size > LOOKUP_CACHE_MAX_ENTRIES) {
      const oldest = lookupCache.keys().next().value;
      if (oldest === undefined) break;
      lookupCache.delete(oldest);
    }
    return NextResponse.json(payload);
  } catch (error) {
    if (cached) return NextResponse.json(cached.payload);
    const message =
      error instanceof Error ? error.message : "Lookup failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    if (lookupInFlight.get(cacheKey) === attempt) {
      lookupInFlight.delete(cacheKey);
    }
  }
}
