import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchFreeNewsArticles } from "@/lib/sources/freenewsAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREENEWS_SOURCE_ID = "freenews-geopolitical";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type FreeNewsRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchFreeNewsArticles>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

let freenewsCache: { payload: FreeNewsRoutePayload; fetchedAt: number } | null = null;
let freenewsInFlight: Promise<FreeNewsRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === FREENEWS_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "freenews_source_not_configured" },
      { status: 500 },
    );
  }

  if (!process.env.FREENEWSAPI_KEY) {
    return NextResponse.json(
      { error: "freenews_key_not_configured" },
      { status: 500 },
    );
  }

  try {
    if (freenewsCache && Date.now() - freenewsCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...freenewsCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (freenewsInFlight) {
      const payload = await freenewsInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    freenewsInFlight = (async (): Promise<FreeNewsRoutePayload> => {
      const items = await fetchFreeNewsArticles(source);
      const payload: FreeNewsRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        cacheStatus: "fresh",
      };
      freenewsCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await freenewsInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "freenews_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message === "timeout") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      }
    }

    if (freenewsCache) {
      return NextResponse.json(
        { ...freenewsCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      { sourceId: source.id, error: reason, reason },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    freenewsInFlight = null;
  }
}
