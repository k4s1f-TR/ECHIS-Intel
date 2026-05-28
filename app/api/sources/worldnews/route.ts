import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchWorldNewsArticles } from "@/lib/sources/worldnewsAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORLDNEWS_SOURCE_ID = "worldnews-geopolitical";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type WorldNewsRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchWorldNewsArticles>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

let worldnewsCache: { payload: WorldNewsRoutePayload; fetchedAt: number } | null = null;
let worldnewsInFlight: Promise<WorldNewsRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === WORLDNEWS_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "worldnews_source_not_configured" },
      { status: 500 },
    );
  }

  try {
    if (worldnewsCache && Date.now() - worldnewsCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...worldnewsCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (worldnewsInFlight) {
      const payload = await worldnewsInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    worldnewsInFlight = (async (): Promise<WorldNewsRoutePayload> => {
      const items = await fetchWorldNewsArticles(source);
      const payload: WorldNewsRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        cacheStatus: "fresh",
      };
      worldnewsCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await worldnewsInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "worldnews_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message === "timeout") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      }
    }

    if (worldnewsCache) {
      return NextResponse.json(
        { ...worldnewsCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      { sourceId: source.id, error: reason, reason },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    worldnewsInFlight = null;
  }
}
