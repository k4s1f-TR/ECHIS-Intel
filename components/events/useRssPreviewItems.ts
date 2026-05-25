"use client";

import { useEffect, useState } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";

// ---------------------------------------------------------------------------
// Shared RSS preview fetch hook.
//
// Fetches preview items from both candidate RSS sources on mount, merges them,
// and sorts by publishedAt descending.  Shared between RssGlobalFeedPanel
// (feed list) and AppShell (globe markers) so the same data drives both
// surfaces without duplicating fetch logic.
//
// Preview-only: items are not persisted, stored, or used outside of the
// Global View screen.
// ---------------------------------------------------------------------------

const PREVIEW_SOURCE_IDS = ["trt-haber-dunya", "aljazeera-middle-east"] as const;

interface RssPreviewApiResponse {
  sourceId: string;
  items?: NormalizedSourceItem[];
  error?: string;
  previewOnly: boolean;
}

async function fetchSourceItems(sourceId: string): Promise<NormalizedSourceItem[]> {
  const res = await fetch(
    `/api/sources/rss-preview?sourceId=${encodeURIComponent(sourceId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const data: RssPreviewApiResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return Array.isArray(data.items) ? data.items : [];
}

export type RssLoadState = "loading" | "loaded" | "partial" | "error";

export interface UseRssPreviewResult {
  items: NormalizedSourceItem[];
  loadState: RssLoadState;
}

export function useRssPreviewItems(): UseRssPreviewResult {
  const [items, setItems] = useState<NormalizedSourceItem[]>([]);
  const [loadState, setLoadState] = useState<RssLoadState>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled(PREVIEW_SOURCE_IDS.map(fetchSourceItems)).then((results) => {
      if (cancelled) return;

      const merged: NormalizedSourceItem[] = [];
      let succeeded = 0;

      for (const result of results) {
        if (result.status === "fulfilled") {
          merged.push(...result.value);
          succeeded++;
        }
      }

      if (succeeded === 0) {
        setLoadState("error");
        return;
      }

      merged.sort((a, b) => {
        if (!a.publishedAt && !b.publishedAt) return 0;
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return b.publishedAt.localeCompare(a.publishedAt);
      });

      setItems(merged);
      setLoadState(succeeded < PREVIEW_SOURCE_IDS.length ? "partial" : "loaded");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loadState };
}
