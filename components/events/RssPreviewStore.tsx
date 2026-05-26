"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import { shouldExcludeFromSourceFeed } from "@/lib/sources/sourceFeedFilter";

export const RSS_PREVIEW_DEFAULT_SOURCE_IDS = [
  "gdelt-geopolitical",
  "reliefweb-crises",
  "guardian-world",
  "trt-haber-dunya",
  "aljazeera-middle-east",
  "bbc-turkce",
  "dw-turkce",
  "crisis-group-crisiswatch",
] as const;

const SOURCE_FEED_CACHE_KEY = "taipanmonitor-source-feed-cache-v1";
const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

interface SourceFeedApiResponse {
  sourceId: string;
  items?: NormalizedSourceItem[];
  collectedAt?: string;
  error?: string;
}

interface StoredSourceFeedCache {
  itemsBySourceId: Record<string, NormalizedSourceItem[]>;
  collectedAtBySourceId: Record<string, string>;
}

export interface RssPreviewStore {
  itemsBySourceId: Record<string, NormalizedSourceItem[]>;
  collectedAtBySourceId: Record<string, string>;
  loadingBySourceId: Record<string, boolean>;
  errorBySourceId: Record<string, string | null>;
  combinedItems: NormalizedSourceItem[];
  previewSource: (sourceId: string) => Promise<void>;
}

const RssPreviewContext = createContext<RssPreviewStore | null>(null);

function readStoredCache(): StoredSourceFeedCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SOURCE_FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSourceFeedCache>;
    return {
      itemsBySourceId:
        parsed.itemsBySourceId && typeof parsed.itemsBySourceId === "object"
          ? parsed.itemsBySourceId
          : {},
      collectedAtBySourceId:
        parsed.collectedAtBySourceId && typeof parsed.collectedAtBySourceId === "object"
          ? parsed.collectedAtBySourceId
          : {},
    };
  } catch {
    return null;
  }
}

export function RssPreviewProvider({ children }: { children: React.ReactNode }) {
  const [itemsBySourceId, setItemsBySourceId] = useState<
    Record<string, NormalizedSourceItem[]>
  >({});
  const [collectedAtBySourceId, setCollectedAtBySourceId] = useState<
    Record<string, string>
  >({});
  const [loadingBySourceId, setLoadingBySourceId] = useState<
    Record<string, boolean>
  >({});
  const [errorBySourceId, setErrorBySourceId] = useState<
    Record<string, string | null>
  >({});

  const combinedItems = useMemo(() => {
    const merged = Object.values(itemsBySourceId).flat();
    merged.sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0;
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return merged;
  }, [itemsBySourceId]);

  const previewSource = useCallback(async (sourceId: string) => {
    setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: true }));
    setErrorBySourceId((prev) => ({ ...prev, [sourceId]: null }));

    try {
      const endpoint = sourceId.startsWith("gdelt-")
        ? `/api/sources/gdelt`
        : sourceId.startsWith("guardian-")
        ? `/api/sources/guardian`
        : `/api/sources/rss-preview?sourceId=${encodeURIComponent(sourceId)}`;

      const res = await fetch(endpoint, { cache: "no-store" });
      let data: SourceFeedApiResponse;

      try {
        data = await res.json();
      } catch {
        throw new Error(res.ok ? "parse_failed" : `upstream_${res.status}`);
      }

      if (data.error) throw new Error(data.error);

      const items = Array.isArray(data.items)
        ? data.items.filter((item) => !shouldExcludeFromSourceFeed(item))
        : [];
      setItemsBySourceId((prev) => ({ ...prev, [sourceId]: items }));
      setCollectedAtBySourceId((prev) => ({
        ...prev,
        [sourceId]: data.collectedAt ?? new Date().toISOString(),
      }));
    } catch (err) {
      setErrorBySourceId((prev) => ({
        ...prev,
        [sourceId]: err instanceof Error ? err.message : "fetch_error",
      }));
    } finally {
      setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: false }));
    }
  }, []);

  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    const cached = readStoredCache();
    if (!cached) return;

    setItemsBySourceId(cached.itemsBySourceId);
    setCollectedAtBySourceId(cached.collectedAtBySourceId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: StoredSourceFeedCache = {
      itemsBySourceId,
      collectedAtBySourceId,
    };

    try {
      window.localStorage.setItem(SOURCE_FEED_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota/storage failures; runtime state remains authoritative.
    }
  }, [itemsBySourceId, collectedAtBySourceId]);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    for (const sourceId of RSS_PREVIEW_DEFAULT_SOURCE_IDS) {
      void previewSource(sourceId);
    }
  }, [previewSource]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const sourceId of RSS_PREVIEW_DEFAULT_SOURCE_IDS) {
        void previewSource(sourceId);
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [previewSource]);

  const value = useMemo<RssPreviewStore>(
    () => ({
      itemsBySourceId,
      collectedAtBySourceId,
      loadingBySourceId,
      errorBySourceId,
      combinedItems,
      previewSource,
    }),
    [
      itemsBySourceId,
      collectedAtBySourceId,
      loadingBySourceId,
      errorBySourceId,
      combinedItems,
      previewSource,
    ],
  );

  return (
    <RssPreviewContext.Provider value={value}>
      {children}
    </RssPreviewContext.Provider>
  );
}

export function useRssPreviewStore(): RssPreviewStore {
  const ctx = useContext(RssPreviewContext);
  if (!ctx) {
    throw new Error(
      "useRssPreviewStore must be used within a <RssPreviewProvider>.",
    );
  }
  return ctx;
}
