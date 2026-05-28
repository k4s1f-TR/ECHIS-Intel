import { applySourceFilters } from "./filters/applySourceFilters";
import { resolveGeoBasis } from "./geo/resolveGeoBasis";
import { getSourceAdapter } from "./sourceAdapters";
import type {
  IntelligenceEventCandidate,
  NormalizedSourceItem,
  RawSourceItem,
  SourceDefinition,
  SourceFilterResult,
} from "./sourceIntelligenceTypes";

const GLOBAL_VIEW_MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isFreshEnough(item: NormalizedSourceItem): boolean {
  if (!item.publishedAt || !item.collectedAt) return true;
  const published = new Date(item.publishedAt).getTime();
  const collected = new Date(item.collectedAt).getTime();
  if (Number.isNaN(published) || Number.isNaN(collected)) return true;
  return collected - published < GLOBAL_VIEW_MAX_ITEM_AGE_MS;
}

export function normalizeRawSourceItems(
  source: SourceDefinition,
  rawItems: RawSourceItem[],
): NormalizedSourceItem[] {
  const adapter = getSourceAdapter(source);
  return rawItems.map((raw) => adapter.normalizeItem(raw, source));
}

export function buildIntelligenceEventCandidates(
  filterResults: SourceFilterResult<NormalizedSourceItem>[],
  sourceLookup: (sourceId: string) => SourceDefinition | undefined,
): IntelligenceEventCandidate[] {
  return filterResults
    .filter((result) => result.accepted && result.primaryDomain)
    .map((result): IntelligenceEventCandidate => {
      const source = sourceLookup(result.item.sourceId);
      const initial: IntelligenceEventCandidate = {
        id: result.item.id,
        item: result.item,
        title: result.item.title,
        summary: result.item.summary,
        url: result.item.url,
        sourceId: result.item.sourceId,
        sourceName: result.item.sourceName,
        sourceType: result.item.sourceType,
        collectionMethod: result.item.collectionMethod,
        publishedAt: result.item.publishedAt,
        collectedAt: result.item.collectedAt,
        primaryDomain: result.primaryDomain!,
        tags: result.tags,
        relevanceScore: result.relevanceScore,
        priorityScore: result.priorityScore,
        sourceBasis: result.sourceBasis,
        verificationStatus: result.verificationStatus,
        extractionMethod: result.extractionMethod,
        matchedKeywords: result.matchedKeywords,
        matches: result.matches,
        markerEligibility: result.markerEligibility,
        geoBasis: result.geoBasis,
      };

      if (!source) return initial;
      const resolved = resolveGeoBasis(initial, source);
      return {
        ...initial,
        markerEligibility: resolved.markerEligibility,
        geoBasis: resolved.geoBasis,
      };
    })
    .sort((a, b) => {
      const scoreDelta = b.priorityScore - a.priorityScore;
      if (scoreDelta !== 0) return scoreDelta;
      return (
        new Date(b.publishedAt ?? b.collectedAt ?? 0).getTime() -
        new Date(a.publishedAt ?? a.collectedAt ?? 0).getTime()
      );
    });
}

export function runSourceIntelligencePipeline(
  normalizedItems: NormalizedSourceItem[],
  sourceLookup: (sourceId: string) => SourceDefinition | undefined,
): {
  normalizedItems: NormalizedSourceItem[];
  filterResults: SourceFilterResult<NormalizedSourceItem>[];
  eventCandidates: IntelligenceEventCandidate[];
} {
  const freshItems = normalizedItems.filter(isFreshEnough);
  const filterResults = applySourceFilters(freshItems);
  const eventCandidates = buildIntelligenceEventCandidates(
    filterResults,
    sourceLookup,
  );

  return {
    normalizedItems: freshItems,
    filterResults,
    eventCandidates,
  };
}
