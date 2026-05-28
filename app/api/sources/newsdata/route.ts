import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchNewsdataArticles } from "@/lib/sources/newsdataAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEWSDATA_SOURCE_ID = "newsdata-geopolitical";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type NewsdataRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchNewsdataArticles>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

let newsdataCache: { payload: NewsdataRoutePayload; fetchedAt: number } | null = null;
let newsdataInFlight: Promise<NewsdataRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === NEWSDATA_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "newsdata_source_not_configured" },
      { status: 500 },
    );
  }

  try {
    if (newsdataCache && Date.now() - newsdataCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...newsdataCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (newsdataInFlight) {
      const payload = await newsdataInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    newsdataInFlight = (async (): Promise<NewsdataRoutePayload> => {
      const items = await fetchNewsdataArticles(source);
      const payload: NewsdataRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        cacheStatus: "fresh",
      };
      newsdataCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await newsdataInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "newsdata_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message === "timeout") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      }
    }

    if (newsdataCache) {
      return NextResponse.json(
        { ...newsdataCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      { sourceId: source.id, error: reason, reason },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    newsdataInFlight = null;
  }
}
