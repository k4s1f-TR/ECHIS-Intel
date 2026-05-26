import http from "http";
import https from "https";
import type {
  NormalizedSourceItem,
  SourceDefinition,
} from "@/data/sources/sourceTypes";

// RSS feed adapter.
//
// This adapter fetches a source feed on demand, parses a bounded set of items,
// and returns NormalizedSourceItem objects for the shared live source pipeline.

/** Maximum items returned per RSS source in a single fetch. */
export const RSS_PREVIEW_ITEMS_PER_SOURCE = 75;
const MAX_PREVIEW_ITEMS = RSS_PREVIEW_ITEMS_PER_SOURCE;
const MAX_BLOCK_SCAN = 100;
const FETCH_TIMEOUT_MS = 8000;
const MAX_TITLE_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 320;

const NON_NEWS_PATTERNS: readonly RegExp[] = [
  /abone\s*ol/,
  /subscribe/,
  /subscription/,
  /newsletter/,
  /bildirimleri\s*ac/,
  /telefonunuzda/,
  /whatsapp/,
  /uygulamamizi\s*indirin/,
  /podcast.*abone/,
  /haberleri\s*takip\s*etmek\s*icin/,
  /bizi\s*takip\s*edin/,
  /sosyal\s*medya/,
];

function isEditorialRssItem(title: string, summary: string): boolean {
  const normalised = (title + " " + summary)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i");

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
  return value.slice(0, Math.max(0, max - 1)).trimEnd() + "...";
}

function safeIsoDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

/**
 * Fetch a feed URL using Node.js native http/https modules.
 * The undici-backed global fetch used by Next.js has a TLS fingerprint that
 * some CDN WAFs (e.g. HDX/ReliefWeb) flag as bot traffic. Native modules
 * use a different fingerprint and pass through without issues.
 * Follows up to 5 redirects automatically.
 */
function fetchFeed(feedUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const makeRequest = (url: string, hops = 0): void => {
      if (hops > 5) {
        reject(new Error("upstream_too_many_redirects"));
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        reject(new Error("upstream_invalid_url"));
        return;
      }

      const lib = parsed.protocol === "https:" ? https : http;
      const port = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === "https:"
          ? 443
          : 80;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port,
          path: parsed.pathname + parsed.search,
          method: "GET",
          headers: {
            Accept:
              "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          },
        },
        (res) => {
          const { statusCode, headers: resHeaders } = res;

          // Follow redirects
          if (
            (statusCode === 301 ||
              statusCode === 302 ||
              statusCode === 307 ||
              statusCode === 308) &&
            resHeaders.location
          ) {
            res.destroy();
            const next = new URL(resHeaders.location, url).href;
            makeRequest(next, hops + 1);
            return;
          }

          if (!statusCode || statusCode < 200 || statusCode >= 300) {
            res.destroy();
            reject(new Error(`upstream_${statusCode ?? 0}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          res.on("error", reject);
        },
      );

      req.setTimeout(FETCH_TIMEOUT_MS, () => {
        req.destroy(new Error("AbortError"));
      });

      req.on("error", (err: NodeJS.ErrnoException) => {
        if (err.message === "AbortError") {
          const abort = new Error("Feed request timed out");
          abort.name = "AbortError";
          reject(abort);
        } else {
          reject(err);
        }
      });

      req.end();
    };

    makeRequest(feedUrl);
  });
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
        sourceLanguage: source.language,
        relatedCountries: [],
        relatedRegions: [source.regionScope],
        category: source.category,
        isSample: false,
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
      continue;
    }
  }

  return items;
}
