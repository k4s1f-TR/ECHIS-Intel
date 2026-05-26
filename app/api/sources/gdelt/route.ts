import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchGdeltArticles } from "@/lib/sources/gdeltAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GDELT_SOURCE_ID = "gdelt-geopolitical";

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
    const items = await fetchGdeltArticles(source, timespan);
    return NextResponse.json(
      {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
      },
      { status: 200, headers: noCacheHeaders },
    );
  } catch (err) {
    let reason = "gdelt_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        reason = "timeout";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      }
    }
    return NextResponse.json(
      {
        sourceId: source.id,
        error: reason,
        reason,
      },
      { status: 502, headers: noCacheHeaders },
    );
  }
}
