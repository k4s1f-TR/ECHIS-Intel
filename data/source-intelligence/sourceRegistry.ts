import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import type {
  CollectionMethod,
  SourceDefinition,
  SourceStatus,
  SourceType,
} from "./sourceIntelligenceTypes";

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  "United States": "US",
  Turkey: "TR",
  "Türkiye": "TR",
  Belgium: "BE",
  France: "FR",
  Germany: "DE",
  "United Kingdom": "GB",
};

export const SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS = [
  "currents-geopolitical",
  "newsdata-geopolitical",
  "worldnews-geopolitical",
  "freenews-geopolitical",
  "finlight-geopolitical",
  "gdelt-geopolitical",
  "reliefweb-crises",
  "guardian-world",
  "trt-haber-dunya",
  "aljazeera-middle-east",
  "bbc-turkce",
  "dw-turkce",
  "defense-news-global",
  "dod-news",
] as const;

function sourceStatus(status: string): SourceStatus {
  switch (status) {
    case "rejected":
      return "disabled";
    case "candidate_test":
      return "test";
    default:
      return "candidate";
  }
}

function sourceType(source: (typeof candidateSourceDefinitions)[number]): SourceType {
  if (source.id.startsWith("currents-")) return "global_news";
  if (source.id.startsWith("newsdata-")) return "global_news";
  if (source.id.startsWith("worldnews-")) return "global_news";
  if (source.id.startsWith("freenews-")) return "global_news";
  if (source.id.startsWith("finlight-")) return "global_news";
  if (source.id.startsWith("gdelt-")) return "aggregator";
  if (source.id.startsWith("guardian-")) return "global_news";
  if (source.id.startsWith("reliefweb-")) return "crisis_humanitarian";
  if (source.sourceStatus === "official_government" || source.sourceStatus === "official_feed") {
    return "official_government";
  }
  if (source.sourceProfile === "conflict_crisis") return "regional_news";
  return source.language === "tr" ? "regional_news" : "global_news";
}

function collectionMethod(
  source: (typeof candidateSourceDefinitions)[number],
): CollectionMethod {
  if (source.id.startsWith("currents-")) return "api";
  if (source.id.startsWith("newsdata-")) return "api";
  if (source.id.startsWith("worldnews-")) return "api";
  if (source.id.startsWith("freenews-")) return "api";
  if (source.id.startsWith("finlight-")) return "api";
  if (source.id.startsWith("gdelt-")) return "aggregator_api";
  if (source.id.startsWith("guardian-")) return "api";
  if (source.accessType === "rss") return "rss";
  if (source.accessType === "api") return "api";
  if (source.accessType === "manual") return "script_import";
  return "dataset";
}

function endpointFor(
  source: (typeof candidateSourceDefinitions)[number],
  method: CollectionMethod,
): string | undefined {
  if (source.id.startsWith("currents-")) return "/api/sources/currents";
  if (source.id.startsWith("newsdata-")) return "/api/sources/newsdata";
  if (source.id.startsWith("worldnews-")) return "/api/sources/worldnews";
  if (source.id.startsWith("freenews-")) return "/api/sources/freenews";
  if (source.id.startsWith("finlight-")) return "/api/sources/finlight";
  if (source.id.startsWith("gdelt-")) return "/api/sources/gdelt";
  if (source.id.startsWith("guardian-")) return "/api/sources/guardian";
  if (method === "rss") {
    return `/api/sources/rss-preview?sourceId=${encodeURIComponent(source.id)}`;
  }
  return undefined;
}

export const sourceRegistry: SourceDefinition[] = candidateSourceDefinitions.map(
  (source) => {
    const method = collectionMethod(source);
    const institutionCountry = source.sourceLocation?.country;
    return {
      id: source.id,
      name: source.name,
      sourceType: sourceType(source),
      collectionMethod: method,
      countryCode: institutionCountry
        ? COUNTRY_CODE_BY_NAME[institutionCountry]
        : undefined,
      language: source.language,
      endpoint: endpointFor(source, method),
      feedUrl: source.candidateFeedUrl,
      sourceStatus: sourceStatus(source.candidateStatus),
      institutionLocation: source.sourceLocation
        ? {
            countryCode:
              COUNTRY_CODE_BY_NAME[source.sourceLocation.country] ?? "",
            city: source.sourceLocation.label,
            lat: source.sourceLocation.lat,
            lon: source.sourceLocation.lng,
            label: source.sourceLocation.label,
          }
        : undefined,
      markerLocationStrategy:
        source.markerLocationStrategy === "source_location"
          ? "institution_location"
          : source.markerLocationStrategy === "item_location"
            ? "item_location"
            : "none",
      legacyCategory: source.category,
      legacyRegionScope: source.regionScope,
    };
  },
);

export const activeSourceRegistry = sourceRegistry.filter((source) =>
  SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS.includes(
    source.id as (typeof SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS)[number],
  ),
);

export function getSourceDefinition(
  sourceId: string,
): SourceDefinition | undefined {
  return sourceRegistry.find((source) => source.id === sourceId);
}
