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
  "trt-haber-dunya",
  "aljazeera-middle-east",
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

  try {
    const items = await fetchRssPreview(source);
    return NextResponse.json(
      {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        previewOnly: true,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        sourceId: source.id,
        error: "Preview unavailable for this candidate source.",
        previewOnly: true,
      },
      { status: 502 },
    );
  }
}
