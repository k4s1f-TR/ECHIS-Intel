import { containsNormalizedPhrase, normalizeFilterText } from "../filters/normalizeFilterText";
import { worldCapitals } from "../../worldCapitals";
import type { GeoResolutionMethod } from "../sourceIntelligenceTypes";

export type ResolvedLocation = {
  latitude: number;
  longitude: number;
  label: string;
  countryCode?: string;
  region?: string;
};

type LocationEntry = ResolvedLocation & {
  aliases: readonly string[];
  isGlobalCapitalEntry?: boolean;
};

type LocationMatch = {
  entry: LocationEntry;
  score: number;
};

export type LocationResolutionMethod = Extract<
  GeoResolutionMethod,
  | "event_location_phrase"
  | "official_actor_phrase"
  | "country_actor_phrase"
  | "target_country_phrase"
  | "negotiation_location_phrase"
  | "headline_location_prefix"
  | "mentioned_location_phrase"
>;

export type LocationResolutionCandidate = {
  location: ResolvedLocation;
  method: LocationResolutionMethod;
  score: number;
  matchedAlias: string;
  evidence: string[];
};

const TURKISH_POSSESSIVE_LINKERS = [
  "nin",
  "in",
  "nun",
  "un",
  "s",
] as const;

const TURKISH_CASE_LINKERS = [
  "a",
  "e",
  "ya",
  "ye",
  "da",
  "de",
  "dan",
  "den",
  "daki",
  "deki",
  "taki",
  "teki",
] as const;

const DIRECTIONAL_LOCATION_MODIFIERS = [
  "north",
  "northern",
  "south",
  "southern",
  "east",
  "eastern",
  "west",
  "western",
  "central",
  "kuzey",
  "guney",
  "dogu",
  "bati",
  "orta",
] as const;

const OFFICIAL_ACTOR_PHRASES = [
  "foreign ministry",
  "ministry of foreign affairs",
  "foreign minister",
  "state department",
  "defense ministry",
  "defence ministry",
  "ministry of defense",
  "ministry of defence",
  "presidency",
  "president",
  "prime minister",
  "government",
  "cabinet",
  "diplomatic mission",
  "embassy",
  "leader",
  "mps",
  "mp",
  "lawmakers",
  "parliament",
  "corps",
  "army",
  "military",
  "combat medics",
  "foreign spy chief",
  "disisleri bakanligi",
  "disisleri bakani",
  "savunma bakanligi",
  "savunma bakani",
  "cumhurbaskanligi",
  "cumhurbaskani",
  "basbakan",
  "basbakani",
  "hukumet",
  "hukumeti",
  "bakanlar kurulu",
  "buyukelcilik",
  "diplomatik misyon",
] as const;

const COUNTRY_ACTOR_ACTIONS = [
  "cuts ties",
  "cut ties",
  "denies",
  "denied",
  "accuses",
  "accused",
  "reaffirms",
  "reaffirm",
  "votes",
  "vote",
  "overturning",
  "set to dominate",
  "inch closer",
  "launches strikes",
  "rejects",
  "preparing",
  "to take",
  "will take",
  "says",
  "said",
  "announced",
  "agreed",
  "agreeing",
  "denies agreeing",
  "karar aldi",
  "reddetti",
  "sucladi",
  "acikladi",
  "oyladi",
] as const;

const EVENT_LOCATION_BEFORE = [
  "in",
  "near",
  "around",
  "across",
  "inside",
  "from",
  "toward",
  "towards",
  "over",
  "at",
  "within",
  "into",
  "outside",
  "off",
  "de",
  "da",
  "den",
  "dan",
] as const;

const EVENT_LOCATION_AFTER = [
  "da",
  "de",
  "daki",
  "deki",
  "taki",
  "teki",
  "yakini",
  "yakininda",
  "civarinda",
  "bolgesinde",
  "sinirinda",
  "kiyisinda",
  "aciklarinda",
  "war",
  "conflict",
  "combat zone",
  "combat zones",
  "crisis",
  "ceasefire",
  "fight",
  "force",
  "stability force",
  "tension",
  "dispute",
  "patrol",
  "drill",
  "exercise",
  "border",
  "front",
  "frontline",
  "airspace",
  "territory",
  "coast",
  "strait",
  "region",
  "province",
  "capital",
  "airstrike",
  "strike",
  "missile",
  "drone",
  "shelling",
  "invasion",
  "sanctions",
  "talks",
  "summit",
  "sinir",
  "siniri",
  "bolge",
  "bolgesi",
  "hava",
  "sahasi",
  "toprak",
  "saldiri",
  "ateskes",
  "talimati",
  "talimat",
  "isgal",
  "isgal alani",
  "istikrar gucu",
  "gucu",
  "gerilim",
  "ihtilaf",
  "devriye",
  "tatbikat",
  "kriz",
  "savasi",
  "savas",
  "yaptirim",
  "muzakere",
  "zirve",
  "refugee returns",
  "returns dashboard",
  "dashboard",
  "elections",
  "election",
  "insecurity",
  "train station",
  "stabbing",
  "terror",
  "partnership",
  "funding",
  "hospital care",
  "malnutrition",
  "refugee",
  "refugees",
  "desplazamientos",
  "confinamientos",
  "people of",
  "municipio de",
  "department of",
] as const;

const NEGOTIATION_TERMS = [
  "talks",
  "negotiations",
  "summit",
  "meeting",
  "mediation",
  "ceasefire talks",
  "peace talks",
  "muzakere",
  "muzakereler",
  "gorusme",
  "gorusmeler",
  "zirve",
  "arabuluculuk",
  "ateskes gorusmeleri",
] as const;

const TARGET_ACTION_BEFORE = [
  "against",
  "on",
  "targeting",
  "hits",
  "hit",
  "strikes",
  "strike",
  "attacks",
  "attack",
  "sanctions",
  "embargo",
  "karsi",
  "hedef alan",
  "hedefledi",
  "vurulan",
  "vurdu",
  "saldirdi",
  "yaptirim",
  "ambargo",
  "blacklist",
  "adds",
  "add",
] as const;

const TARGET_ACTION_AFTER = [
  "sanctions",
  "embargo",
  "targeted",
  "hit",
  "struck",
  "attacked",
  "vuruldu",
  "hedef alindi",
  "yaptirim",
  "ambargo",
  "blacklist",
  "blacklisted",
  "sanctions law",
] as const;

const WEAK_STANDALONE_ALIASES = new Set(
  [
    "netanyahu",
    "hezbollah",
    "hizbullah",
    "houthi",
    "houthis",
    "husiler",
    "khamenei",
    "pezeshkian",
    "erdogan",
    "modi",
    "putin",
    "xi jinping",
    "kim jong un",
    "biden",
    "trump",
    "macron",
    "scholz",
    "taliban",
    "tatmadaw",
    "al shabaab",
    "nato",
    "eu",
    "ab",
    "sahel",
    "kremlin",
    "white house",
    "downing street",
    "elysee",
    "european commission",
    "european council",
  ].map(normalizeFilterText),
);

function tokenCount(value: string): number {
  return normalizeFilterText(value).split(/\s+/).filter(Boolean).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseAlternation(values: readonly string[]): string {
  return values
    .map((value) => normalizeFilterText(value))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}

function containsAnyPhrase(normalizedText: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsNormalizedPhrase(normalizedText, phrase));
}

function optionalDirectionalModifier(): string {
  const modifiers = phraseAlternation(DIRECTIONAL_LOCATION_MODIFIERS);
  return `(?:the\\s+)?(?:(?:${modifiers})\\s+)?`;
}

function hasContextualSingleAlias(normalizedText: string, normalizedAlias: string): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  const before = phraseAlternation(EVENT_LOCATION_BEFORE);
  const after = phraseAlternation(EVENT_LOCATION_AFTER);
  const directional = optionalDirectionalModifier();

  return (
    new RegExp(`(^|\\s)(${before})\\s+${directional}${escapedAlias}(?=\\s|$)`).test(
      normalizedText,
    ) ||
    new RegExp(`(^|\\s)${escapedAlias}\\s+(${after})(?=\\s|$)`).test(
      normalizedText,
    )
  );
}

function hasEventLocationPhrase(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  const before = phraseAlternation(EVENT_LOCATION_BEFORE);
  const after = phraseAlternation(EVENT_LOCATION_AFTER);
  const caseLinker = TURKISH_CASE_LINKERS.join("|");
  const directional = optionalDirectionalModifier();

  return (
    new RegExp(`(^|\\s)(${before})\\s+${directional}${escapedAlias}(?=\\s|$)`).test(
      normalizedText,
    ) ||
    new RegExp(`(^|\\s)people\\s+of\\s+the\\s+${escapedAlias}(?=\\s|$)`).test(
      normalizedText,
    ) ||
    new RegExp(
      `(^|\\s)${escapedAlias}(?:\\s+(?:${caseLinker}))?\\s+(${after})(?=\\s|$)`,
    ).test(normalizedText)
  );
}

function hasOfficialActorPhraseAfter(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  const linker = TURKISH_POSSESSIVE_LINKERS.join("|");

  return OFFICIAL_ACTOR_PHRASES.some((phrase) => {
    const normalizedPhrase = normalizeFilterText(phrase);
    if (!normalizedPhrase) return false;
    const escapedPhrase = escapeRegExp(normalizedPhrase);
    return new RegExp(
      `(^|\\s)${escapedAlias}(?:\\s+(?:${linker}))?\\s+${escapedPhrase}(?=\\s|$)`,
    ).test(normalizedText);
  });
}

function hasHeadlineLocationPrefix(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  return (
    new RegExp(`^${escapedAlias}(?=\\s|$)`).test(normalizedText) ||
    new RegExp(`^(world|global|update|flash update)\\s+${escapedAlias}(?=\\s|$)`).test(
      normalizedText,
    )
  );
}

function hasCountryActorAction(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  const actions = phraseAlternation(COUNTRY_ACTOR_ACTIONS);
  const modifier = optionalDirectionalModifier();
  return new RegExp(
    `(^|\\s)${modifier}${escapedAlias}\\s+(${actions})(?=\\s|$)`,
  ).test(normalizedText);
}

function hasNegotiationLocationPhrase(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  if (!containsAnyPhrase(normalizedText, NEGOTIATION_TERMS)) return false;
  return hasEventLocationPhrase(normalizedText, normalizedAlias);
}

function hasTargetCountryPhrase(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  const before = phraseAlternation(TARGET_ACTION_BEFORE);
  const after = phraseAlternation(TARGET_ACTION_AFTER);
  const caseLinker = TURKISH_CASE_LINKERS.join("|");
  const directional = optionalDirectionalModifier();

  return (
    new RegExp(
      `(^|\\s)(${before})(?:\\s+(?:${caseLinker}))?\\s+${directional}${escapedAlias}(?=\\s|$)`,
    ).test(normalizedText) ||
    new RegExp(
      `(^|\\s)${escapedAlias}(?:\\s+(?:${caseLinker}))?\\s+(${after})(?=\\s|$)`,
    ).test(normalizedText)
  );
}

function aliasMatches(normalizedText: string, entry: LocationEntry) {
  return entry.aliases
    .map((alias) => ({
      raw: alias,
      normalized: normalizeFilterText(alias),
      tokens: tokenCount(alias),
    }))
    .filter(
      (alias) =>
        alias.normalized &&
        containsNormalizedPhrase(normalizedText, alias.raw),
    );
}

function scoreLocationEntry(normalizedText: string, entry: LocationEntry): number {
  const matchedAliases = aliasMatches(normalizedText, entry);

  if (matchedAliases.length === 0) return 0;

  let score = 0;
  for (const alias of matchedAliases) {
    const isWeak = WEAK_STANDALONE_ALIASES.has(alias.normalized);
    if (alias.tokens >= 2) {
      score = Math.max(score, isWeak ? 60 : 90);
      continue;
    }
    if (!isWeak && hasContextualSingleAlias(normalizedText, alias.normalized)) {
      score = Math.max(score, 70);
    }
  }

  const strongDistinctAliases = new Set(
    matchedAliases
      .filter((alias) => !WEAK_STANDALONE_ALIASES.has(alias.normalized))
      .map((alias) => alias.normalized),
  );
  if (strongDistinctAliases.size >= 2) {
    score = Math.max(score, 75);
  }

  return score;
}

function scoreOfficialActorEntry(
  normalizedText: string,
  entry: LocationEntry,
): number {
  const aliases = aliasMatches(normalizedText, entry);

  let score = 0;
  for (const alias of aliases) {
    if (!hasOfficialActorPhraseAfter(normalizedText, alias.normalized)) continue;
    score = Math.max(score, alias.tokens >= 2 ? 95 : 85);
  }

  return score;
}

const LOCATION_DICTIONARY: readonly LocationEntry[] = [
  {
    label: "Middle East",
    latitude: 29.8,
    longitude: 44.0,
    region: "Middle East",
    aliases: ["middle east", "mena", "orta dogu", "ortadogu"],
  },
  {
    label: "Red Sea",
    latitude: 19.0,
    longitude: 38.8,
    region: "Red Sea",
    aliases: ["red sea", "kizildeniz", "kizil deniz", "bab el mandeb", "bab al mandab"],
  },
  {
    label: "Black Sea",
    latitude: 43.4,
    longitude: 34.3,
    region: "Black Sea",
    aliases: ["black sea", "karadeniz", "kerch strait", "kerc bogazi"],
  },
  {
    label: "Caucasus",
    latitude: 42.2,
    longitude: 44.8,
    region: "Caucasus",
    aliases: ["caucasus", "south caucasus", "kafkasya", "guney kafkasya"],
  },
  {
    label: "Balkans",
    latitude: 43.5,
    longitude: 21.0,
    region: "Balkans",
    aliases: ["balkans", "western balkans", "balkanlar", "bati balkanlar"],
  },
  {
    label: "Sahel",
    latitude: 15.8,
    longitude: 2.5,
    region: "Sahel",
    aliases: ["sahel", "sahel region", "sahel bolgesi"],
  },
  {
    label: "Horn of Africa",
    latitude: 8.4,
    longitude: 46.3,
    region: "Horn of Africa",
    aliases: ["horn of africa", "afrika boynuzu"],
  },
  {
    label: "South China Sea",
    latitude: 12.0,
    longitude: 114.0,
    region: "South China Sea",
    aliases: ["south china sea", "guney cin denizi"],
  },
  {
    label: "Indo-Pacific",
    latitude: 5.0,
    longitude: 110.0,
    region: "Indo-Pacific",
    aliases: ["indo pacific", "indo-pacific", "hint pasifik"],
  },
  {
    label: "Palestine / Gaza",
    latitude: 31.5,
    longitude: 34.5,
    countryCode: "PS",
    aliases: ["gaza", "gazze", "palestine", "palestinian", "filistin", "west bank", "ramallah"],
  },
  {
    label: "Israel",
    latitude: 31.5,
    longitude: 34.8,
    countryCode: "IL",
    aliases: ["israel", "israeli", "israil", "tel aviv", "jerusalem", "kudus", "netanyahu"],
  },
  {
    label: "Lebanon",
    latitude: 33.9,
    longitude: 35.5,
    countryCode: "LB",
    aliases: [
      "lebanon",
      "lebanese",
      "lubnan",
      "south lebanon",
      "southern lebanon",
      "guney lubnan",
      "beirut",
      "beyrut",
      "tyre",
      "sour",
      "sur",
      "hezbollah",
      "hizbullah",
    ],
  },
  {
    label: "Syria",
    latitude: 34.8,
    longitude: 38.9,
    countryCode: "SY",
    aliases: [
      "syria",
      "syrian",
      "syrian arab republic",
      "suriye",
      "damascus",
      "sam",
      "aleppo",
      "halep",
      "idlib",
    ],
  },
  {
    label: "Iraq",
    latitude: 33.3,
    longitude: 44.4,
    countryCode: "IQ",
    aliases: ["iraq", "iraqi", "irak", "baghdad", "bagdat", "mosul", "musul", "erbil", "kirkuk", "kerkuk"],
  },
  {
    label: "Yemen",
    latitude: 15.6,
    longitude: 48.5,
    countryCode: "YE",
    aliases: ["yemen", "yemeni", "sanaa", "aden", "houthi", "houthis", "husiler"],
  },
  {
    label: "Iran",
    latitude: 32.4,
    longitude: 53.7,
    countryCode: "IR",
    aliases: ["iran", "iranian", "iranli", "tehran", "tahran", "khamenei", "pezeshkian"],
  },
  {
    label: "Turkey",
    latitude: 39.0,
    longitude: 35.0,
    countryCode: "TR",
    aliases: ["turkey", "turkiye", "turkish", "ankara", "istanbul", "erdogan"],
  },
  {
    label: "Saudi Arabia",
    latitude: 24.7,
    longitude: 46.7,
    countryCode: "SA",
    aliases: ["saudi arabia", "saudi", "suudi", "riyadh", "riyad", "jeddah"],
  },
  {
    label: "Egypt",
    latitude: 26.8,
    longitude: 30.8,
    countryCode: "EG",
    aliases: ["egypt", "egyptian", "misir", "cairo", "kahire", "sinai"],
  },
  {
    label: "Jordan",
    latitude: 30.6,
    longitude: 36.2,
    countryCode: "JO",
    aliases: ["jordan", "jordanian", "urdun", "amman"],
  },
  {
    label: "Qatar",
    latitude: 25.35,
    longitude: 51.18,
    countryCode: "QA",
    aliases: ["qatar", "qatari", "katar", "doha"],
  },
  {
    label: "Oman",
    latitude: 21.5,
    longitude: 55.9,
    countryCode: "OM",
    aliases: ["oman", "omani", "umman", "muscat", "maskat"],
  },
  {
    label: "United Arab Emirates",
    latitude: 23.4,
    longitude: 53.8,
    countryCode: "AE",
    aliases: [
      "united arab emirates",
      "uae",
      "emirates",
      "bae",
      "abu dhabi",
      "dubai",
    ],
  },
  {
    label: "Cyprus",
    latitude: 35.1,
    longitude: 33.4,
    countryCode: "CY",
    aliases: ["cyprus", "kibris", "nicosia", "lefkosia"],
  },
  {
    label: "Greece",
    latitude: 39.0,
    longitude: 22.0,
    countryCode: "GR",
    aliases: ["greece", "greek", "yunanistan", "atina", "athens", "aegean"],
  },
  {
    label: "Ukraine",
    latitude: 48.4,
    longitude: 31.2,
    countryCode: "UA",
    aliases: ["ukraine", "ukrainian", "ukrayna", "kyiv", "kiev", "donbas", "crimea", "kirim", "kharkiv"],
  },
  {
    label: "Russia",
    latitude: 61.5,
    longitude: 105.3,
    countryCode: "RU",
    aliases: ["russia", "russian", "rusya", "moscow", "moskova", "kremlin", "putin"],
  },
  {
    label: "China",
    latitude: 35.9,
    longitude: 104.2,
    countryCode: "CN",
    aliases: ["china", "chinese", "cin", "beijing", "pekin", "xi jinping"],
  },
  {
    label: "Taiwan",
    latitude: 23.7,
    longitude: 121.0,
    countryCode: "TW",
    aliases: ["taiwan", "taiwanese", "tayvan", "taipei", "taiwan strait", "tayvan bogazi"],
  },
  {
    label: "Japan",
    latitude: 36.2,
    longitude: 138.3,
    countryCode: "JP",
    aliases: ["japan", "japanese", "japonya", "tokyo", "osaka"],
  },
  {
    label: "South Korea",
    latitude: 35.9,
    longitude: 127.8,
    countryCode: "KR",
    aliases: ["south korea", "south korean", "guney kore", "seoul", "seul"],
  },
  {
    label: "North Korea",
    latitude: 40.3,
    longitude: 127.5,
    countryCode: "KP",
    aliases: ["north korea", "north korean", "kuzey kore", "pyongyang", "kim jong un"],
  },
  {
    label: "United States",
    latitude: 37.1,
    longitude: -95.7,
    countryCode: "US",
    aliases: ["united states", "usa", "us", "u s", "america", "american", "abd", "washington", "white house", "biden", "trump"],
  },
  {
    label: "United Kingdom",
    latitude: 55.4,
    longitude: -3.4,
    countryCode: "GB",
    aliases: ["united kingdom", "uk", "britain", "british", "london", "ingiltere", "downing street"],
  },
  {
    label: "France",
    latitude: 46.2,
    longitude: 2.2,
    countryCode: "FR",
    aliases: ["france", "french", "fransa", "paris", "elysee", "macron"],
  },
  {
    label: "Germany",
    latitude: 51.2,
    longitude: 10.5,
    countryCode: "DE",
    aliases: ["germany", "german", "german netherlands", "almanya", "berlin", "scholz"],
  },
  {
    label: "Netherlands",
    latitude: 52.1,
    longitude: 5.3,
    countryCode: "NL",
    aliases: ["netherlands", "dutch", "holland", "hollanda", "the hague", "amsterdam"],
  },
  {
    label: "Switzerland",
    latitude: 46.8,
    longitude: 8.2,
    countryCode: "CH",
    aliases: ["switzerland", "swiss", "isvicre", "zurich", "geneva", "bern"],
  },
  {
    label: "Hungary",
    latitude: 47.2,
    longitude: 19.5,
    countryCode: "HU",
    aliases: ["hungary", "hungarian", "macaristan", "budapest", "orban"],
  },
  {
    label: "Estonia",
    latitude: 58.6,
    longitude: 25.0,
    countryCode: "EE",
    aliases: ["estonia", "estonian", "estonya", "tallinn"],
  },
  {
    label: "Latvia",
    latitude: 56.9,
    longitude: 24.6,
    countryCode: "LV",
    aliases: ["latvia", "latvian", "letonya", "riga"],
  },
  {
    label: "Poland",
    latitude: 51.9,
    longitude: 19.1,
    countryCode: "PL",
    aliases: ["poland", "polish", "polonya", "warsaw", "varsova"],
  },
  {
    label: "Belarus",
    latitude: 53.7,
    longitude: 28.0,
    countryCode: "BY",
    aliases: ["belarus", "belarusian", "minsk"],
  },
  {
    label: "Romania",
    latitude: 45.9,
    longitude: 25.0,
    countryCode: "RO",
    aliases: ["romania", "romanian", "romanya", "bucharest", "bukres"],
  },
  {
    label: "Moldova",
    latitude: 47.4,
    longitude: 28.4,
    countryCode: "MD",
    aliases: ["moldova", "moldovan", "chisinau", "transnistria"],
  },
  {
    label: "Brussels / NATO-EU",
    latitude: 50.85,
    longitude: 4.35,
    countryCode: "BE",
    aliases: ["nato", "european union", "eu", "avrupa birligi", "ab", "brussels", "bruksel", "european commission", "european council"],
  },
  {
    label: "Afghanistan",
    latitude: 33.9,
    longitude: 67.7,
    countryCode: "AF",
    aliases: ["afghanistan", "afghan", "afganistan", "kabul", "taliban"],
  },
  {
    label: "Pakistan",
    latitude: 30.4,
    longitude: 69.3,
    countryCode: "PK",
    aliases: ["pakistan", "pakistani", "islamabad", "karachi"],
  },
  {
    label: "India",
    latitude: 20.6,
    longitude: 79.0,
    countryCode: "IN",
    aliases: ["india", "indian", "hindistan", "new delhi", "modi", "kashmir"],
  },
  {
    label: "Armenia",
    latitude: 40.1,
    longitude: 45.0,
    countryCode: "AM",
    aliases: ["armenia", "armenian", "ermenistan", "yerevan"],
  },
  {
    label: "Azerbaijan",
    latitude: 40.1,
    longitude: 47.6,
    countryCode: "AZ",
    aliases: ["azerbaijan", "azerbaijani", "azerbaycan", "baku", "karabakh", "karabag"],
  },
  {
    label: "Georgia",
    latitude: 42.3,
    longitude: 43.4,
    countryCode: "GE",
    aliases: ["georgia", "georgian", "gurcistan", "tbilisi", "abkhazia", "south ossetia"],
  },
  {
    label: "Myanmar",
    latitude: 21.9,
    longitude: 95.9,
    countryCode: "MM",
    aliases: ["myanmar", "burma", "birma", "yangon", "naypyidaw", "tatmadaw"],
  },
  {
    label: "Sudan",
    latitude: 12.9,
    longitude: 30.2,
    countryCode: "SD",
    aliases: ["sudan", "sudanese", "hartum", "khartoum", "darfur"],
  },
  {
    label: "Ethiopia",
    latitude: 9.1,
    longitude: 40.5,
    countryCode: "ET",
    aliases: ["ethiopia", "ethiopian", "etiyopya", "addis ababa", "tigray"],
  },
  {
    label: "Democratic Republic of the Congo",
    latitude: -2.9,
    longitude: 23.7,
    countryCode: "CD",
    aliases: [
      "democratic republic of the congo",
      "dr congo",
      "drc",
      "congo kinshasa",
      "kinshasa",
    ],
  },
  {
    label: "Uganda",
    latitude: 1.4,
    longitude: 32.3,
    countryCode: "UG",
    aliases: ["uganda", "ugandan", "kampala"],
  },
  {
    label: "Somalia",
    latitude: 5.2,
    longitude: 46.2,
    countryCode: "SO",
    aliases: ["somalia", "somali", "mogadishu", "mogadisu", "al shabaab"],
  },
  {
    label: "Mali",
    latitude: 17.6,
    longitude: -4.0,
    countryCode: "ML",
    aliases: ["mali", "bamako", "sahel"],
  },
  {
    label: "Niger",
    latitude: 17.6,
    longitude: 8.1,
    countryCode: "NE",
    aliases: ["niger", "niamey", "sahel"],
  },
  {
    label: "Libya",
    latitude: 26.3,
    longitude: 17.2,
    countryCode: "LY",
    aliases: ["libya", "libyan", "libya", "tripoli", "trablus"],
  },
  {
    label: "Venezuela",
    latitude: 6.4,
    longitude: -66.6,
    countryCode: "VE",
    aliases: ["venezuela", "venezuelan", "caracas", "maduro"],
  },
  {
    label: "Guatemala",
    latitude: 15.8,
    longitude: -90.2,
    countryCode: "GT",
    aliases: ["guatemala", "guatemalan", "guatemala city"],
  },
  {
    label: "Colombia",
    latitude: 4.6,
    longitude: -74.3,
    countryCode: "CO",
    aliases: [
      "colombia",
      "colombian",
      "bogota",
      "antioquia",
      "briceno",
      "briceño",
    ],
  },
];

const manualEntryKeys = new Set(
  LOCATION_DICTIONARY.flatMap((entry) => [
    normalizeFilterText(entry.label),
    ...entry.aliases.map((alias) => normalizeFilterText(alias)),
  ]).filter(Boolean),
);

const GLOBAL_CAPITAL_LOCATION_ENTRIES: readonly LocationEntry[] = worldCapitals
  .filter((entry) => !manualEntryKeys.has(normalizeFilterText(entry.country)))
  .map((entry) => ({
    label: entry.country,
    latitude: entry.coordinates[1],
    longitude: entry.coordinates[0],
    aliases: [entry.country, entry.capital],
    isGlobalCapitalEntry: true,
  }));

const ALL_LOCATION_ENTRIES: readonly LocationEntry[] = [
  ...LOCATION_DICTIONARY,
  ...GLOBAL_CAPITAL_LOCATION_ENTRIES,
];

const entriesByCountryCode = new Map(
  ALL_LOCATION_ENTRIES.flatMap((entry) =>
    entry.countryCode ? [[entry.countryCode, entry] as const] : [],
  ),
);

function candidateFor(
  entry: LocationEntry,
  method: LocationResolutionMethod,
  score: number,
  matchedAlias: string,
  evidence: string[],
): LocationResolutionCandidate {
  return {
    location: { ...entry },
    method,
    score,
    matchedAlias,
    evidence,
  };
}

export function findLocationResolutionCandidates(
  text: string,
): LocationResolutionCandidate[] {
  const normalized = normalizeFilterText(text);
  if (!normalized) return [];

  const candidates: LocationResolutionCandidate[] = [];

  for (const entry of ALL_LOCATION_ENTRIES) {
    const aliases = aliasMatches(normalized, entry);
    if (aliases.length === 0) continue;
    let hasRoleEvidenceForEntry = false;

    for (const alias of aliases) {
      const isWeak = WEAK_STANDALONE_ALIASES.has(alias.normalized);

      if (hasOfficialActorPhraseAfter(normalized, alias.normalized)) {
        hasRoleEvidenceForEntry = true;
        candidates.push(
          candidateFor(
            entry,
            "official_actor_phrase",
            alias.tokens >= 2 ? 96 : 90,
            alias.raw,
            [`official actor phrase: ${alias.raw}`],
          ),
        );
      }

      if (!isWeak && hasHeadlineLocationPrefix(normalized, alias.normalized)) {
        hasRoleEvidenceForEntry = true;
        candidates.push(
          candidateFor(
            entry,
            "headline_location_prefix",
            alias.tokens >= 2 ? 86 : 82,
            alias.raw,
            [`headline location prefix: ${alias.raw}`],
          ),
        );
      }

      if (!isWeak && hasCountryActorAction(normalized, alias.normalized)) {
        hasRoleEvidenceForEntry = true;
        candidates.push(
          candidateFor(
            entry,
            "country_actor_phrase",
            alias.tokens >= 2 ? 90 : 84,
            alias.raw,
            [`country actor action: ${alias.raw}`],
          ),
        );
      }

      if (hasNegotiationLocationPhrase(normalized, alias.normalized)) {
        hasRoleEvidenceForEntry = true;
        candidates.push(
          candidateFor(
            entry,
            "negotiation_location_phrase",
            alias.tokens >= 2 ? 97 : 91,
            alias.raw,
            [`negotiation venue phrase: ${alias.raw}`],
          ),
        );
      }

      if (hasEventLocationPhrase(normalized, alias.normalized)) {
        hasRoleEvidenceForEntry = true;
        candidates.push(
          candidateFor(
            entry,
            "event_location_phrase",
            alias.tokens >= 2 ? 95 : 88,
            alias.raw,
            [`event location phrase: ${alias.raw}`],
          ),
        );
      }

      if (!isWeak && hasTargetCountryPhrase(normalized, alias.normalized)) {
        hasRoleEvidenceForEntry = true;
        candidates.push(
          candidateFor(
            entry,
            "target_country_phrase",
            alias.tokens >= 2 ? 90 : 84,
            alias.raw,
            [`target country phrase: ${alias.raw}`],
          ),
        );
      }
    }

    const strongDistinctAliases = new Set(
      aliases
        .filter((alias) => !WEAK_STANDALONE_ALIASES.has(alias.normalized))
        .map((alias) => alias.normalized),
    );
    const strongestAlias = aliases.sort((a, b) => b.tokens - a.tokens)[0];
    if (
      !hasRoleEvidenceForEntry &&
      strongestAlias &&
      (strongestAlias.tokens >= 2 || strongDistinctAliases.size >= 2)
    ) {
      candidates.push(
        candidateFor(
          entry,
          "mentioned_location_phrase",
          strongestAlias.tokens >= 2 ? 74 : 70,
          strongestAlias.raw,
          [`mentioned location phrase: ${strongestAlias.raw}`],
        ),
      );
    }
  }

  const bestByMethodAndLocation = new Map<string, LocationResolutionCandidate>();
  for (const candidate of candidates) {
    const key = [
      candidate.location.countryCode ?? candidate.location.label,
      candidate.method,
    ].join("::");
    const existing = bestByMethodAndLocation.get(key);
    if (!existing || candidate.score > existing.score) {
      bestByMethodAndLocation.set(key, candidate);
    }
  }

  return [...bestByMethodAndLocation.values()].sort((a, b) => b.score - a.score);
}

export function resolveLocationByCountryCode(
  countryCode: string | undefined,
): ResolvedLocation | null {
  if (!countryCode) return null;
  const entry = entriesByCountryCode.get(countryCode.toUpperCase());
  return entry ? { ...entry } : null;
}

export function resolveLocationByText(text: string): ResolvedLocation | null {
  const normalized = normalizeFilterText(text);
  if (!normalized) return null;

  const matches: LocationMatch[] = [];
  for (const entry of ALL_LOCATION_ENTRIES) {
    const score = scoreLocationEntry(normalized, entry);
    if (score >= 70) matches.push({ entry, score });
  }

  const best = matches.sort((a, b) => b.score - a.score)[0];
  return best ? { ...best.entry } : null;
}

export function resolveOfficialActorLocation(
  text: string,
): ResolvedLocation | null {
  const normalized = normalizeFilterText(text);
  if (!normalized) return null;

  const matches: LocationMatch[] = [];
  for (const entry of ALL_LOCATION_ENTRIES) {
    const score = scoreOfficialActorEntry(normalized, entry);
    if (score >= 80) matches.push({ entry, score });
  }

  const best = matches.sort((a, b) => b.score - a.score)[0];
  return best ? { ...best.entry } : null;
}
