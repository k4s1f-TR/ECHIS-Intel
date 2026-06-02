import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchGdeltArticles } from "@/lib/sources/gdeltAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GDELT_SOURCE_ID = "gdelt-geopolitical";
// Cache TTL: 5 minutes.  GDELT is updated every 15 minutes so there is no
// value in fetching more often than that; a 5-minute server-side cache
// absorbs burst reloads without burning the API quota.
const GDELT_CACHE_TTL_MS = 5 * 60 * 1000;
// Minimum gap between sequential outbound GDELT requests.  GDELT currently
// enforces a 5-second request floor for this endpoint, so keep a small buffer
// above that to avoid burst clicks or automatic refreshes tripping 429s.
const GDELT_MIN_REQUEST_INTERVAL_MS = 5_500;

type GdeltRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchGdeltArticles>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

let gdeltCache: { timespan: string; payload: GdeltRoutePayload; fetchedAt: number } | null =
  null;
let gdeltInFlight: { timespan: string; promise: Promise<GdeltRoutePayload> } | null =
  null;
let lastGdeltAttemptAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGdeltWithCooldown(
  source: NonNullable<
    (typeof candidateSourceDefinitions)[number] | undefined
  >,
  timespan: string,
): Promise<GdeltRoutePayload> {
  const elapsed = Date.now() - lastGdeltAttemptAt;
  if (elapsed < GDELT_MIN_REQUEST_INTERVAL_MS) {
    await sleep(GDELT_MIN_REQUEST_INTERVAL_MS - elapsed);
  }

  lastGdeltAttemptAt = Date.now();
  const items = await fetchGdeltArticles(source, timespan);
  const payload = {
    sourceId: source.id,
    items,
    collectedAt: new Date().toISOString(),
    cacheStatus: "fresh" as const,
  };
  gdeltCache = { timespan, payload, fetchedAt: Date.now() };
  return payload;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timespan = searchParams.get("timespan") || "24h";

  if (!/^\d{1,3}[hdm]$/.test(timespan)) {
    return NextResponse.json(
      { error: "invalid_timespan" },
      { status: 400 },
    );
  }

  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === GDELT_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "gdelt_source_not_configured" },
      { status: 500 },
    );
  }

  const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

  try {
    if (
      gdeltCache?.timespan === timespan &&
      Date.now() - gdeltCache.fetchedAt < GDELT_CACHE_TTL_MS
    ) {
      return NextResponse.json(
        {
          ...gdeltCache.payload,
          cacheStatus: "fresh",
        },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (gdeltInFlight?.timespan === timespan) {
      const payload = await gdeltInFlight.promise;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    gdeltInFlight = {
      timespan,
      promise: fetchGdeltWithCooldown(source, timespan),
    };
    const payload = await gdeltInFlight.promise;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "gdelt_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      } else if (
        err.message === "network_access_denied" ||
        err.message === "network_connection_reset" ||
        err.message === "network_fetch_failed" ||
        err.message === "tls_certificate_error" ||
        err.message === "parse_failed" ||
        err.message === "timeout"
      ) {
        reason = err.message;
      }
    }

    // Serve stale cache on any transient error (timeout, TLS, network, 429).
    // This prevents the Global View feed from going blank during GDELT
    // outages or connectivity hiccups — the user sees slightly old data
    // rather than an empty panel.
    if (gdeltCache?.timespan === timespan) {
      return NextResponse.json(
        {
          ...gdeltCache.payload,
          cacheStatus: "stale",
        },
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
    gdeltInFlight = null;
  }
}
