import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchRssPreview } from "@/lib/sources/rssPreviewAdapter";

// Narrow on-demand RSS preview route.
//
// Accepts only GET. Accepts only a sourceId query parameter that matches one
// of the two registered candidate/test RSS sources. Does not accept arbitrary
// feed URLs. Does not proxy arbitrary content. Returns a small preview payload
// only; nothing is persisted.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PREVIEW_SOURCE_IDS: ReadonlySet<string> = new Set([
  // General news
  "trt-haber-dunya",
  "aljazeera-middle-east",
  "bbc-turkce",
  "dw-turkce",
  // Conflict / crisis
  "crisis-group-crisiswatch",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");

  if (!sourceId) {
    return NextResponse.json(
      { error: "Missing sourceId parameter.", previewOnly: true },
      { status: 400 },
    );
  }

  if (!ALLOWED_PREVIEW_SOURCE_IDS.has(sourceId)) {
    return NextResponse.json(
      { error: "Unknown candidate source.", previewOnly: true },
      { status: 404 },
    );
  }

  const source = candidateSourceDefinitions.find((entry) => entry.id === sourceId);
  if (!source) {
    return NextResponse.json(
      { error: "Unknown candidate source.", previewOnly: true },
      { status: 404 },
    );
  }

  // Explicit Cache-Control: no-store on every response — prevents browser,
  // CDN, reverse-proxy, and service-worker caching regardless of the request
  // headers sent by the client.  `force-dynamic` prevents server-side
  // framework caching but does not automatically set response headers.
  const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

  try {
    const items = await fetchRssPreview(source);
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
    // Map the thrown error to a stable reason code so the UI can render a
    // specific diagnostic message instead of a generic "unavailable" string.
    let reason = "preview_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        // fetch() timed out — the AbortController fired after FETCH_TIMEOUT_MS.
        reason = "timeout";
      } else if (err.message === "missing_feed_url") {
        reason = "missing_feed_url";
      } else if (err.message.startsWith("upstream_")) {
        // e.g. "upstream_404", "upstream_403", "upstream_500"
        reason = err.message;
      } else {
        // XML parse error, empty body, unexpected throw from the adapter.
        reason = "parse_failed";
      }
    }
    return NextResponse.json(
      {
        sourceId: source.id,
        // `error` carries the reason code so RssPreviewStore stores it as-is
        // in errorBySourceId — the UI maps the code to a human message.
        error: reason,
        reason,
        previewOnly: true,
      },
      { status: 502, headers: noCacheHeaders },
    );
  }
}
