import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchReliefWebReports } from "@/lib/sources/reliefwebAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELIEFWEB_SOURCE_ID = "reliefweb-crises";

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

  const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

  try {
    const items = await fetchReliefWebReports(source);
    return NextResponse.json(
      {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        previewOnly: true,
      },
      { status: 200, headers: noCacheHeaders },
    );
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
