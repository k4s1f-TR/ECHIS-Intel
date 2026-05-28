import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchRssPreview } from "@/lib/sources/rssPreviewAdapter";

// Narrow on-demand RSS feed route.
//
// Accepts only GET. Accepts only a sourceId query parameter that matches one
// of the registered RSS sources. Does not accept arbitrary feed URLs. Does not
// proxy arbitrary content. Returns normalized feed items for the live source UI.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PREVIEW_SOURCE_IDS: ReadonlySet<string> = new Set([
  "reliefweb-crises",
  "defense-news-global",
  "dod-news",
  "trt-haber-dunya",
  "aljazeera-middle-east",
  "bbc-turkce",
  "dw-turkce",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");

  if (!sourceId) {
    return NextResponse.json(
      { error: "Missing sourceId parameter." },
      { status: 400 },
    );
  }

  if (!ALLOWED_PREVIEW_SOURCE_IDS.has(sourceId)) {
    return NextResponse.json(
      { error: "Unknown source." },
      { status: 404 },
    );
  }

  const source = candidateSourceDefinitions.find((entry) => entry.id === sourceId);
  if (!source) {
    return NextResponse.json(
      { error: "Unknown source." },
      { status: 404 },
    );
  }

  const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

  try {
    const items = await fetchRssPreview(source);
    return NextResponse.json(
      {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
      },
      { status: 200, headers: noCacheHeaders },
    );
  } catch (err) {
    let reason = "feed_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        reason = "timeout";
      } else if (err.message === "missing_feed_url") {
        reason = "missing_feed_url";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      } else {
        reason = "parse_failed";
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
