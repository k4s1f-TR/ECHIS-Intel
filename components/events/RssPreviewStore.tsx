"use client";

import { useMemo } from "react";
import {
  SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS,
} from "@/data/source-intelligence/sourceRegistry";
import type { NormalizedSourceItem as SourceIntelligenceItem } from "@/data/source-intelligence/sourceIntelligenceTypes";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import { useSourceIntelligenceStore } from "@/components/source-intelligence/SourceIntelligenceProvider";

export const RSS_PREVIEW_DEFAULT_SOURCE_IDS = [
  ...SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS,
] as const;

export interface RssPreviewStore {
  itemsBySourceId: Record<string, NormalizedSourceItem[]>;
  collectedAtBySourceId: Record<string, string>;
  loadingBySourceId: Record<string, boolean>;
  errorBySourceId: Record<string, string | null>;
  combinedItems: NormalizedSourceItem[];
  previewSource: (sourceId: string) => Promise<void>;
}

function legacySourceType(item: SourceIntelligenceItem): NormalizedSourceItem["sourceType"] {
  if (item.collectionMethod === "rss") return "rss";
  if (
    item.collectionMethod === "api" ||
    item.collectionMethod === "aggregator_api" ||
    item.collectionMethod === "official_page"
  ) {
    return "api";
  }
  if (item.collectionMethod === "script_import") return "manual";
  return "static";
}

function legacyVerificationStatus(
  item: SourceIntelligenceItem,
): NormalizedSourceItem["verificationStatus"] {
  if (item.verificationStatus === "official") return "official_statement";
  if (item.verificationStatus === "cross_source_matched") {
    return "multi_source_reference";
  }
  return "source_reported";
}

function legacySourceBasis(
  item: SourceIntelligenceItem,
): NormalizedSourceItem["sourceBasis"] {
  if (item.sourceBasis === "official_source") return "official_source";
  if (item.sourceBasis === "multi_source") return "multiple_public_sources";
  if (item.sourceBasis === "dataset_record") return "manual_sample";
  return "single_public_source";
}

function legacyExtractionMethod(
  item: SourceIntelligenceItem,
): NormalizedSourceItem["extractionMethod"] {
  if (item.extractionMethod === "rss_summary") return "rss_summary";
  if (item.extractionMethod === "api_payload") return "api_result";
  if (item.extractionMethod === "dataset_record") return "manual_sample";
  if (item.extractionMethod === "script_import") return "manual_sample";
  return "keyword_match";
}

function toLegacyItem(item: SourceIntelligenceItem): NormalizedSourceItem {
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    title: item.title,
    summary: item.summary ?? "",
    url: item.url ?? "",
    publishedAt: item.publishedAt ?? "",
    collectedAt: item.collectedAt ?? "",
    sourceType: legacySourceType(item),
    sourceStatus:
      item.sourceType === "official_government"
        ? "official_government"
        : item.sourceType === "conflict_dataset"
          ? "reference_dataset"
          : "public_news_source",
    verificationStatus: legacyVerificationStatus(item),
    sourceBasis: legacySourceBasis(item),
    extractionMethod: legacyExtractionMethod(item),
    sourceLanguage: item.language as NormalizedSourceItem["sourceLanguage"],
    relatedCountries: item.mentionedCountries ?? [],
    relatedRegions: [],
    category: item.legacyCategory ?? "Source Intelligence",
    isSample: false,
    sourceProfile:
      item.sourceType === "official_government"
        ? "official_diplomatic"
        : item.sourceType === "crisis_humanitarian" ||
            item.sourceType === "conflict_dataset"
          ? "conflict_crisis"
          : "general_news",
    markerLocationStrategy: item.locationHint
      ? "item_location"
      : item.sourceType === "official_government"
        ? "source_location"
        : "item_location",
    sourceLocationForMarker: item.locationHint
      ? {
          lat: item.locationHint.latitude,
          lng: item.locationHint.longitude,
          locationName: item.locationHint.label,
        }
      : undefined,
  };
}

export function RssPreviewProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useRssPreviewStore(): RssPreviewStore {
  const sourceStore = useSourceIntelligenceStore();

  return useMemo(() => {
    const itemsBySourceId: Record<string, NormalizedSourceItem[]> = {};
    for (const [sourceId, items] of Object.entries(sourceStore.itemsBySourceId)) {
      itemsBySourceId[sourceId] = items.map(toLegacyItem);
    }

    return {
      itemsBySourceId,
      collectedAtBySourceId: sourceStore.collectedAtBySourceId,
      loadingBySourceId: sourceStore.loadingBySourceId,
      errorBySourceId: sourceStore.errorBySourceId,
      combinedItems: sourceStore.combinedItems.map(toLegacyItem),
      previewSource: sourceStore.previewSource,
    };
  }, [
    sourceStore.collectedAtBySourceId,
    sourceStore.combinedItems,
    sourceStore.errorBySourceId,
    sourceStore.itemsBySourceId,
    sourceStore.loadingBySourceId,
    sourceStore.previewSource,
  ]);
}
