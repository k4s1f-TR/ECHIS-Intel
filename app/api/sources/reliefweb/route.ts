import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchReliefWebReports } from "@/lib/sources/reliefwebAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELIEFWEB_SOURCE_ID = "reliefweb-crises";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type ReliefWebRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchReliefWebReports>>;
  collectedAt: string;
  previewOnly: true;
  cacheStatus?: "fresh" | "stale";
};

let reliefwebCache: { payload: ReliefWebRoutePayload; fetchedAt: number } | null = null;
let reliefwebInFlight: Promise<ReliefWebRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === RELIEFWEB_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "reliefweb_source_not_configured" },
      { status: 500 },
    );
  }

  try {
    if (reliefwebCache && Date.now() - reliefwebCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...reliefwebCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (reliefwebInFlight) {
      const payload = await reliefwebInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    reliefwebInFlight = (async (): Promise<ReliefWebRoutePayload> => {
      const items = await fetchReliefWebReports(source);
      const payload: ReliefWebRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        previewOnly: true,
        cacheStatus: "fresh",
      };
      reliefwebCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await reliefwebInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "reliefweb_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        // Include full detail (e.g. upstream_403: You are not using an approved appname)
        reason = err.message;
      }
    }

    if (reliefwebCache) {
      return NextResponse.json(
        { ...reliefwebCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      {
        sourceId: source.id,
        error: reason,
        reason,
      },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    reliefwebInFlight = null;
  }
}
