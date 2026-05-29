import { normalizeSourceItem } from "./normalizeSourceItem";
import type {
  CollectionMethod,
  RawSourceItem,
  SourceAdapter,
  SourceDefinition,
} from "./sourceIntelligenceTypes";

type SourceRouteResponse = {
  sourceId?: string;
  items?: RawSourceItem[];
  error?: string;
};

async function fetchRouteItems(source: SourceDefinition): Promise<RawSourceItem[]> {
  if (!source.endpoint) return [];
  const response = await fetch(source.endpoint, { cache: "no-store" });
  let payload: SourceRouteResponse;
  try {
    payload = await response.json();
  } catch {
    throw new Error(response.ok ? "parse_failed" : `source_route_${response.status}`);
  }
  if (!response.ok || payload.error) {
    if (response.status === 404) {
      throw new Error("source_route_not_found");
    }
    throw new Error(payload.error ?? `upstream_${response.status}`);
  }
  return Array.isArray(payload.items) ? payload.items : [];
}

function routeAdapter(
  id: string,
  collectionMethod: CollectionMethod,
): SourceAdapter {
  return {
    id,
    collectionMethod,
    fetchItems: fetchRouteItems,
    normalizeItem: normalizeSourceItem,
  };
}

const placeholderAdapter = (
  id: string,
  collectionMethod: CollectionMethod,
): SourceAdapter => ({
  id,
  collectionMethod,
  async fetchItems() {
    return [];
  },
  normalizeItem: normalizeSourceItem,
});

export const sourceAdapters: Record<CollectionMethod, SourceAdapter> = {
  rss: routeAdapter("rss-route-adapter", "rss"),
  api: routeAdapter("api-route-adapter", "api"),
  aggregator_api: routeAdapter("aggregator-api-route-adapter", "aggregator_api"),
  official_page: placeholderAdapter("official-page-placeholder", "official_page"),
  scraping: placeholderAdapter("scraping-placeholder", "scraping"),
  script_import: placeholderAdapter("script-import-placeholder", "script_import"),
  dataset: placeholderAdapter("dataset-placeholder", "dataset"),
};

export function getSourceAdapter(source: SourceDefinition): SourceAdapter {
  return sourceAdapters[source.collectionMethod];
}
