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
import {
  activeSourceRegistry,
  getSourceDefinition,
  SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS,
} from "@/data/source-intelligence/sourceRegistry";
import { getSourceAdapter } from "@/data/source-intelligence/sourceAdapters";
import {
  runSourceIntelligencePipeline,
} from "@/data/source-intelligence/sourceIntelligencePipeline";
import { sourceItemsToMarkers } from "@/data/source-intelligence/markers/sourceItemsToMarkers";
import type {
  IntelligenceEventCandidate,
  NormalizedSourceItem,
  SourceDefinition,
  SourceFilterResult,
} from "@/data/source-intelligence/sourceIntelligenceTypes";
import type { SourceMarkerFeature } from "@/data/source-intelligence/markers/sourceMarkerTypes";

export type SourceIntelligenceLoadState =
  | "loading"
  | "loaded"
  | "partial"
  | "error";

export interface SourceIntelligenceStore {
  sources: SourceDefinition[];
  itemsBySourceId: Record<string, NormalizedSourceItem[]>;
  collectedAtBySourceId: Record<string, string>;
  loadingBySourceId: Record<string, boolean>;
  errorBySourceId: Record<string, string | null>;
  combinedItems: NormalizedSourceItem[];
  filterResults: SourceFilterResult<NormalizedSourceItem>[];
  eventCandidates: IntelligenceEventCandidate[];
  markerCandidates: SourceMarkerFeature[];
  loadState: SourceIntelligenceLoadState;
  previewSource: (sourceId: string) => Promise<void>;
}

const SourceIntelligenceContext =
  createContext<SourceIntelligenceStore | null>(null);

function sortByPublishedDesc<T extends { publishedAt?: string; collectedAt?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.publishedAt ?? a.collectedAt ?? 0).getTime();
    const bTime = new Date(b.publishedAt ?? b.collectedAt ?? 0).getTime();
    return bTime - aTime;
  });
}

export function SourceIntelligenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const previewSource = useCallback(async (sourceId: string) => {
    const source = getSourceDefinition(sourceId);
    if (!source) {
      setErrorBySourceId((prev) => ({ ...prev, [sourceId]: "unknown_source" }));
      return;
    }

    setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: true }));
    setErrorBySourceId((prev) => ({ ...prev, [sourceId]: null }));

    try {
      const adapter = getSourceAdapter(source);
      const rawItems = await adapter.fetchItems(source);
      const normalizedItems = rawItems.map((raw) =>
        adapter.normalizeItem(raw, source),
      );
      const collectedAt = new Date().toISOString();

      setItemsBySourceId((prev) => ({
        ...prev,
        [sourceId]: normalizedItems,
      }));
      setCollectedAtBySourceId((prev) => ({
        ...prev,
        [sourceId]: collectedAt,
      }));
    } catch (error) {
      setErrorBySourceId((prev) => ({
        ...prev,
        [sourceId]: error instanceof Error ? error.message : "fetch_error",
      }));
      setItemsBySourceId((prev) => ({
        ...prev,
        [sourceId]: prev[sourceId] ?? [],
      }));
    } finally {
      setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: false }));
    }
  }, []);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    for (const source of activeSourceRegistry) {
      void previewSource(source.id);
    }
  }, [previewSource]);

  const combinedItems = useMemo(
    () => sortByPublishedDesc(Object.values(itemsBySourceId).flat()),
    [itemsBySourceId],
  );

  const pipeline = useMemo(
    () =>
      runSourceIntelligencePipeline(combinedItems, (sourceId) =>
        getSourceDefinition(sourceId),
      ),
    [combinedItems],
  );

  const markerCandidates = useMemo(
    () => sourceItemsToMarkers(pipeline.eventCandidates),
    [pipeline.eventCandidates],
  );

  const loadState = useMemo((): SourceIntelligenceLoadState => {
    const ids = SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS;
    const isAnyLoading = ids.some((id) => loadingBySourceId[id] ?? false);
    const isAnyError = ids.some((id) => (errorBySourceId[id] ?? null) !== null);
    const hasAnyItems = pipeline.eventCandidates.length > 0;
    const hasAnySourceResponse = ids.some(
      (id) => itemsBySourceId[id] !== undefined || errorBySourceId[id],
    );
    const hasAllSourceResponses = ids.every(
      (id) => itemsBySourceId[id] !== undefined || errorBySourceId[id],
    );

    if (!hasAnySourceResponse || (isAnyLoading && !hasAnyItems)) return "loading";
    if (!hasAnyItems && !isAnyLoading) return "error";
    if (hasAnyItems && (isAnyError || !hasAllSourceResponses)) return "partial";
    return "loaded";
  }, [errorBySourceId, itemsBySourceId, loadingBySourceId, pipeline.eventCandidates.length]);

  const value = useMemo<SourceIntelligenceStore>(
    () => ({
      sources: activeSourceRegistry,
      itemsBySourceId,
      collectedAtBySourceId,
      loadingBySourceId,
      errorBySourceId,
      combinedItems,
      filterResults: pipeline.filterResults,
      eventCandidates: pipeline.eventCandidates,
      markerCandidates,
      loadState,
      previewSource,
    }),
    [
      combinedItems,
      collectedAtBySourceId,
      errorBySourceId,
      itemsBySourceId,
      loadState,
      loadingBySourceId,
      markerCandidates,
      pipeline.eventCandidates,
      pipeline.filterResults,
      previewSource,
    ],
  );

  return (
    <SourceIntelligenceContext.Provider value={value}>
      {children}
    </SourceIntelligenceContext.Provider>
  );
}

export function useSourceIntelligenceStore(): SourceIntelligenceStore {
  const ctx = useContext(SourceIntelligenceContext);
  if (!ctx) {
    throw new Error(
      "useSourceIntelligenceStore must be used within a <SourceIntelligenceProvider>.",
    );
  }
  return ctx;
}
