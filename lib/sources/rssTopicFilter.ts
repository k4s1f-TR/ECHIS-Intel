import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";

// ---------------------------------------------------------------------------
// RSS topic filter for Global View.
//
// Keeps only items relevant to: diplomacy, foreign policy, defense/public
// institutions, international system, conflict diplomacy, and geopolitical
// security.  Lifestyle, sports, entertainment, and general local news are
// excluded so they do not pollute the intelligence feed.
//
// Scoring model
//   title keyword match:    +4  (negative: -6)
//   summary keyword match:  +2  (negative: -3)
//   include threshold:      ≥ 3  (one strong title hit is enough)
//   early-exit exclude:     ≤ -6 (strong lifestyle signal → reject immediately)
//
// Applied AFTER the non-news/promo filter and the recency filter,
// BEFORE location matching and marker generation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Same pipeline as rssMarkerAdapter.normalizeText — inlined to avoid a
 * cross-layer import of a data-layer utility from lib/.
 */
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (ü→u, ç→c…)
    .replace(/ı/g, "i");        // Turkish dotless ı → i
}

// ---------------------------------------------------------------------------
// Term matchers
// ---------------------------------------------------------------------------

type TermMatcher = (text: string) => boolean;

/**
 * Boundary-aware match.
 * Uses negative look-behind/look-ahead so that "ab" cannot fire inside
 * "sabah" and "bm" cannot fire inside unrelated words.
 * Required for: short acronyms, all exclude terms.
 */
function boundaryMatcher(phrase: string): TermMatcher {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
  return (t) => re.test(t);
}

/**
 * Simple substring match.
 * Catches Turkish inflected forms that boundary matching would miss:
 * e.g. "görüşmeleri" ⊃ "gorusme", "dış politikasında" ⊃ "dis politika".
 * Safe for: multi-word phrases and longer single-word terms where
 * the phrase is specific enough to avoid false positives.
 */
function includesMatcher(phrase: string): TermMatcher {
  return (t) => t.includes(phrase);
}

// ---------------------------------------------------------------------------
// Weighted term builder
// ---------------------------------------------------------------------------

interface WeightedTerm {
  readonly matches: TermMatcher;
  readonly titleScore: number;
  readonly summaryScore: number;
}

/**
 * Build an INCLUDE term.
 * @param raw   Raw Turkish/English string (will be normalised at build time).
 * @param mode  "boundary" for short/ambiguous terms; "includes" (default) for
 *              multi-word phrases and longer terms.
 */
function inc(raw: string, mode: "boundary" | "includes" = "includes"): WeightedTerm {
  const phrase = norm(raw);
  const matches = mode === "boundary" ? boundaryMatcher(phrase) : includesMatcher(phrase);
  return { matches, titleScore: 4, summaryScore: 2 };
}

/**
 * Build an EXCLUDE term.
 * @param raw   Raw Turkish/English string (will be normalised at build time).
 * @param mode  "boundary" (default) for short/ambiguous terms; "includes" for
 *              multi-word phrases whose last word receives Turkish inflectional
 *              suffixes (e.g. "genel merkez" → "genel merkezinde") — substring
 *              matching is safe because the full multi-word phrase is specific
 *              enough to avoid false exclusions.
 */
function exc(raw: string, mode: "boundary" | "includes" = "boundary"): WeightedTerm {
  const phrase = norm(raw);
  const matches = mode === "includes" ? includesMatcher(phrase) : boundaryMatcher(phrase);
  return { matches, titleScore: -6, summaryScore: -3 };
}

// ---------------------------------------------------------------------------
// Score thresholds
// ---------------------------------------------------------------------------

/** Minimum cumulative score for Global View inclusion. */
const SCORE_THRESHOLD = 2;

/**
 * If the running score drops to or below this value at any point during
 * iteration, the item is immediately excluded (early-exit optimisation).
 */
const EARLY_EXCLUDE_SCORE = -6;

// ---------------------------------------------------------------------------
// Term list
// Exclude terms are listed first so the early-exit fires quickly for
// typical lifestyle/sports items that have no diplomatic vocabulary.
// ---------------------------------------------------------------------------
const SCORED_TERMS: readonly WeightedTerm[] = [
  // ── Exclude: lifestyle / non-geopolitical content ──────────────────────
  // All exclude terms use boundary matching to avoid false exclusions.
  exc("spor"),
  exc("magazin"),
  exc("yaşam"),
  exc("sağlık"),
  exc("otomobil"),
  exc("emlak"),
  exc("hava durumu"),
  exc("burç"),
  exc("abonelik"),
  exc("newsletter"),
  exc("subscribe"),
  // ── Exclude: domestic politics / ceremony signals ───────────────────────
  // These terms strongly signal non-geopolitical domestic content.
  // "milli aile" → Milli Aile Haftası (family week events).
  // "genel merkez" → party headquarters; almost exclusively used for
  //   domestic party-politics stories (e.g. "CHP Genel Merkezinde tahliye").
  //   Note: NATO/EU headquarters are called "karargah" / "konseyi", not
  //   "genel merkez", so this exclusion is Turkey-domestic-politics-specific.
  // "kurultay" → party congress; never used in international context.
  // "borsa" → stock exchange; financial-markets reporting, not intelligence.
  // "bayram tatili" → holiday schedule / traffic reports.
  exc("milli aile"),
  exc("genel merkez", "includes"),  // always inflected: "merkezinde/nde/den" — substring needed
  exc("kurultay"),
  exc("borsa"),
  exc("bayram tatili"),

  // ── Include: diplomacy ──────────────────────────────────────────────────
  inc("diplomasi"),
  inc("diplomatik"),
  inc("diplomat"),              // includes: catches "diplomatı", "diplomatın"
  inc("büyükelçi"),             // includes: catches "büyükelçisi", "büyükelçiye"
  inc("elçilik"),
  inc("konsolosluk"),
  inc("temas", "boundary"),    // boundary: avoids "temasli" (contact tracing)
  inc("görüşme"),               // includes: catches "görüşmeleri", "görüşmede"
  inc("müzakere"),              // includes: catches "müzakereleri", "müzakeresine"
  inc("heyet"),
  inc("ziyaret"),               // includes: catches "ziyareti", "ziyarette"
  inc("ikili ilişkiler"),       // multi-word → includes
  inc("resmi ziyaret"),         // multi-word → includes

  // ── Include: foreign policy / international system ──────────────────────
  inc("dış politika"),          // multi-word → includes, catches "dış politikasında"
  inc("dış siyaset"),
  inc("uluslararası ilişkiler"),
  inc("uluslararası sistem"),
  inc("bölgesel gelişme"),
  inc("küresel gündem"),
  inc("jeopolitik"),
  inc("stratejik ortaklık"),    // multi-word → includes
  inc("normalleşme"),           // includes: Türkiye-Ermenistan, İsrail-Arap normalleşmesi
  inc("ibrahim anlaşma"),       // includes: Abraham Accords and related references

  // ── Include: institutions ────────────────────────────────────────────────
  inc("dışişleri"),             // includes: catches "dışişleri bakanlığından" etc.
  inc("cumhurbaşkanlığı"),
  // "cumhurbaşkanı" intentionally removed: too broad — fires on ceremonial
  // mentions (Milli Aile Haftası, cultural commemorations) that have no
  // geopolitical signal.  Diplomatic presidential meetings are caught by
  // "görüşme", "ziyaret", "resmi ziyaret", "ikili ilişkiler" instead.
  inc("msb", "boundary"),      // boundary: short acronym
  inc("milli savunma"),         // multi-word, specific enough
  inc("savunma bakanı"),        // multi-word → includes
  inc("nato"),                  // includes: "nato" is specific in any context
  inc("bm", "boundary"),        // boundary: "bm" is 2 chars, needs word isolation
  inc("birleşmiş milletler"),
  inc("ab", "boundary"),        // boundary: "ab" appears in "sabah" as substring
  inc("avrupa birliği"),
  inc("avrupa konseyi"),
  inc("kremlin"),
  inc("beyaz saray"),           // multi-word → includes
  inc("pentagon"),
  // ── Include: geopolitically significant country names (TR) ───────────────
  // These are included as topic signals — not just location aliases — because
  // their appearance in Turkish headlines almost always signals a geopolitical
  // story (Cyprus problem, Armenia-Turkey normalization, etc.).
  inc("kıbrıs", "boundary"),    // Cyprus: EU member, ongoing partition dispute
  inc("ermenistan", "boundary"), // Armenia: normalization, Nagorno-Karabakh context
  inc("nükleer"),               // includes: catches "nükleer anlaşma", "nükleer silah"

  // ── Include: conflict diplomacy / security ───────────────────────────────
  inc("ateşkes"),               // includes: catches "ateşkese", "ateşkeste"
  inc("barış görüşmeleri"),     // multi-word → includes
  inc("barış planı"),
  inc("müzakere süreci"),
  inc("yaptırım"),              // includes: catches "yaptırımları", "yaptırıma"
  inc("ambargo"),
  inc("kriz"),                  // includes: catches "krizde", "krizin", "krizle"
  inc("gerilim"),               // includes: catches "gerilimi", "gerilimde"
  inc("sınır hattı"),           // multi-word → includes
  inc("çatışma"),               // includes: catches "çatışmalar", "çatışmada"
  inc("savaş"),                 // includes: catches "savaşta", "savaşın"
  inc("operasyon"),             // includes: catches "operasyonu", "operasyonda"
  inc("askeri hareketlilik"),   // multi-word → includes

  // ── Include: English equivalents ────────────────────────────────────────
  // Required for English-language sources (Al Jazeera, Crisis Group, etc.)
  // whose titles and summaries are in English.
  inc("diplomacy"),
  inc("diplomatic"),
  inc("ambassador"),
  inc("embassy"),
  inc("consulate"),
  inc("delegation"),
  inc("negotiations"),
  inc("bilateral"),
  inc("summit"),
  inc("foreign policy"),        // multi-word → includes
  inc("foreign minister"),      // multi-word → includes
  inc("foreign ministry"),
  inc("foreign affairs"),
  inc("international relations"),
  inc("geopolitics"),
  inc("strategic partnership"),
  inc("state department"),      // multi-word → includes
  inc("defense ministry"),
  inc("ministry of defense"),
  inc("united nations"),        // multi-word → includes (covers UN acronym in context)
  inc("security council"),      // multi-word → includes
  inc("european union"),        // multi-word → includes
  inc("european council"),      // multi-word → includes
  inc("european parliament"),
  inc("white house"),           // multi-word → includes
  inc("ceasefire"),
  inc("peace talks"),           // multi-word → includes
  inc("peace deal"),
  inc("sanctions"),
  inc("conflict"),              // includes: catches "conflicts", "conflicting"
  inc("crisis"),                // includes: catches "crises", "crisis-hit"
  inc("tensions"),
  inc("military operation"),    // multi-word → includes
  inc("armed conflict"),        // multi-word → includes
  inc("humanitarian crisis"),   // multi-word → includes
  inc("humanitarian aid"),
  inc("offensive"),
  inc("ceasefire talks"),
  inc("peace process"),
  inc("nuclear"),               // catches nuclear deal, nuclear talks, nuclear program
  inc("treaty"),                // formal international treaties
  inc("normalization"),         // normalization of relations
  inc("coup"),                  // coup d'état
  inc("invasion"),              // military invasion
  inc("annexation"),            // territorial annexation
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the RSS item's topic is relevant for Global View.
 *
 * Profile-based shortcuts (applied before scoring):
 *   official_diplomatic — always passes; the source IS diplomatic by definition.
 *   conflict_crisis     — always passes; the source IS conflict-focused.
 *   general_news / undefined — full scoring with SCORE_THRESHOLD.
 *
 * Scoring (general_news):
 *   Each term is checked against the normalised title (score +4 / -6) and
 *   normalised summary (+2 / -3).  The item is included when the cumulative
 *   score reaches SCORE_THRESHOLD (3), and excluded early when it drops to
 *   EARLY_EXCLUDE_SCORE (-6).
 *
 * Call order in the Global View pipeline:
 *   editorial filter → recency filter → isGlobalViewRelevantRssItem → markers
 */
export function isGlobalViewRelevantRssItem(item: NormalizedSourceItem): boolean {
  // Official diplomatic sources are always relevant — the source itself is
  // an official institutional signal; no keyword scoring needed.
  if (item.sourceProfile === "official_diplomatic") return true;

  // Conflict / crisis sources (Crisis Group, ReliefWeb, New Humanitarian,
  // RFE/RL) publish exclusively conflict-relevant content; any item that
  // passed the editorial filter is suitable for the intelligence feed.
  // "Lighter topic filtering" = source profile bypasses the threshold check.
  if (item.sourceProfile === "conflict_crisis") return true;

  // General news and unknown profiles: apply full weighted keyword scoring.
  const title   = norm(item.title   ?? "");
  const summary = norm(item.summary ?? "");
  let score = 0;

  for (const term of SCORED_TERMS) {
    if (term.matches(title))   score += term.titleScore;
    if (term.matches(summary)) score += term.summaryScore;
    // Early exit: strongly lifestyle / non-diplomatic content detected.
    if (score <= EARLY_EXCLUDE_SCORE) return false;
  }

  return score >= SCORE_THRESHOLD;
}
