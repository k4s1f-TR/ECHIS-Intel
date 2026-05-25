"use client";

/**
 * RssPreviewStore — app-level RSS preview runtime state.
 *
 * Single source of truth for all RSS preview items.  Both the Global View
 * Live Feed / marker system and the Sources panel "Preview RSS" button read
 * from and write to this store.
 *
 * Why a context and not a module-level singleton:
 *   - Respects React's rendering lifecycle (SSR / strict-mode safe).
 *   - Keeps the state inside the React tree so hot reload and tests work.
 *
 * What lives here:
 *   - itemsBySourceId      — latest fetched items per source (raw, limited by API)
 *   - collectedAtBySourceId — timestamp of the last successful fetch per source
 *   - loadingBySourceId    — per-source loading flag
 *   - errorBySourceId      — per-source error message (null when ok)
 *   - combinedItems        — sorted merge of all sources (used by feed + markers)
 *   - previewSource(id)    — shared fetch action (Sources panel & auto-load)
 *
 * Auto-load:
 *   On mount the provider automatically fetches all current candidate RSS
 *   preview sources (RSS_PREVIEW_DEFAULT_SOURCE_IDS) so Global View has
 *   fresh data even before the user visits the Sources screen.
 */

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Sources auto-fetched on Global View mount (initial bootstrap).
 * Official diplomatic sources are excluded here — they are available in
 * Sources panel Preview RSS but are not loaded automatically on every
 * page load (their volume and rate of change are different from news feeds).
 * Must stay in sync with the allow-list in app/api/sources/rss-preview/route.ts.
 */
export const RSS_PREVIEW_DEFAULT_SOURCE_IDS = [
  // General news (Turkish + English)
  "trt-haber-dunya",
  "aljazeera-middle-east",
  "bbc-turkce",
  "dw-turkce",
  // Conflict / crisis
  "crisis-group-crisiswatch",
] as const;

// ---------------------------------------------------------------------------
// API response shape (mirrors rss-preview route)
// ---------------------------------------------------------------------------

interface RssPreviewApiResponse {
  sourceId: string;
  items?: NormalizedSourceItem[];
  collectedAt?: string;
  error?: string;
  previewOnly: boolean;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface RssPreviewStore {
  /** Per-source items from the last successful fetch. */
  itemsBySourceId: Record<string, NormalizedSourceItem[]>;
  /** ISO timestamp of the last successful fetch for each source. */
  collectedAtBySourceId: Record<string, string>;
  /** True while a fetch is in flight for that source. */
  loadingBySourceId: Record<string, boolean>;
  /** Non-null error message if the last fetch for a source failed. */
  errorBySourceId: Record<string, string | null>;
  /**
   * Merged, publishedAt-descending view of all fetched items.
   * This is the canonical input for the Global View feed and marker adapter.
   */
  combinedItems: NormalizedSourceItem[];
  /**
   * Trigger an RSS preview fetch for a specific source.
   * Updates all per-source fields and recomputes combinedItems.
   * Safe to call from both Sources panel and auto-load.
   */
  previewSource: (sourceId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RssPreviewContext = createContext<RssPreviewStore | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

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

  // Merge all per-source item arrays into one chronological feed.
  const combinedItems = useMemo(() => {
    const merged = Object.values(itemsBySourceId).flat();
    merged.sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0;
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      // Numeric timestamp comparison — locale-independent and unambiguous
      // for ISO 8601 strings where localeCompare could be locale-sensitive.
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return merged;
  }, [itemsBySourceId]);

  // Shared fetch action — stable reference (setters from useState are stable).
  const previewSource = useCallback(async (sourceId: string) => {
    setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: true }));
    setErrorBySourceId((prev) => ({ ...prev, [sourceId]: null }));
    try {
      const res = await fetch(
        `/api/sources/rss-preview?sourceId=${encodeURIComponent(sourceId)}`,
        { cache: "no-store" },
      );
      // Always read the JSON body first — our error responses carry a
      // structured `error` / `reason` code even when HTTP status is non-2xx
      // (the route returns 502 for any upstream failure).
      // Fall back to a status-based code only when the body is not JSON
      // (e.g. a CDN or network proxy returned an HTML error page).
      let data: RssPreviewApiResponse;
      try {
        data = await res.json();
      } catch {
        // Body is not JSON: use HTTP status as the fallback reason code.
        throw new Error(res.ok ? "parse_failed" : `upstream_${res.status}`);
      }
      // Structured error from our API (reason code set by route.ts catch).
      if (data.error) throw new Error(data.error);
      const items = Array.isArray(data.items) ? data.items : [];
      setItemsBySourceId((prev) => ({ ...prev, [sourceId]: items }));
      setCollectedAtBySourceId((prev) => ({
        ...prev,
        [sourceId]: data.collectedAt ?? new Date().toISOString(),
      }));
    } catch (err) {
      setErrorBySourceId((prev) => ({
        ...prev,
        [sourceId]:
          err instanceof Error ? err.message : "fetch_error",
      }));
    } finally {
      setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: false }));
    }
  }, []);

  // Auto-load default Global View sources exactly once on provider mount.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    for (const sourceId of RSS_PREVIEW_DEFAULT_SOURCE_IDS) {
      void previewSource(sourceId);
    }
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRssPreviewStore(): RssPreviewStore {
  const ctx = useContext(RssPreviewContext);
  if (!ctx) {
    throw new Error(
      "useRssPreviewStore must be used within a <RssPreviewProvider>.",
    );
  }
  return ctx;
}
