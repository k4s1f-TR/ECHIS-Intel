import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchGuardianArticles } from "@/lib/sources/guardianAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUARDIAN_SOURCE_ID = "guardian-world";

export async function GET() {
  if (!process.env.GUARDIAN_API_KEY) {
    return NextResponse.json(
      { error: "guardian_key_not_configured" },
      { status: 500 },
    );
  }

  const source = candidateSourceDefinitions.find(
    (entry) => entry.id === GUARDIAN_SOURCE_ID,
  );
  if (!source) {
    return NextResponse.json(
      { error: "guardian_source_not_configured" },
      { status: 500 },
    );
  }

  const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

  try {
    const items = await fetchGuardianArticles(source);
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
    let reason = "guardian_fetch_failed";
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        reason = "timeout";
      } else if (err.message === "guardian_key_not_configured") {
        reason = "guardian_key_not_configured";
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
      { status: reason === "guardian_key_not_configured" ? 500 : 502, headers: noCacheHeaders },
    );
  }
}
