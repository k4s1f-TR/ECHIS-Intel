"use client";

import { useMemo } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import {
  RSS_PREVIEW_DEFAULT_SOURCE_IDS,
  useRssPreviewStore,
} from "./RssPreviewStore";

export type RssLoadState = "loading" | "loaded" | "partial" | "error";

export interface UseRssPreviewResult {
  items: NormalizedSourceItem[];
  loadState: RssLoadState;
}

/**
 * Maximum age of a source item for Global View display and marker generation.
 * Items older than this are excluded from the live feed and marker flow.
 * Sources panel is not affected because it reads itemsBySourceId directly.
 */
const GLOBAL_VIEW_MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function useRssPreviewItems(): UseRssPreviewResult {
  const {
    combinedItems,
    loadingBySourceId,
    errorBySourceId,
    itemsBySourceId,
  } = useRssPreviewStore();

  const loadState = useMemo((): RssLoadState => {
    const isAnyLoading = RSS_PREVIEW_DEFAULT_SOURCE_IDS.some(
      (id) => loadingBySourceId[id] ?? false,
    );
    const isAnyError = RSS_PREVIEW_DEFAULT_SOURCE_IDS.some(
      (id) => (errorBySourceId[id] ?? null) !== null,
    );
    const hasAnyItems = combinedItems.length > 0;
    const hasAllSources = RSS_PREVIEW_DEFAULT_SOURCE_IDS.every(
      (id) => itemsBySourceId[id] !== undefined,
    );

    if (!hasAnyItems && !isAnyError && !isAnyLoading) return "loading";
    if (isAnyLoading && !hasAnyItems) return "loading";
    if (!isAnyLoading && !hasAnyItems) return "error";
    if (hasAnyItems && (isAnyError || !hasAllSources)) return "partial";
    return "loaded";
  }, [combinedItems, loadingBySourceId, errorBySourceId, itemsBySourceId]);

  const freshItems = useMemo((): NormalizedSourceItem[] => {
    return combinedItems.filter((item) => {
      if (!item.publishedAt || !item.collectedAt) return true;
      const published = new Date(item.publishedAt).getTime();
      const collected = new Date(item.collectedAt).getTime();
      if (Number.isNaN(published) || Number.isNaN(collected)) return true;
      return collected - published < GLOBAL_VIEW_MAX_ITEM_AGE_MS;
    });
  }, [combinedItems]);

  return { items: freshItems, loadState };
}
