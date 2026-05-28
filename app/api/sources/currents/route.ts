import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchCurrentsArticles } from "@/lib/sources/currentsAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENTS_SOURCE_ID = "currents-geopolitical";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CurrentsRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchCurrentsArticles>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

let currentsCache: { payload: CurrentsRoutePayload; fetchedAt: number } | null = null;
let currentsInFlight: Promise<CurrentsRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === CURRENTS_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "currents_source_not_configured" },
      { status: 500 },
    );
  }

  try {
    if (currentsCache && Date.now() - currentsCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...currentsCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (currentsInFlight) {
      const payload = await currentsInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    currentsInFlight = (async (): Promise<CurrentsRoutePayload> => {
      const items = await fetchCurrentsArticles(source);
      const payload: CurrentsRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        cacheStatus: "fresh",
      };
      currentsCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await currentsInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "currents_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message === "timeout") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      }
    }

    if (currentsCache) {
      return NextResponse.json(
        { ...currentsCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      { sourceId: source.id, error: reason, reason },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    currentsInFlight = null;
  }
}
