import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchFinlightArticles } from "@/lib/sources/finlightAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINLIGHT_SOURCE_ID = "finlight-geopolitical";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type FinlightRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchFinlightArticles>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

let finlightCache: { payload: FinlightRoutePayload; fetchedAt: number } | null = null;
let finlightInFlight: Promise<FinlightRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === FINLIGHT_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "finlight_source_not_configured" },
      { status: 500 },
    );
  }

  if (!process.env.FINLIGHT_API_KEY) {
    return NextResponse.json(
      { error: "finlight_key_not_configured" },
      { status: 500 },
    );
  }

  try {
    if (finlightCache && Date.now() - finlightCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...finlightCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (finlightInFlight) {
      const payload = await finlightInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    finlightInFlight = (async (): Promise<FinlightRoutePayload> => {
      const items = await fetchFinlightArticles(source);
      const payload: FinlightRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        cacheStatus: "fresh",
      };
      finlightCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await finlightInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "finlight_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message === "timeout") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      }
    }

    if (finlightCache) {
      return NextResponse.json(
        { ...finlightCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      { sourceId: source.id, error: reason, reason },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    finlightInFlight = null;
  }
}
