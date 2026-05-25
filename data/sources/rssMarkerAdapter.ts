import type { NormalizedSourceItem } from "./sourceTypes";
import type { MarkerFeature } from "@/components/maplibre/MapLibreGlobe";

// ---------------------------------------------------------------------------
// RSS → Globe Marker adapter.
//
// Pure function — no network calls, no side effects, no global state.
// Converts NormalizedSourceItem[] to MarkerFeature[] using an explicit
// allow-listed location dictionary with deterministic keyword matching.
//
// Rules:
//   • Title + summary text (lowercased) is scanned against alias lists.
//   • Dictionary order determines priority; first match wins.
//   • At most one marker per RSS item.
//   • Items with no clear location match are silently skipped.
//   • No AI inference, no external geocoding API, no guessing.
// ---------------------------------------------------------------------------

export interface RssMarkerFeature extends MarkerFeature {
  /** The canonical location name used for popup display. */
  locationName: string;
  /**
   * All RSS items that resolved to this location (≥1).
   * Multiple items may share the same deterministic coordinates; the popup
   * pager cycles through them without creating duplicate map pins.
   */
  items: NormalizedSourceItem[];
}

interface LocationEntry {
  name: string;
  lat: number;
  lng: number;
  aliases: readonly string[];
}

/**
 * Allow-listed location dictionary.  Keep this list small and explicit.
 * Aliases are tested as case-insensitive substrings of `title + summary`.
 * More specific aliases are listed first to reduce false positives.
 * Dictionary order sets priority when multiple entries could match.
 */
const LOCATION_DICTIONARY: readonly LocationEntry[] = [
  // ── Levant / Middle East ────────────────────────────────────────────────
  // Aliases include both English and Turkish-language forms.  normalizeText()
  // reduces both the item text and these aliases to the same ASCII form before
  // comparison, so "Gazze" (TR) == "gazze" alias == "gaza" alias after strip.
  {
    name: "Palestine / Gaza",
    lat: 31.5,
    lng: 34.5,
    aliases: [
      // English
      "gaza", "west bank", "palestine", "palestinian", "ramallah", "jenin", "nablus",
      // Turkish
      "gazze", "filistin", "bati seria",
    ],
  },
  {
    name: "Israel",
    lat: 31.5,
    lng: 34.8,
    aliases: [
      // English
      "israel", "israeli", "tel aviv", "jerusalem", "haifa", "netanyahu",
      // Turkish
      "israil",
      "kudus",   // Kudüs → Jerusalem
    ],
  },
  {
    name: "Lebanon",
    lat: 33.9,
    lng: 35.5,
    aliases: [
      // English
      "lebanon", "lebanese", "beirut",
      // Turkish
      "lübnan", "lubnan",
      "beyrut",  // Beyrut → Beirut
    ],
  },
  {
    name: "Syria",
    lat: 34.8,
    lng: 38.9,
    aliases: [
      // English
      "syria", "syrian", "damascus", "aleppo", "homs", "idlib", "raqqa", "deir ez-zor",
      // Turkish
      "suriye", "suriyeli",
      "halep",   // Halep → Aleppo
      "humus",   // Humus → Homs  (boundary-safe: "humus" won't fire inside real words)
      "rakka",   // Rakka → Raqqa
    ],
  },
  {
    name: "Iraq",
    lat: 33.3,
    lng: 44.4,
    aliases: [
      // English
      "iraq", "iraqi", "baghdad", "basra", "mosul", "kirkuk", "erbil",
      "fallujah", "ramadi", "tikrit", "sulaymaniyah",
      // Turkish
      "irak",
      "bagdat",  // Bağdat → Baghdad
      "musul",   // Musul → Mosul
      "kerkuk",  // Kerkük → Kirkuk
    ],
  },
  {
    name: "Yemen",
    lat: 15.6,
    lng: 48.5,
    aliases: [
      // English + Turkish (same word)
      "yemen", "yemeni", "sanaa", "sana'a", "aden", "houthi", "hodeidah", "taiz",
      // Turkish
      "husiler",
    ],
  },
  {
    name: "Iran",
    lat: 32.4,
    lng: 53.7,
    aliases: [
      // English
      "iran", "iranian", "tehran", "isfahan", "mashhad", "shiraz", "qom",
      // Turkish
      "iranli",
      "tahran",  // Tahran → Tehran
    ],
  },
  {
    name: "Türkiye",
    lat: 39.0,
    lng: 35.0,
    aliases: [
      // English
      "turkey", "turkish", "istanbul", "ankara", "erdogan", "izmir", "gaziantep", "bursa",
      // Turkish
      "türkiye", "turkiye",
    ],
  },
  {
    name: "Saudi Arabia",
    lat: 24.7,
    lng: 46.7,
    aliases: [
      // English
      "saudi arabia", "saudi", "riyadh", "mecca", "medina", "jeddah", "neom",
      // Turkish
      "suudi arabistan", "suudi",
    ],
  },
  {
    name: "Jordan",
    lat: 31.3,
    lng: 37.0,
    aliases: [
      // English
      "jordan", "jordanian", "amman",
      // Turkish
      "ürdün", "urdun",
    ],
  },
  {
    name: "Egypt",
    lat: 26.8,
    lng: 30.8,
    aliases: [
      // English
      "egypt", "egyptian", "cairo", "alexandria",
      // Turkish
      "mısır", "misir",
      "kahire",  // Kahire → Cairo
    ],
  },
  {
    name: "Qatar",
    lat: 25.3,
    lng: 51.2,
    aliases: [
      // English + Turkish (same word)
      "qatar", "qatari", "doha",
      // Turkish
      "katar",
    ],
  },
  {
    name: "UAE",
    lat: 24.0,
    lng: 54.4,
    aliases: [
      // English
      "united arab emirates", "abu dhabi", "dubai",
      // Turkish
      "birlesik arap emirlikleri", "bae",
    ],
  },
  // ── Eastern Europe / Russia ─────────────────────────────────────────────
  {
    name: "Ukraine",
    lat: 49.0,
    lng: 32.0,
    aliases: [
      // English
      "ukraine", "ukrainian", "kyiv", "kiev", "kharkiv", "mariupol", "kherson",
      "zaporizhzhia", "odessa", "lviv", "dnipro", "donetsk", "luhansk", "bakhmut",
      // Turkish
      "ukrayna",
    ],
  },
  {
    name: "Russia",
    lat: 61.5,
    lng: 105.3,
    aliases: [
      // English
      "russia", "russian", "moscow", "kremlin", "putin", "saint petersburg",
      // Turkish
      "rusya", "rus",
      "moskova",  // Moskova → Moscow
    ],
  },
  // ── Western powers ──────────────────────────────────────────────────────
  {
    name: "United States",
    lat: 38.9,
    lng: -77.0,
    aliases: [
      // English
      "united states", "washington d.c.", "pentagon", "white house",
      // Turkish
      "abd", "amerikan", "amerikalı", "amerikanin",
    ],
  },
  {
    name: "United Kingdom",
    lat: 51.5,
    lng: -0.1,
    aliases: [
      // English
      "united kingdom", "britain", "british", "london",
      // Turkish
      "ingiltere", "ingiliz",
      "londra",   // Londra → London
    ],
  },
  {
    name: "France",
    lat: 48.8,
    lng: 2.3,
    aliases: [
      // English
      "france", "french", "paris", "macron", "elysee",
      // Turkish
      "fransa", "fransiz",
    ],
  },
  {
    name: "Germany",
    lat: 52.5,
    lng: 13.4,
    aliases: [
      // English
      "germany", "german", "berlin", "bundestag", "scholz", "merz",
      // Turkish
      "almanya", "alman",
    ],
  },
  // ── Asia ────────────────────────────────────────────────────────────────
  {
    name: "China",
    lat: 35.9,
    lng: 104.2,
    aliases: [
      // English
      "china", "chinese", "beijing", "shanghai", "hong kong",
      // Turkish
      "cin", "cinli",
      "pekin",   // Pekin → Beijing
    ],
  },
  {
    name: "Afghanistan",
    lat: 33.9,
    lng: 67.7,
    aliases: [
      // English
      "afghanistan", "afghan", "kabul", "taliban", "kandahar", "herat",
      // Turkish
      "afganistan", "afgan",
      "kabil",   // Kabil → Kabul
    ],
  },
  {
    name: "Pakistan",
    lat: 30.4,
    lng: 69.3,
    aliases: [
      // English
      "pakistan", "pakistani", "islamabad", "karachi", "lahore", "peshawar",
      // Turkish
      "pakistanli",
    ],
  },
  {
    name: "India",
    lat: 20.6,
    lng: 78.9,
    aliases: [
      // English
      "india", "indian", "new delhi", "mumbai", "modi",
      // Turkish
      "hindistan", "hint",
    ],
  },
  {
    name: "North Korea",
    lat: 40.3,
    lng: 127.5,
    aliases: [
      // English
      "north korea", "north korean", "pyongyang", "kim jong",
      // Turkish
      "kuzey kore",
    ],
  },
  // ── Europe / Caucasus ────────────────────────────────────────────────────
  {
    // EU member; ongoing partition dispute (Turkish-Cypriot / Greek-Cypriot)
    name: "Cyprus",
    lat: 35.1,
    lng: 33.4,
    aliases: [
      // English
      "cyprus", "cypriot", "nicosia", "lefkosia",
      // Turkish
      "kibris", "kibrista", "kibristan", "kibrisli",
    ],
  },
  {
    // Armenia-Turkey normalization, Nagorno-Karabakh context
    name: "Armenia",
    lat: 40.1,
    lng: 45.0,
    aliases: [
      // English
      "armenia", "armenian", "yerevan", "nagorno", "karabakh",
      // Turkish
      "ermenistan", "ermeni", "yerevan", "daglik karabag",
    ],
  },
  {
    name: "Azerbaijan",
    lat: 40.1,
    lng: 47.6,
    aliases: [
      // English
      "azerbaijan", "azerbaijani", "baku", "karabakh",
      // Turkish
      "azerbaycan", "azeri", "baku",
    ],
  },
  {
    name: "Georgia",
    lat: 42.3,
    lng: 43.4,
    aliases: [
      // English
      "georgia", "georgian", "tbilisi",
      // Turkish
      "gurcistan", "tiflis",
    ],
  },
  {
    name: "Serbia",
    lat: 44.0,
    lng: 21.0,
    aliases: [
      // English
      "serbia", "serbian", "belgrade",
      // Turkish
      "sirbistan", "belgrad",
    ],
  },
  {
    name: "Kosovo",
    lat: 42.6,
    lng: 20.9,
    aliases: [
      // English
      "kosovo", "pristina",
      // Turkish
      "kosova",
    ],
  },
  {
    name: "Greece",
    lat: 39.1,
    lng: 21.8,
    aliases: [
      // English
      "greece", "greek", "athens",
      // Turkish
      "yunanistan", "yunan", "atina",
    ],
  },
  // ── Africa ──────────────────────────────────────────────────────────────
  {
    name: "Sudan",
    lat: 12.9,
    lng: 30.2,
    aliases: [
      "sudan", "sudanese", "khartoum",
      // Turkish
      "sudanli",
    ],
  },
  {
    name: "Libya",
    lat: 26.3,
    lng: 17.2,
    aliases: [
      // English
      "libya", "libyan", "tripoli", "benghazi",
      // Turkish
      "trablus", "bingazi",
    ],
  },
  {
    name: "Somalia",
    lat: 5.2,
    lng: 46.2,
    aliases: [
      "somalia", "somali", "mogadishu",
      // Turkish
      "somali", "mogadisu",
    ],
  },
  {
    name: "Ethiopia",
    lat: 9.1,
    lng: 40.5,
    aliases: [
      "ethiopia", "ethiopian", "addis ababa",
      // Turkish
      "etiyopya",
    ],
  },
  {
    name: "Mali",
    lat: 17.6,
    lng: -4.0,
    aliases: [
      "mali", "malian", "bamako",
    ],
  },
  {
    name: "Niger",
    lat: 17.6,
    lng: 8.1,
    aliases: [
      "niger", "nigerien", "niamey",
      // Turkish
      "nijer",
    ],
  },
  {
    name: "Democratic Republic of Congo",
    lat: -4.0,
    lng: 21.8,
    aliases: [
      "congo", "congolese", "kinshasa", "drc",
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Text normalisation for language-agnostic alias matching.
//
// RSS items may arrive in Turkish (TRT) or English (Al Jazeera).  Without
// normalisation many Turkish location names fail to match English aliases:
//
//   "İsrail".toLowerCase() → "i̇srail"  (combining dot-above, ≠ "israel")
//   "İran".toLowerCase()   → "i̇ran"    (≠ "iran")
//   "Türkiye"              → "türkiye"        (ü survives toLowerCase)
//
// normalizeText() applies a four-step pipeline that is language-agnostic
// and deterministic — no locale, no AI, no runtime configuration:
//
//   1. toLowerCase()          — base case
//   2. normalize("NFD")       — decompose composed chars (ü → u + ̈, İ → I + ̇ etc.)
//   3. strip combining marks  — remove all U+0300–U+036F (covers ̈, ̀, ́, ̇ …)
//   4. replace dotless ı      — U+0131 (Turkish ı) is not decomposed by NFD;
//                               explicit map to ASCII i
//
// Aliases in LOCATION_DICTIONARY are also pre-normalised at module load time
// so both sides of the comparison are in the same canonical form.
// ---------------------------------------------------------------------------

// Regex for the full Unicode combining-diacritics range (U+0300–U+036F).
// Written as a string-constructed RegExp to avoid ambiguous literal
// Unicode characters in source files across different editors/encodings.
const COMBINING_DIACRITICS_RE = new RegExp(
  "[̀-ͯ]",
  "g",
);

// Turkish dotless ı is U+0131 — not decomposed by NFD, so stripped separately.
const DOTLESS_I_RE = /ı/g;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .replace(DOTLESS_I_RE, "i");
}

// Normalise every alias in the dictionary once at module load, not on each
// call.  This keeps rssItemsToMarkers() O(items × dictionary × aliases) with
// no extra per-call allocation.
// .trim() removes trailing-space workarounds (e.g. "cin ", "abd ") that were
// used to approximate word boundaries — matchesLocationAlias() now handles
// boundary checking with proper lookahead/lookbehind.
const NORMALIZED_DICTIONARY = LOCATION_DICTIONARY.map((entry) => ({
  ...entry,
  aliases: entry.aliases.map((a) => normalizeText(a).trim()),
}));

/**
 * Boundary-aware alias match — replaces naive `text.includes(alias)`.
 *
 * After normalizeText() both corpus text and alias are ASCII-safe (combining
 * diacritics stripped, dotless-ı mapped to i).  We use negative
 * lookbehind/lookahead `(?<![a-z0-9])alias(?![a-z0-9])` so that a short
 * alias like "cin" (Çin → China) cannot fire as a substring inside an
 * unrelated word like "icin" (için → "for" in Turkish).
 *
 * What counts as a boundary:
 *   - start / end of string
 *   - space, punctuation (including Turkish apostrophes ' and ')
 *   - anything that is NOT an ASCII letter or digit
 *
 * This intentionally allows inflected forms such as "cin'de", "cin ile",
 * "cin sınırı" to match the "cin" alias while rejecting "için", "seçin",
 * "biçim", "içinden".
 *
 * Regex metacharacters in the alias (e.g. "." in "washington d.c.",
 * "'" in "sana'a") are escaped before use.
 */
function matchesLocationAlias(normalizedText: string, normalizedAlias: string): boolean {
  if (!normalizedAlias) return false;
  // Escape regex metacharacters present in some aliases (dots, apostrophes).
  const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Lookbehind: not preceded by a Latin letter or digit.
  // Lookahead:  not followed by a Latin letter or digit.
  const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
  return re.test(normalizedText);
}

/**
 * Convert RSS preview items to globe MarkerFeatures, grouped by location.
 *
 * Items that resolve to the same deterministic location are merged into a
 * single RssMarkerFeature (one map pin, multiple items in the pager).
 * Items without a deterministic location match are silently omitted.
 *
 * Marker IDs are location-scoped ("rss-loc::<name>") so they are stable
 * across re-fetches and do not collide with mock-event IDs.
 *
 * Uses normalised text matching so Turkish-language titles (TRT) and
 * English-language titles (Al Jazeera) both resolve against the same
 * alias dictionary.
 */
export function rssItemsToMarkers(items: NormalizedSourceItem[]): RssMarkerFeature[] {
  // Map keyed by location name — preserves dictionary insertion order for
  // the first time each location is encountered.
  const grouped = new Map<string, RssMarkerFeature>();

  for (const item of items) {
    // ── Official diplomatic sources: fixed institution location ─────────────
    // Items from official_diplomatic + source_location sources are grouped
    // under one institution marker per sourceId (not per geographic location).
    // This keeps e.g. all Turkish MFA press releases under a single Ankara pin
    // and all EU Council releases under a single Brussels pin, even if multiple
    // official sources share the same city.
    if (
      item.markerLocationStrategy === "source_location" &&
      item.sourceLocationForMarker
    ) {
      // ID is institution-scoped — one pin per source/institution.
      const markerId = `rss-official::${item.sourceId}`;
      const existing = grouped.get(markerId);
      if (existing) {
        existing.items.push(item);
      } else {
        grouped.set(markerId, {
          id: markerId,
          lng: item.sourceLocationForMarker.lng,
          lat: item.sourceLocationForMarker.lat,
          locationName: item.sourceLocationForMarker.locationName,
          items: [item],
        });
      }
      continue; // skip item-location matching for this item
    }

    // ── General news / conflict-crisis sources: item-level location ─────────
    // Location matching uses only item-level fields (title + per-item summary).
    // Source-level metadata (notes, feed description, regionScope) is
    // intentionally excluded — generic source text such as "Türkiye haberleri"
    // would cause every item from a Turkish source to spuriously match Türkiye.
    const searchText = normalizeText(`${item.title} ${item.summary}`);

    let matched: (typeof NORMALIZED_DICTIONARY)[number] | null = null;

    outer: for (const entry of NORMALIZED_DICTIONARY) {
      for (const alias of entry.aliases) {
        if (matchesLocationAlias(searchText, alias)) {
          matched = entry;
          break outer;
        }
      }
    }

    if (matched !== null) {
      const key = matched.name;
      const existing = grouped.get(key);
      if (existing) {
        // Append to the existing marker's item list (same pin, pager cycles).
        existing.items.push(item);
      } else {
        grouped.set(key, {
          // Stable location-scoped ID — one pin per location.
          id: `rss-loc::${matched.name}`,
          lng: matched.lng,
          lat: matched.lat,
          locationName: matched.name,
          items: [item],
          // severity / confidence intentionally omitted — RSS items carry no
          // machine-verified severity; pin uses the default unstyled appearance.
        });
      }
    }
  }

  return Array.from(grouped.values());
}
