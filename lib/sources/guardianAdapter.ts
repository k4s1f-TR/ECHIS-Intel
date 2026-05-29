import type {
  NormalizedSourceItem,
  SourceDefinition,
} from "@/data/sources/sourceTypes";
import { worldCapitals } from "@/data/worldCapitals";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_SUMMARY_LENGTH = 300;

const GUARDIAN_SEARCH_URL = "https://content.guardianapis.com/search";

// Country name → approximate centre coordinates (~70 common countries).
// Same dataset as reliefwebAdapter keyed by country name.
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  Afghanistan: { lat: 33.93, lng: 67.71 },
  Albania: { lat: 41.15, lng: 20.17 },
  Algeria: { lat: 28.03, lng: 1.66 },
  Angola: { lat: -11.2, lng: 17.87 },
  Argentina: { lat: -38.42, lng: -63.62 },
  Armenia: { lat: 40.07, lng: 45.04 },
  Azerbaijan: { lat: 40.14, lng: 47.58 },
  Bangladesh: { lat: 23.68, lng: 90.36 },
  Belarus: { lat: 53.71, lng: 27.95 },
  Bolivia: { lat: -16.29, lng: -63.59 },
  Brazil: { lat: -14.24, lng: -51.93 },
  Myanmar: { lat: 21.92, lng: 95.96 },
  Burma: { lat: 21.92, lng: 95.96 },
  Burundi: { lat: -3.37, lng: 29.92 },
  Cambodia: { lat: 12.57, lng: 104.99 },
  Cameroon: { lat: 7.37, lng: 12.35 },
  "Central African Republic": { lat: 6.61, lng: 20.94 },
  Chad: { lat: 15.45, lng: 18.73 },
  China: { lat: 35.86, lng: 104.19 },
  Colombia: { lat: 4.57, lng: -74.3 },
  Cuba: { lat: 21.52, lng: -77.78 },
  Egypt: { lat: 26.82, lng: 30.8 },
  Ethiopia: { lat: 9.15, lng: 40.49 },
  France: { lat: 46.23, lng: 2.21 },
  Germany: { lat: 51.17, lng: 10.45 },
  Ghana: { lat: 7.95, lng: -1.02 },
  Greece: { lat: 39.07, lng: 21.82 },
  Guatemala: { lat: 15.78, lng: -90.23 },
  Guinea: { lat: 9.95, lng: -11.49 },
  Haiti: { lat: 18.97, lng: -72.29 },
  Honduras: { lat: 15.2, lng: -86.24 },
  India: { lat: 20.59, lng: 78.96 },
  Indonesia: { lat: -0.79, lng: 113.92 },
  Iran: { lat: 32.43, lng: 53.69 },
  Iraq: { lat: 33.22, lng: 43.68 },
  Israel: { lat: 31.05, lng: 34.85 },
  Italy: { lat: 41.87, lng: 12.57 },
  Japan: { lat: 36.2, lng: 138.25 },
  Jordan: { lat: 30.59, lng: 36.24 },
  Kazakhstan: { lat: 48.02, lng: 66.92 },
  Kenya: { lat: -0.02, lng: 37.91 },
  Kosovo: { lat: 42.6, lng: 20.9 },
  Lebanon: { lat: 33.85, lng: 35.86 },
  Libya: { lat: 26.34, lng: 17.23 },
  Mali: { lat: 17.57, lng: -3.99 },
  Mexico: { lat: 23.63, lng: -102.55 },
  Morocco: { lat: 31.79, lng: -7.09 },
  Mozambique: { lat: -18.67, lng: 35.53 },
  Nepal: { lat: 28.39, lng: 84.12 },
  Niger: { lat: 17.61, lng: 8.08 },
  Nigeria: { lat: 9.08, lng: 8.68 },
  "North Korea": { lat: 40.34, lng: 127.51 },
  Pakistan: { lat: 30.38, lng: 69.35 },
  Palestine: { lat: 31.95, lng: 35.23 },
  Peru: { lat: -9.19, lng: -75.02 },
  Philippines: { lat: 12.88, lng: 121.77 },
  Russia: { lat: 61.52, lng: 105.32 },
  Rwanda: { lat: -1.94, lng: 29.87 },
  "Saudi Arabia": { lat: 23.89, lng: 45.08 },
  Somalia: { lat: 5.15, lng: 46.2 },
  "South Korea": { lat: 35.91, lng: 127.77 },
  "South Sudan": { lat: 6.88, lng: 31.31 },
  Spain: { lat: 40.46, lng: -3.75 },
  Sudan: { lat: 12.86, lng: 30.22 },
  Syria: { lat: 34.8, lng: 38.99 },
  Taiwan: { lat: 23.7, lng: 120.96 },
  Turkey: { lat: 38.96, lng: 35.24 },
  Türkiye: { lat: 38.96, lng: 35.24 },
  Uganda: { lat: 1.37, lng: 32.29 },
  Ukraine: { lat: 48.38, lng: 31.17 },
  "United Kingdom": { lat: 55.38, lng: -3.44 },
  "United States": { lat: 37.09, lng: -95.71 },
  Uzbekistan: { lat: 41.38, lng: 64.59 },
  Venezuela: { lat: 6.42, lng: -66.59 },
  Vietnam: { lat: 14.06, lng: 108.28 },
  Yemen: { lat: 15.55, lng: 48.52 },
  Zimbabwe: { lat: -19.02, lng: 29.15 },
};

const WORLD_CAPITAL_COUNTRY_COORDS: Record<string, { lat: number; lng: number }> =
  Object.fromEntries(
    worldCapitals.map((entry) => [
      entry.country,
      { lat: entry.coordinates[1], lng: entry.coordinates[0] },
    ]),
  );

const ALL_COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  ...WORLD_CAPITAL_COUNTRY_COORDS,
  ...COUNTRY_COORDS,
};

// Sorted long-to-short so multi-word names match before their fragments.
const COUNTRY_NAMES_SORTED = Object.keys(ALL_COUNTRY_COORDS).sort(
  (a, b) => b.length - a.length,
);

interface GuardianFields {
  trailText?: string;
}

interface GuardianResult {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  sectionName: string;
  fields?: GuardianFields;
}

interface GuardianApiResponse {
  response?: {
    results?: GuardianResult[];
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function extractCountriesFromText(text: string): string[] {
  const found: string[] = [];
  for (const name of COUNTRY_NAMES_SORTED) {
    if (
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)
    ) {
      found.push(name);
    }
  }
  return found;
}

export async function fetchGuardianArticles(
  source: SourceDefinition,
): Promise<NormalizedSourceItem[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) {
    throw new Error("guardian_key_not_configured");
  }

  const params = new URLSearchParams({
    "api-key": apiKey,
    section: "world|politics|global-development",
    "show-fields": "trailText,thumbnail",
    "page-size": "50",
    "order-by": "newest",
    q: "diplomacy OR military OR conflict OR defense OR sanctions OR war OR NATO OR ceasefire",
  });

  const url = `${GUARDIAN_SEARCH_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let data: GuardianApiResponse;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "TaipanMonitor/1.0",
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

  const results = data.response?.results;
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const collectedAt = new Date().toISOString();
  const items: NormalizedSourceItem[] = [];

  for (const result of results) {
    if (!result.webTitle || !result.webUrl) continue;

    const rawSummary = result.fields?.trailText ?? "";
    const summary = truncate(stripHtml(rawSummary), MAX_SUMMARY_LENGTH);

    const scanText = result.webTitle + " " + summary;
    const relatedCountries = extractCountriesFromText(scanText);
    const firstCountry = relatedCountries[0];
    const coords = firstCountry ? ALL_COUNTRY_COORDS[firstCountry] : undefined;

    items.push({
      id: `${source.id}::${result.id}`,
      sourceId: source.id,
      sourceName: `The Guardian — ${result.sectionName}`,
      title: result.webTitle,
      summary,
      url: result.webUrl,
      publishedAt: result.webPublicationDate,
      collectedAt,
      sourceType: "api",
      sourceStatus: source.sourceStatus,
      verificationStatus: "source_reported",
      sourceBasis: "single_public_source",
      extractionMethod: "api_result",
      sourceLanguage: "en",
      relatedCountries,
      relatedRegions: [source.regionScope],
      category: source.category,
      isSample: false,
      sourceProfile: "general_news",
      markerLocationStrategy: "item_location",
      ...(firstCountry && coords
        ? {
            sourceLocationForMarker: {
              lat: coords.lat,
              lng: coords.lng,
              locationName: firstCountry,
            },
          }
        : {}),
    });
  }

  return items;
}
