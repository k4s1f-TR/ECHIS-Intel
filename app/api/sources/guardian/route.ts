import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchGuardianArticles } from "@/lib/sources/guardianAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUARDIAN_SOURCE_ID = "guardian-world";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type GuardianRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchGuardianArticles>>;
  collectedAt: string;
  previewOnly: true;
  cacheStatus?: "fresh" | "stale";
};

let guardianCache: { payload: GuardianRoutePayload; fetchedAt: number } | null = null;
let guardianInFlight: Promise<GuardianRoutePayload> | null = null;

const noCacheHeaders = { "Cache-Control": "no-store, max-age=0" };

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

  try {
    if (guardianCache && Date.now() - guardianCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { ...guardianCache.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    if (guardianInFlight) {
      const payload = await guardianInFlight;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    guardianInFlight = (async (): Promise<GuardianRoutePayload> => {
      const items = await fetchGuardianArticles(source);
      const payload: GuardianRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        previewOnly: true,
        cacheStatus: "fresh",
      };
      guardianCache = { payload, fetchedAt: Date.now() };
      return payload;
    })();

    const payload = await guardianInFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
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

    if (reason !== "guardian_key_not_configured" && guardianCache) {
      return NextResponse.json(
        { ...guardianCache.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      {
        sourceId: source.id,
        error: reason,
        reason,
      },
      { status: reason === "guardian_key_not_configured" ? 500 : 502, headers: noCacheHeaders },
    );
  } finally {
    guardianInFlight = null;
  }
}
