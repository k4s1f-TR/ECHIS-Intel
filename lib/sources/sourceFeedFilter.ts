import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";

// ── Text normalisation (same pipeline as rssMarkerAdapter) ──────────────────

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}

/**
 * Word-boundary-aware substring test.
 * `text` must already be normalised; `term` should be written in its
 * post-normaliseText form (lowercase ASCII).
 * Prevents short aliases like "cin" (China, Turkish) from firing inside
 * unrelated words like "için" or "vaccine".
 */
function containsTerm(text: string, term: string): boolean {
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}

// ── Hard blocklist — Turkish ─────────────────────────────────────────────────
// Applied to general_news items with sourceLanguage === "tr".
// All terms are in post-normaliseText form (lowercase ASCII).

const BLOCKED_TERMS_TR: readonly string[] = [
  // Domestic politics (municipal / opposition)
  "chp", "ozgur ozel", "kemal kilicdaroglu", "belediye", "mutlak butlan",

  // Traffic / accidents
  "trafik kaza", "trafik kazasi",

  // Football clubs
  "galatasaray", "fenerbahce", "besiktas", "trabzonspor",
  "bursaspor", "sivasspor", "antalyaspor", "kayserispor", "konyaspor",
  "basaksehir",

  // Sports / match coverage
  "super lig", "milli mac", "mac sonucu", "mac skoru", "gol atti",
  "futbol transfer", "transfer bonservisi",
  "basketbol maci", "voleybol maci", "formula 1 yarisi",

  // Entertainment / celebrity
  "magazin haberi", "magazin dunyasi",
  "dizi konusu", "dizi oyuncusu",
  "film fragmani", "sinema filmi",

  // Weather / lifestyle
  "hava durumu", "hava tahmini",

  // Domestic financial noise (exchange rates, local market)
  "doviz kuru", "dolar kuru", "euro kuru",
  "borsa istanbul",
];

// ── Hard blocklist — English ─────────────────────────────────────────────────
// Applied to general_news items with sourceLanguage !== "tr".

const BLOCKED_TERMS_EN: readonly string[] = [
  // Football / soccer
  "premier league", "champions league", "europa league", "la liga",
  "transfer window", "transfer fee", "transfer deadline",
  "match result", "match preview", "match report",

  // Other sports
  "nfl season", "nba season", "nhl season",
  "cricket match", "ashes series",
  "tennis tournament",

  // Entertainment
  "box office", "celebrity gossip", "album release",
];

// ── Geopolitical gate — Turkish general_news only ────────────────────────────
//
// After the blocklist pass, Turkish-language items must still contain at
// least one geopolitical signal to pass through.  Turkish general-news RSS
// sources (TRT, BBC TR, DW TR) produce heavy domestic content that the
// blocklist alone cannot fully neutralise.
//
// English sources (Guardian, Al Jazeera) are intentionally NOT gated —
// their world desks self-select for international content, and a gate
// would risk false exclusions on unfamiliar phrasings.
//
// All terms are post-normaliseText (lowercase ASCII).

const GEOPOLITICAL_GATE_TR: readonly string[] = [
  // ── Conflict / military / security ────────────────────────────────────────
  "savas",           // savaş  — war
  "catisma",         // çatışma — conflict
  "saldiri",         // saldırı — attack
  "operasyon",       // operation
  "hava saldirisi",  // hava saldırısı — airstrike
  "bombardiman",     // bombardıman
  "fuze",            // füze — missile
  "insansiz",        // insansız — drone / unmanned
  "asker",           // soldier / troops
  "askeri",          // military (adj)
  "savunma",         // defence
  "teror",           // terör — terror
  "eylem",           // attack (security sense)
  "istihbarat",      // intelligence
  "silah",           // weapon / arms

  // ── Diplomacy ─────────────────────────────────────────────────────────────
  "disisleri",       // dışişleri — foreign affairs / ministry
  "buyukelci",       // büyükelçi — ambassador
  "diplomat",
  "muzakere",        // müzakere — negotiation
  "ateskes",         // ateşkes — ceasefire
  "anlasma",         // anlaşma — agreement / accord
  "zirve",           // summit
  "yaptirim",        // yaptırım — sanction
  "ambargo",

  // ── Key political figures ──────────────────────────────────────────────────
  "putin", "zelenski", "biden", "trump", "netanyahu",

  // ── Active geopolitical actors ────────────────────────────────────────────
  "nato",
  "abd",             // ABD — USA (Turkish acronym)
  "rusya",           // Russia
  "cin",             // Çin → "cin" after normalise — China
  "ukrayna",
  "israel",          // İsrail → "israel" after normalise
  "gazze",           // Gazze — Gaza
  "iran",
  "suriye",          // Syria
  "irak",            // Iraq
  "afganistan",
  "pakistan",
  "kuzey kore",
  "suudi",           // Saudi (Arabia)
  "hamas",
  "hizbullah",
  "pkk",

  // ── Foreign capitals (catches diplomatic / foreign-affairs stories) ────────
  "moskova",         // Moscow
  "kahire",          // Cairo
  "tahran",          // Tehran
  "bagdat",          // Baghdad
  "washington",
  "londra",          // London
  "paris",
  "berlin",
  "pekin",           // Beijing
  "kyiv",

  // ── International institutions & crisis ────────────────────────────────────
  "birlesmis milletler",  // United Nations
  "avrupa birligi",       // European Union
  "imf",
  "multeci",              // mülteci — refugee
  "insani yardim",        // insani yardım — humanitarian aid
  "insani kriz",          // humanitarian crisis
];

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns true when the item should be excluded from the live source feed.
 *
 * Filtering strategy (applied in order):
 *  1. Profile bypass — official_diplomatic and conflict_crisis sources always
 *     pass.  Their content is inherently on-topic; filtering adds only false
 *     negatives.
 *  2. Hard blocklist (per-language) — removes clearly off-topic items:
 *     domestic sports, entertainment, weather, lifestyle.
 *  3. Geopolitical gate (Turkish language only) — after the blocklist, items
 *     must contain at least one geopolitical signal.  Turkish general-news
 *     sources produce substantial domestic noise that the blocklist alone
 *     cannot fully remove.
 */
export function shouldExcludeFromSourceFeed(item: NormalizedSourceItem): boolean {
  // ── Step 1: profile bypass ─────────────────────────────────────────────────
  if (
    item.sourceProfile === "official_diplomatic" ||
    item.sourceProfile === "conflict_crisis"
  ) {
    return false;
  }

  const haystack = normalizeText(`${item.title ?? ""} ${item.summary ?? ""}`);

  // ── Step 2: hard blocklist ─────────────────────────────────────────────────
  const blocklist =
    item.sourceLanguage === "tr" ? BLOCKED_TERMS_TR : BLOCKED_TERMS_EN;

  if (blocklist.some((term) => containsTerm(haystack, term))) {
    return true;
  }

  // ── Step 3: geopolitical gate (Turkish general_news only) ─────────────────
  if (item.sourceLanguage === "tr") {
    const hasSignal = GEOPOLITICAL_GATE_TR.some((term) =>
      containsTerm(haystack, term),
    );
    return !hasSignal;
  }

  return false;
}
