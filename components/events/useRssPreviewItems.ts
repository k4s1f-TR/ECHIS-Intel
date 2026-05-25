"use client";

/**
 * useRssPreviewItems — thin consumer hook over the shared RssPreviewStore.
 *
 * Previously this hook owned its own fetch lifecycle.  It now reads from the
 * centrally managed RssPreviewStore so that:
 *   - Sources panel "Preview RSS" refreshes → Global View feed + markers update.
 *   - Global View feed + markers always reflect the same combinedItems array.
 *   - No duplicate network requests for the same source.
 *
 * The hook interface is intentionally unchanged so existing callers
 * (RssGlobalFeedPanel, AppShell) require no modification.
 */

import { useMemo } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import {
  RSS_PREVIEW_DEFAULT_SOURCE_IDS,
  useRssPreviewStore,
} from "./RssPreviewStore";
import { isGlobalViewRelevantRssItem } from "@/lib/sources/rssTopicFilter";

export type RssLoadState = "loading" | "loaded" | "partial" | "error";

export interface UseRssPreviewResult {
  items: NormalizedSourceItem[];
  loadState: RssLoadState;
}

/**
 * Maximum age of an RSS item for Global View display and marker generation.
 * Items older than this are excluded from the live feed and marker flow.
 * Sources panel preview is not affected (it reads itemsBySourceId directly).
 */
const GLOBAL_VIEW_MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useRssPreviewItems(): UseRssPreviewResult {
  const {
    combinedItems,
    loadingBySourceId,
    errorBySourceId,
    itemsBySourceId,
  } = useRssPreviewStore();

  // loadState is computed from the unfiltered combinedItems so that a
  // successful fetch (even if all items happen to be old) is not reported
  // as an error state — the feed just shows empty rather than spinning.
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

    // Before any fetch result arrives (initial render or truly empty) treat
    // as loading so the feed skeleton shows immediately.
    if (!hasAnyItems && !isAnyError && !isAnyLoading) return "loading";
    if (isAnyLoading && !hasAnyItems) return "loading";
    if (!isAnyLoading && !hasAnyItems) return "error";
    if (hasAnyItems && (isAnyError || !hasAllSources)) return "partial";
    return "loaded";
  }, [combinedItems, loadingBySourceId, errorBySourceId, itemsBySourceId]);

  // Apply recency filter for Global View and RSS marker flow.
  //
  // We compare publishedAt against the item's own collectedAt (the server
  // timestamp set at fetch time) rather than Date.now() so the computation
  // is pure — it depends only on item data, not on wall-clock time during
  // render. Semantically: "was this item fresh when the feed was collected?"
  //
  // Items without parseable dates are kept (unknown date ≠ stale).
  const freshItems = useMemo((): NormalizedSourceItem[] => {
    return combinedItems.filter((item) => {
      if (!item.publishedAt || !item.collectedAt) return true;
      const published = new Date(item.publishedAt).getTime();
      const collected = new Date(item.collectedAt).getTime();
      if (Number.isNaN(published) || Number.isNaN(collected)) return true;
      return collected - published < GLOBAL_VIEW_MAX_ITEM_AGE_MS;
    });
  }, [combinedItems]);

  // Apply Global View topic filter after recency filter.
  // Keeps only items relevant to diplomacy, foreign policy, defense/public
  // institutions, international system, and conflict diplomacy.
  // Sources panel is not affected (it reads itemsBySourceId directly from
  // the store, bypassing this hook entirely).
  const topicItems = useMemo(
    () => freshItems.filter(isGlobalViewRelevantRssItem),
    [freshItems],
  );

  return { items: topicItems, loadState };
}
