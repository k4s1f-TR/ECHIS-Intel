import { containsNormalizedPhrase, normalizeFilterText } from "../filters/normalizeFilterText";

export type ResolvedLocation = {
  latitude: number;
  longitude: number;
  label: string;
  countryCode?: string;
  region?: string;
};

type LocationEntry = ResolvedLocation & {
  aliases: readonly string[];
};

type LocationMatch = {
  entry: LocationEntry;
  score: number;
};

const TURKISH_POSSESSIVE_LINKERS = [
  "nin",
  "in",
  "nun",
  "un",
  "s",
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

const LOCATION_CONTEXT_BEFORE = [
  "in",
  "near",
  "around",
  "across",
  "inside",
  "from",
  "toward",
  "towards",
  "on",
  "against",
  "over",
  "at",
  "within",
  "into",
  "outside",
  "off",
  "uzerine",
  "karsi",
  "de",
  "da",
  "den",
  "dan",
] as const;

const LOCATION_CONTEXT_AFTER = [
  "war",
  "conflict",
  "crisis",
  "ceasefire",
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
  "government",
  "ministry",
  "army",
  "military",
  "forces",
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
  "hukumet",
  "bakanlik",
  "ordusu",
  "askeri",
  "saldiri",
  "ateskes",
  "kriz",
  "savasi",
  "savas",
  "yaptirim",
  "muzakere",
  "zirve",
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

function hasContextualSingleAlias(normalizedText: string, normalizedAlias: string): boolean {
  const escapedAlias = escapeRegExp(normalizedAlias);
  const before = LOCATION_CONTEXT_BEFORE.join("|");
  const after = LOCATION_CONTEXT_AFTER.join("|");

  return (
    new RegExp(`(^|\\s)(${before})\\s+${escapedAlias}(?=\\s|$)`).test(
      normalizedText,
    ) ||
    new RegExp(`(^|\\s)${escapedAlias}\\s+(${after})(?=\\s|$)`).test(
      normalizedText,
    )
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

function scoreLocationEntry(normalizedText: string, entry: LocationEntry): number {
  const matchedAliases = entry.aliases
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
  const aliases = entry.aliases
    .map((alias) => ({
      raw: alias,
      normalized: normalizeFilterText(alias),
      tokens: tokenCount(alias),
    }))
    .filter((alias) => alias.normalized);

  let score = 0;
  for (const alias of aliases) {
    if (!containsNormalizedPhrase(normalizedText, alias.raw)) continue;
    if (!hasOfficialActorPhraseAfter(normalizedText, alias.normalized)) continue;
    score = Math.max(score, alias.tokens >= 2 ? 95 : 85);
  }

  return score;
}

const LOCATION_DICTIONARY: readonly LocationEntry[] = [
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
    aliases: ["lebanon", "lebanese", "lubnan", "beirut", "beyrut", "hezbollah", "hizbullah"],
  },
  {
    label: "Syria",
    latitude: 34.8,
    longitude: 38.9,
    countryCode: "SY",
    aliases: ["syria", "syrian", "suriye", "damascus", "sam", "aleppo", "halep", "idlib"],
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
    aliases: ["yemen", "yemeni", "sanaa", "aden", "houthi", "houthis", "husiler", "red sea", "kizildeniz"],
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
    aliases: ["china", "chinese", "cin", "beijing", "pekin", "xi jinping", "south china sea", "guney cin denizi"],
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
    aliases: ["united states", "usa", "u s", "america", "american", "abd", "washington", "white house", "biden", "trump"],
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
    aliases: ["germany", "german", "almanya", "berlin", "scholz"],
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
];

const entriesByCountryCode = new Map(
  LOCATION_DICTIONARY.flatMap((entry) =>
    entry.countryCode ? [[entry.countryCode, entry] as const] : [],
  ),
);

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
  for (const entry of LOCATION_DICTIONARY) {
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
  for (const entry of LOCATION_DICTIONARY) {
    const score = scoreOfficialActorEntry(normalized, entry);
    if (score >= 80) matches.push({ entry, score });
  }

  const best = matches.sort((a, b) => b.score - a.score)[0];
  return best ? { ...best.entry } : null;
}
