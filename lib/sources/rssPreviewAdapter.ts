import type {
  NormalizedSourceItem,
  SourceDefinition,
} from "@/data/sources/sourceTypes";

// RSS Preview Adapter v1.
//
// On-demand, preview-only adapter for candidate/test RSS sources. This is NOT
// production ingestion: no persistence, no scheduling, no caching, no scraping
// of article pages, no full article body retrieval, no AI summarization. The
// adapter fetches a feed once on request, parses a small number of items, and
// returns NormalizedSourceItem objects for UI preview only.

/** Maximum items returned per RSS source in a single preview fetch. */
export const RSS_PREVIEW_ITEMS_PER_SOURCE = 50;
const MAX_PREVIEW_ITEMS = RSS_PREVIEW_ITEMS_PER_SOURCE;
const MAX_BLOCK_SCAN = 100;
const FETCH_TIMEOUT_MS = 8000;
const MAX_TITLE_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 320;

// ---------------------------------------------------------------------------
// Non-news / promotional item filter
// ---------------------------------------------------------------------------

/**
 * Patterns that identify non-editorial RSS items: subscription prompts,
 * newsletter teasers, app-install calls-to-action, etc.
 * Tested against normalised (lowercase, diacritic-stripped, dotless-ı→i)
 * concatenation of title + summary so Turkish characters are handled safely.
 */
const NON_NEWS_PATTERNS: readonly RegExp[] = [
  /abone\s*ol/,           // "abone olmak için tıklayın", "abone ol"
  /subscribe/,
  /subscription/,
  /newsletter/,
  /bildirimleri\s*ac/,    // "bildirimleri aç" (normalised: "bildirimleri ac")
  /telefonunuzda/,
  /whatsapp/,
  /uygulamamizi\s*indirin/, // "uygulamamızı indirin"
  /podcast.*abone/,
  /haberleri\s*takip\s*etmek\s*icin/, // "haberleri takip etmek için"
  /bizi\s*takip\s*edin/,  // "bizi takip edin"
  /sosyal\s*medya/,       // social media call-to-action items
];

/**
 * Returns true when the item appears to be a genuine editorial news item.
 * Returns false for subscription prompts, newsletter teasers, app-install
 * calls-to-action, or other non-news boilerplate content.
 *
 * Applied during parse so no-news items never enter the runtime state.
 */
function isEditorialRssItem(title: string, summary: string): boolean {
  // Inline normalisation (same pipeline as rssMarkerAdapter.normalizeText):
  //   lowercase → NFD decompose → strip combining diacritics → dotless-ı→i
  const normalised = (title + " " + summary)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
  for (const pattern of NON_NEWS_PATTERNS) {
    if (pattern.test(normalised)) return false;
  }
  return true;
}

function stripCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    })
    .replace(/&amp;/g, "&");
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function takeTag(block: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = block.match(re);
  if (!match) return "";
  return decodeHtmlEntities(stripCdata(match[1])).trim();
}

function takeAtomLink(block: string): string {
  const hrefMatch = block.match(/<link\b[^>]*\bhref\s*=\s*"([^"]+)"/i);
  if (hrefMatch) return hrefMatch[1];
  return takeTag(block, "link");
}

function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    blocks.push(match[1]);
    if (blocks.length >= MAX_BLOCK_SCAN) break;
  }
  return blocks;
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function safeIsoDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

async function fetchFeed(feedUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feedUrl, {
      method: "GET",
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
        "User-Agent": "TaipanMonitorRSSPreview/1.0 (preview-only, on-demand)",
      },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) {
      // Include HTTP status so callers can distinguish 404 / 403 / 5xx.
      throw new Error(`upstream_${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function detectAtom(xml: string): boolean {
  if (/<feed\b[^>]*xmlns\s*=\s*"http:\/\/www\.w3\.org\/2005\/Atom"/i.test(xml)) {
    return true;
  }
  return /<entry\b/i.test(xml) && !/<item\b/i.test(xml);
}

export async function fetchRssPreview(
  source: SourceDefinition,
): Promise<NormalizedSourceItem[]> {
  if (!source.candidateFeedUrl) {
    throw new Error("missing_feed_url");
  }

  const xml = await fetchFeed(source.candidateFeedUrl);
  const isAtom = detectAtom(xml);
  const blocks = isAtom
    ? extractBlocks(xml, "entry")
    : extractBlocks(xml, "item");

  const collectedAt = new Date().toISOString();
  const items: NormalizedSourceItem[] = [];

  for (let index = 0; index < blocks.length && items.length < MAX_PREVIEW_ITEMS; index++) {
    const block = blocks[index];

    try {
      const titleRaw = takeTag(block, "title");
      const title = clamp(stripHtml(titleRaw) || "Untitled item", MAX_TITLE_LENGTH);

      const linkRaw = isAtom ? takeAtomLink(block) : takeTag(block, "link");
      const url = (linkRaw || "").trim() || source.baseUrl;

      let summaryRaw = takeTag(block, "description");
      if (!summaryRaw) summaryRaw = takeTag(block, "summary");
      if (!summaryRaw) summaryRaw = takeTag(block, "content");
      const summary = clamp(stripHtml(summaryRaw), MAX_SUMMARY_LENGTH);

      // Reject non-news / promotional items before they enter runtime state.
      // This catches subscription prompts, app-install teasers, etc.
      if (!isEditorialRssItem(title, summary)) continue;

      let dateRaw = takeTag(block, "pubDate");
      if (!dateRaw) dateRaw = takeTag(block, "published");
      if (!dateRaw) dateRaw = takeTag(block, "updated");
      if (!dateRaw) dateRaw = takeTag(block, "dc:date");
      const publishedAt = safeIsoDate(dateRaw);

      let identifier = takeTag(block, "guid");
      if (!identifier) identifier = takeTag(block, "id");
      const id =
        identifier && identifier.length > 0
          ? `${source.id}::${identifier}`
          : `${source.id}::${index}::${publishedAt || collectedAt}`;

      items.push({
        id,
        sourceId: source.id,
        sourceName: source.name,
        title,
        summary,
        url,
        publishedAt,
        collectedAt,
        sourceType: "rss",
        sourceStatus: source.sourceStatus,
        verificationStatus: source.sourceProfile === "official_diplomatic"
          ? "official_entry"
          : "source_reported",
        sourceBasis: source.sourceProfile === "official_diplomatic"
          ? "single_official_source"
          : "single_public_source",
        extractionMethod: "rss_summary",
        relatedCountries: [],
        relatedRegions: [source.regionScope],
        category: source.category,
        isSample: false,
        // Profile / marker strategy — carried from SourceDefinition so that
        // rssMarkerAdapter and rssTopicFilter can act without a source lookup.
        sourceProfile: source.sourceProfile,
        markerLocationStrategy: source.markerLocationStrategy,
        sourceLocationForMarker: source.sourceLocation
          ? {
              lat: source.sourceLocation.lat,
              lng: source.sourceLocation.lng,
              locationName: source.sourceLocation.label,
            }
          : undefined,
      });
    } catch {
      // Skip malformed item; preview must not crash on a single bad entry.
      continue;
    }
  }

  return items;
}
