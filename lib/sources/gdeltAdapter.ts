import type {
  NormalizedSourceItem,
  SourceDefinition,
} from "@/data/sources/sourceTypes";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_ITEMS = 100;
const MAX_TITLE_LENGTH = 300;

const GDELT_QUERY_TERMS = [
  "diplomacy",
  "military",
  "conflict",
  "defense",
  "sanctions",
  "intelligence",
  "foreign minister",
  "ceasefire",
  "NATO",
  "United Nations",
].join(" OR ");

export function buildGdeltUrl(
  timespan = "24h",
  maxRecords = MAX_ITEMS,
): string {
  const params = new URLSearchParams({
    query: `(${GDELT_QUERY_TERMS})`,
    mode: "ArtList",
    format: "json",
    maxrecords: String(Math.min(maxRecords, 250)),
    timespan: timespan,
    sort: "DateDesc",
  });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
}

const FIPS_TO_COUNTRY: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", AG: "Algeria", AO: "Angola",
  AR: "Argentina", AM: "Armenia", AS: "Australia", AU: "Austria",
  AJ: "Azerbaijan", BA: "Bahrain", BG: "Bangladesh", BO: "Belarus",
  BE: "Belgium", BR: "Brazil", BU: "Bulgaria", BM: "Burma (Myanmar)",
  BY: "Burundi", CB: "Cambodia", CM: "Cameroon", CA: "Canada",
  CD: "Chad", CI: "Chile", CH: "China", CO: "Colombia",
  CG: "Congo (DRC)", CF: "Congo (Republic)", HR: "Croatia",
  CU: "Cuba", CY: "Cyprus", EZ: "Czechia", DA: "Denmark",
  DJ: "Djibouti", DR: "Dominican Republic", EC: "Ecuador",
  EG: "Egypt", ES: "El Salvador", ER: "Eritrea", EN: "Estonia",
  ET: "Ethiopia", FI: "Finland", FR: "France", GA: "Gambia",
  GG: "Georgia", GM: "Germany", GH: "Ghana", GR: "Greece",
  GT: "Guatemala", GV: "Guinea", HA: "Haiti", HO: "Honduras",
  HU: "Hungary", IN: "India", ID: "Indonesia", IR: "Iran",
  IZ: "Iraq", EI: "Ireland", IS: "Israel", IT: "Italy",
  JA: "Japan", JO: "Jordan", KZ: "Kazakhstan", KE: "Kenya",
  KN: "North Korea", KS: "South Korea", KU: "Kuwait",
  KG: "Kyrgyzstan", LA: "Laos", LG: "Latvia", LE: "Lebanon",
  LY: "Libya", LH: "Lithuania", LU: "Luxembourg",
  MK: "North Macedonia", MA: "Madagascar", ML: "Mali",
  MO: "Morocco", MZ: "Mozambique",
  NP: "Nepal", NL: "Netherlands", NZ: "New Zealand",
  NG: "Niger", NI: "Nigeria", NO: "Norway", MU: "Oman",
  PK: "Pakistan", PM: "Panama", PE: "Peru", RP: "Philippines",
  PL: "Poland", PO: "Portugal", QA: "Qatar", RO: "Romania",
  RS: "Russia", RW: "Rwanda", SA: "Saudi Arabia", SG: "Senegal",
  RI: "Serbia", SL: "Sierra Leone", SN: "Singapore",
  LO: "Slovakia", SI: "Slovenia", SO: "Somalia",
  SF: "South Africa", SP: "Spain", CE: "Sri Lanka",
  SU: "Sudan", OD: "South Sudan", SW: "Sweden",
  SZ: "Switzerland", SY: "Syria", TW: "Taiwan", TI: "Tajikistan",
  TZ: "Tanzania", TH: "Thailand", TO: "Togo", TS: "Tunisia",
  TU: "Turkey", TX: "Turkmenistan", UG: "Uganda", UP: "Ukraine",
  AE: "UAE", UK: "United Kingdom", US: "United States",
  UZ: "Uzbekistan", VE: "Venezuela", VM: "Vietnam",
  YM: "Yemen", ZA: "Zambia", ZI: "Zimbabwe",
};

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltApiResponse {
  articles?: GdeltArticle[];
}

function normalizeSourceLanguage(language: string | undefined): SourceDefinition["language"] {
  const normalized = (language ?? "").trim().toLowerCase();
  switch (normalized) {
    case "turkish":
    case "tr":
      return "tr";
    case "arabic":
    case "ar":
      return "ar";
    case "french":
    case "fr":
      return "fr";
    case "spanish":
    case "es":
      return "es";
    case "russian":
    case "ru":
      return "ru";
    case "german":
    case "de":
      return "de";
    default:
      return "en";
  }
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function parseGdeltDate(seendate: string): string {
  if (!seendate || seendate.length < 15) return "";
  try {
    const iso =
      `${seendate.slice(0, 4)}-${seendate.slice(4, 6)}-${seendate.slice(6, 8)}` +
      `T${seendate.slice(9, 11)}:${seendate.slice(11, 13)}:${seendate.slice(13, 15)}Z`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString();
  } catch {
    return "";
  }
}

export async function fetchGdeltArticles(
  source: SourceDefinition,
  timespan = "24h",
): Promise<NormalizedSourceItem[]> {
  const url = buildGdeltUrl(timespan, MAX_ITEMS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let data: GdeltApiResponse;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "TaipanMonitor/1.0 (OSINT dashboard, on-demand)",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`upstream_${response.status}`);
    }
    data = await response.json();
  } finally {
    clearTimeout(timer);
  }

  const articles = data.articles;
  if (!Array.isArray(articles) || articles.length === 0) {
    return [];
  }

  const collectedAt = new Date().toISOString();
  const items: NormalizedSourceItem[] = [];

  for (const article of articles) {
    if (!article.title || !article.url) continue;

    const title = clamp(article.title.trim(), MAX_TITLE_LENGTH);
    const publishedAt = parseGdeltDate(article.seendate);

    const fipsCode = (article.sourcecountry || "").toUpperCase();
    const countryName = FIPS_TO_COUNTRY[fipsCode];
    const relatedCountries = countryName ? [countryName] : [];

    const id = `${source.id}::${article.url}`;

    items.push({
      id,
      sourceId: source.id,
      sourceName: `${source.name} — ${article.domain}`,
      title,
      summary: "",
      url: article.url,
      publishedAt,
      collectedAt,
      sourceType: "api",
      sourceStatus: source.sourceStatus,
      verificationStatus: "source_reported",
      sourceBasis: "single_public_source",
      extractionMethod: "api_result",
      sourceLanguage: normalizeSourceLanguage(article.language),
      relatedCountries,
      relatedRegions: [source.regionScope],
      category: source.category,
      isSample: false,
      sourceProfile: source.sourceProfile,
      markerLocationStrategy: source.markerLocationStrategy,
    });
  }

  return items;
}
