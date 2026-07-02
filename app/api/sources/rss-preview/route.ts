import { NextResponse } from "next/server";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import {
  RssPreviewDiagnosticError,
  fetchRssPreview,
} from "@/lib/sources/rssPreviewAdapter";

// Narrow on-demand RSS feed route.
//
// Accepts only GET. Accepts only a sourceId query parameter that matches one
// of the registered RSS sources. Does not accept arbitrary feed URLs. Does not
// proxy arbitrary content. Returns normalized feed items for the live source UI.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This set is the single authoritative allowlist for on-demand RSS fetching.
// Only IDs that also appear in candidateSourceDefinitions (via sourceDefinitions.ts)
// with accessType "rss" should be listed here.  Do not accept arbitrary URLs.
const ALLOWED_PREVIEW_SOURCE_IDS: ReadonlySet<string> = new Set([
  // ── Humanitarian / defense ──────────────────────────────────────────────
  "reliefweb-crises",
  // Cyber security
  "the-hacker-news",
  "defense-news-global",
  "dod-news",
  // ── Turkish sources ─────────────────────────────────────────────────────
  "aa-en-live",
  "trt-haber-turkiye",
  "trt-haber-dunya-feed",
  "trt-haber-dunya",
  "bbc-turkce",
  "dw-turkce",
  // ── Middle East ─────────────────────────────────────────────────────────
  "aljazeera-middle-east",
  "arabnews-cat1",
  "arabnews-cat2",
  "times-of-israel",
  // ── UAE (WAM) ───────────────────────────────────────────────────────────
  "wam-uae-news",
  "wam-world",
  // ── Qatar (QNA) ─────────────────────────────────────────────────────────
  "qna-en",
  // ── Iran ────────────────────────────────────────────────────────────────
  "irna-en",
  "mehr-politics",
  "mehr-world",
  "mehr-iran",
  "mehr-economy",
  "mehr-society",
  "mehr-culture",
  "mehr-science",
  "mehr-special",
  "presstv-headlines",
  "presstv-iran",
  "presstv-middle-east",
  "presstv-world",
  "presstv-politics",
  "presstv-us-europe",
  // ── Levant / conflict ───────────────────────────────────────────────────
  "sana-en",
  "sana-tr",
  "saba-politics",
  "saba-local",
  "saba-arab",
  "saba-international",
  "saba-economy",
  "saba-military",
  "jpost-headlines",
  "jpost-israel",
  "jpost-gaza",
  "jpost-iran",
  // ── Asia-Pacific ────────────────────────────────────────────────────────
  "vna-politics",
  "vna-security",
  "xinhua-china",
  "xinhua-world",
  "abc-australia",
  // ── Russia / Eurasia ────────────────────────────────────────────────────
  "tass-world",
  "azertag-politics",
  "azertag-official",
  // ── Europe ──────────────────────────────────────────────────────────────
  "euronews-world",
  "skynews-world",
  "skynews-uk",
  "skynews-us",
  "skynews-politics",
  "skynews-home",
  "france24-europe",
  "france24-africa",
  "france24-middle-east",
  "france24-americas",
  "france24-asia-pacific",
  "ansa-en",
  "tanjug-politika",
  "ertnews-gr",
  "cyprus-mail",
  // ── Balkans ─────────────────────────────────────────────────────────────
  "balkan-albania",
  "balkan-bosnia",
  "balkan-croatia",
  "balkan-bulgaria",
  "balkan-greece",
  "balkan-kosovo",
  "balkan-macedonia",
  "balkan-moldova",
  "balkan-montenegro",
  "balkan-serbia",
  // ── Africa / North Africa ───────────────────────────────────────────────
  "lana-en",
  // ── Central Asia ────────────────────────────────────────────────────────
  "gazetauz-politics",
  "gazetauz-society",
  // ── Citizen media / global ──────────────────────────────────────────────
  "globalvoices-main",
  "globalvoices-filtered",
]);

const RSS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type RssRoutePayload = {
  sourceId: string;
  items: Awaited<ReturnType<typeof fetchRssPreview>>;
  collectedAt: string;
  cacheStatus?: "fresh" | "stale";
};

// Keyed per sourceId; size is bounded by ALLOWED_PREVIEW_SOURCE_IDS.
const rssCache = new Map<string, { payload: RssRoutePayload; fetchedAt: number }>();
const rssInFlight = new Map<string, Promise<RssRoutePayload>>();

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
    const cached = rssCache.get(source.id);
    if (cached && Date.now() - cached.fetchedAt < RSS_CACHE_TTL_MS) {
      return NextResponse.json(
        { ...cached.payload, cacheStatus: "fresh" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    const pending = rssInFlight.get(source.id);
    if (pending) {
      const payload = await pending;
      return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
    }

    const inFlight = (async (): Promise<RssRoutePayload> => {
      const items = await fetchRssPreview(source);
      const payload: RssRoutePayload = {
        sourceId: source.id,
        items,
        collectedAt: new Date().toISOString(),
        cacheStatus: "fresh",
      };
      rssCache.set(source.id, { payload, fetchedAt: Date.now() });
      return payload;
    })();
    rssInFlight.set(source.id, inFlight);

    const payload = await inFlight;
    return NextResponse.json(payload, { status: 200, headers: noCacheHeaders });
  } catch (err) {
    let reason = "feed_fetch_failed";
    let diagnosticCategory: string | undefined;
    if (err instanceof Error) {
      if (err instanceof RssPreviewDiagnosticError) {
        diagnosticCategory = err.diagnosticCategory;
        reason =
          err.diagnosticCategory === "fetch_failed"
            ? err.message.startsWith("upstream_")
              ? err.message
              : "network_fetch_failed"
            : "parse_failed";
      } else if (err.name === "AbortError") {
        reason = "timeout";
      } else if (err.message === "missing_feed_url") {
        reason = "missing_feed_url";
      } else if (err.message.startsWith("upstream_")) {
        reason = err.message;
      } else {
        reason = "parse_failed";
      }
    }
    const stale = rssCache.get(source.id);
    if (stale) {
      return NextResponse.json(
        { ...stale.payload, cacheStatus: "stale" },
        { status: 200, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      {
        sourceId: source.id,
        error: reason,
        reason,
        diagnosticCategory,
      },
      { status: 502, headers: noCacheHeaders },
    );
  } finally {
    rssInFlight.delete(source.id);
  }
}
