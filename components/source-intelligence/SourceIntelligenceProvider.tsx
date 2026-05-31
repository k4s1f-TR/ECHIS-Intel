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
import { logSourceIntelProfile } from "@/data/source-intelligence/pipelineProfiling";
import { runSourceIntelligencePipeline } from "@/data/source-intelligence/sourceIntelligencePipeline";
import { sourceItemsToMarkers } from "@/data/source-intelligence/markers/sourceItemsToMarkers";
import {
  USE_PIPELINE_WORKER,
  type WorkerRequest,
  type WorkerResponse,
} from "@/data/source-intelligence/pipelineWorkerMessages";
import type {
  IntelligenceEventCandidate,
  NormalizedSourceItem,
  SourceDefinition,
  SourceFilterResult,
  SourcePipelineProfile,
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

const PIPELINE_BATCH_SIZE = 100;
const SLOW_SOURCE_FETCH_MS = 3000;

function itemTime(item: { publishedAt?: string; collectedAt?: string }): number {
  return new Date(item.publishedAt ?? item.collectedAt ?? 0).getTime();
}

function sortByPublishedDesc<
  T extends { publishedAt?: string; collectedAt?: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => itemTime(b) - itemTime(a));
}

function sortFilterResultsByPublishedDesc(
  results: SourceFilterResult<NormalizedSourceItem>[],
): SourceFilterResult<NormalizedSourceItem>[] {
  return [...results].sort((a, b) => itemTime(b.item) - itemTime(a.item));
}

function stableItemKey(item: NormalizedSourceItem): string {
  if (item.id) return `id:${item.id}`;
  if (item.url) return `url:${item.url.trim().toLowerCase()}`;
  return [
    "fallback",
    item.sourceId,
    item.title.trim().toLowerCase(),
    item.publishedAt ?? item.collectedAt ?? "",
  ].join(":");
}

function mergeFilterResults(
  map: Map<string, SourceFilterResult<NormalizedSourceItem>>,
  results: SourceFilterResult<NormalizedSourceItem>[],
) {
  const next = new Map(map);
  for (const result of results) next.set(stableItemKey(result.item), result);
  return next;
}

function mergeEventCandidates(
  map: Map<string, IntelligenceEventCandidate>,
  candidates: IntelligenceEventCandidate[],
) {
  const next = new Map(map);
  for (const candidate of candidates) next.set(candidate.id, candidate);
  return next;
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

  const [filterResults, setFilterResults] = useState<
    SourceFilterResult<NormalizedSourceItem>[]
  >([]);
  const [eventCandidates, setEventCandidates] = useState<
    IntelligenceEventCandidate[]
  >([]);
  const [markerCandidates, setMarkerCandidates] = useState<
    SourceMarkerFeature[]
  >([]);

  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const runIdRef = useRef(0);
  const batchIdRef = useRef(0);
  const pendingItemsRef = useRef<NormalizedSourceItem[]>([]);
  const processingBatchRef = useRef(false);
  const seenItemKeysRef = useRef(new Set<string>());
  const sourceItemKeysBySourceRef = useRef(new Map<string, Set<string>>());
  const filterResultMapRef = useRef(
    new Map<string, SourceFilterResult<NormalizedSourceItem>>(),
  );
  const eventCandidateMapRef = useRef(
    new Map<string, IntelligenceEventCandidate>(),
  );
  const sourceStartAtRef = useRef(performance.now());
  const firstAcceptedLoggedRef = useRef(false);
  const firstMarkerLoggedRef = useRef(false);

  const publishMergedResults = useCallback(
    (
      label: string,
      batchId?: number,
      batchItemCount = 0,
      batchPerfMs = 0,
      batchProfile?: SourcePipelineProfile,
    ) => {
      const mergedFilters = sortFilterResultsByPublishedDesc([
        ...filterResultMapRef.current.values(),
      ]);
      const mergedEvents = sortByPublishedDesc([
        ...eventCandidateMapRef.current.values(),
      ]);
      const markersStart = performance.now();
      const markers = sourceItemsToMarkers(mergedEvents);
      const sourceItemsToMarkersMs = performance.now() - markersStart;
      const elapsedMs = performance.now() - sourceStartAtRef.current;
      const acceptedCount = mergedFilters.filter((item) => item.accepted).length;
      const feedOnlyCount = mergedEvents.filter(
        (item) => item.markerEligibility === "feed_only",
      ).length;
      const rejectedCount = mergedFilters.filter((item) => !item.accepted).length;
      const markerEligibleCount = mergedEvents.filter(
        (item) => item.markerEligibility === "eligible",
      ).length;
      const needsLocationCount = mergedEvents.filter(
        (item) => item.markerEligibility === "needs_location",
      ).length;

      setFilterResults(mergedFilters);
      setEventCandidates(mergedEvents);
      setMarkerCandidates(markers);

      if (acceptedCount > 0 && !firstAcceptedLoggedRef.current) {
        firstAcceptedLoggedRef.current = true;
        logSourceIntelProfile("progressive first accepted", {
          totalMs: elapsedMs,
          itemCount: seenItemKeysRef.current.size,
        });
      }
      if (markers.length > 0 && !firstMarkerLoggedRef.current) {
        firstMarkerLoggedRef.current = true;
        logSourceIntelProfile("progressive first marker", {
          totalMs: elapsedMs,
          itemCount: seenItemKeysRef.current.size,
          markerEligibleCount,
        });
      }

      logSourceIntelProfile(label, {
        itemCount: seenItemKeysRef.current.size,
        freshItemCount: mergedFilters.length,
        cheapPrefilterRejectedCount:
          batchProfile?.cheapPrefilterRejectedCount ?? 0,
        fullContextProcessedCount:
          batchProfile?.fullContextProcessedCount ?? 0,
        geoProcessedCount: batchProfile?.geoProcessedCount ?? 0,
        feedOnlyCount,
        rejectedCount,
        markerEligibleCount,
        sourceItemsToMarkersMs,
        totalMs: elapsedMs,
        batchId,
        batchItemCount,
        batchPerfMs,
        acceptedCount,
        needsLocationCount,
        markerCount: markers.length,
        pendingItemCount: pendingItemsRef.current.length,
      });
    },
    [],
  );

  const handlePipelineResult = useCallback(
    (msg: Extract<WorkerResponse, { type: "PIPELINE_RESULT" }>) => {
      if (msg.runId !== runIdRef.current) return;
      const liveFilterResults = msg.filterResults.filter((result) =>
        seenItemKeysRef.current.has(stableItemKey(result.item)),
      );
      const liveEventCandidates = msg.eventCandidates.filter((candidate) =>
        seenItemKeysRef.current.has(stableItemKey(candidate.item)),
      );
      filterResultMapRef.current = mergeFilterResults(
        filterResultMapRef.current,
        liveFilterResults,
      );
      eventCandidateMapRef.current = mergeEventCandidates(
        eventCandidateMapRef.current,
        liveEventCandidates,
      );
      publishMergedResults(
        `progressive merge batch ${msg.batchId}`,
        msg.batchId,
        msg.itemCount,
        msg.perfMs,
        msg.profile,
      );
    },
    [publishMergedResults],
  );

  const processQueue = useCallback(() => {
    if (processingBatchRef.current) return;
    if (pendingItemsRef.current.length === 0) return;
    if (USE_PIPELINE_WORKER && !workerReadyRef.current) return;

    const batch = pendingItemsRef.current.splice(0, PIPELINE_BATCH_SIZE);
    const runId = runIdRef.current;
    const batchId = ++batchIdRef.current;
    processingBatchRef.current = true;

    if (USE_PIPELINE_WORKER) {
      workerRef.current?.postMessage({
        type: "RUN_PIPELINE",
        normalizedItems: batch,
        runId,
        batchId,
      } satisfies WorkerRequest);
      return;
    }

    try {
      const t0 = performance.now();
      const result = runSourceIntelligencePipeline(batch, getSourceDefinition);
      const perfMs = performance.now() - t0;
      handlePipelineResult({
        type: "PIPELINE_RESULT",
        runId,
        batchId,
        itemCount: batch.length,
        filterResults: result.filterResults,
        eventCandidates: result.eventCandidates,
        markerCandidates: sourceItemsToMarkers(result.eventCandidates),
        perfMs,
        profile: {
          ...result.profile,
          sourceItemsToMarkersMs: 0,
          totalMs: perfMs,
        },
      });
    } catch (error) {
      console.error("[pipeline-worker] sync fallback error:", error);
    } finally {
      processingBatchRef.current = false;
      window.setTimeout(processQueue, 0);
    }
  }, [handlePipelineResult]);

  const enqueueItems = useCallback(
    (items: NormalizedSourceItem[], sourceId: string) => {
      const newItems: NormalizedSourceItem[] = [];
      for (const item of items) {
        const key = stableItemKey(item);
        if (seenItemKeysRef.current.has(key)) continue;
        seenItemKeysRef.current.add(key);
        newItems.push(item);
      }

      if (newItems.length === 0) {
        logSourceIntelProfile(`progressive enqueue ${sourceId}`, {
          itemCount: seenItemKeysRef.current.size,
          batchItemCount: 0,
          pendingItemCount: pendingItemsRef.current.length,
        });
        return;
      }

      pendingItemsRef.current.push(...newItems);
      logSourceIntelProfile(`progressive enqueue ${sourceId}`, {
        itemCount: seenItemKeysRef.current.size,
        batchItemCount: newItems.length,
        pendingItemCount: pendingItemsRef.current.length,
      });
      processQueue();
    },
    [processQueue],
  );

  const pruneRemovedSourceItems = useCallback(
    (sourceId: string, nextItems: NormalizedSourceItem[]) => {
      const previousKeys = sourceItemKeysBySourceRef.current.get(sourceId);
      const nextKeys = new Set(nextItems.map(stableItemKey));
      sourceItemKeysBySourceRef.current.set(sourceId, nextKeys);
      if (!previousKeys) return;

      let removedCount = 0;
      for (const key of previousKeys) {
        if (nextKeys.has(key)) continue;
        removedCount += 1;
        seenItemKeysRef.current.delete(key);
        filterResultMapRef.current.delete(key);
        pendingItemsRef.current = pendingItemsRef.current.filter(
          (item) => stableItemKey(item) !== key,
        );
        for (const [candidateId, candidate] of eventCandidateMapRef.current) {
          if (stableItemKey(candidate.item) === key) {
            eventCandidateMapRef.current.delete(candidateId);
          }
        }
      }

      if (removedCount > 0) {
        publishMergedResults(`progressive prune ${sourceId}`);
      }
    },
    [publishMergedResults],
  );

  const previewSource = useCallback(
    async (sourceId: string) => {
      const source = getSourceDefinition(sourceId);
      if (!source) {
        setErrorBySourceId((prev) => ({
          ...prev,
          [sourceId]: "unknown_source",
        }));
        return;
      }

      const runId = runIdRef.current;
      setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: true }));
      setErrorBySourceId((prev) => ({ ...prev, [sourceId]: null }));

      try {
        const adapter = getSourceAdapter(source);
        const fetchStart = performance.now();
        const rawItems = await adapter.fetchItems(source);
        const sourceFetchMs = performance.now() - fetchStart;
        const normalizeStart = performance.now();
        const normalizedItems = rawItems.map((raw) =>
          adapter.normalizeItem(raw, source),
        );
        const normalizeMs = performance.now() - normalizeStart;

        if (runId !== runIdRef.current) return;

        logSourceIntelProfile(`source ${source.id}`, {
          itemCount: rawItems.length,
          sourceFetchMs,
          normalizeMs,
        });
        if (sourceFetchMs >= SLOW_SOURCE_FETCH_MS) {
          logSourceIntelProfile(`slow source ${source.id}`, {
            itemCount: rawItems.length,
            sourceFetchMs,
          });
        }

        pruneRemovedSourceItems(sourceId, normalizedItems);
        const collectedAt = new Date().toISOString();
        setItemsBySourceId((prev) => ({ ...prev, [sourceId]: normalizedItems }));
        setCollectedAtBySourceId((prev) => ({
          ...prev,
          [sourceId]: collectedAt,
        }));
        enqueueItems(normalizedItems, sourceId);
      } catch (error) {
        if (runId !== runIdRef.current) return;
        setErrorBySourceId((prev) => ({
          ...prev,
          [sourceId]: error instanceof Error ? error.message : "fetch_error",
        }));
        setItemsBySourceId((prev) => ({
          ...prev,
          [sourceId]: prev[sourceId] ?? [],
        }));
      } finally {
        if (runId === runIdRef.current) {
          setLoadingBySourceId((prev) => ({ ...prev, [sourceId]: false }));
        }
      }
    },
    [enqueueItems, pruneRemovedSourceItems],
  );

  useEffect(() => {
    if (!USE_PIPELINE_WORKER) return;

    const worker = new Worker(
      new URL(
        "../../data/source-intelligence/pipelineWorker.ts",
        import.meta.url,
      ),
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;

      if (msg.type === "WORKER_READY") {
        workerReadyRef.current = true;
        processQueue();
        return;
      }

      if (msg.type === "PIPELINE_RESULT") {
        if (msg.runId !== runIdRef.current) return;
        handlePipelineResult(msg);
        processingBatchRef.current = false;
        processQueue();
        return;
      }

      if (msg.type === "PIPELINE_ERROR") {
        if (msg.runId !== runIdRef.current) return;
        console.error("[pipeline-worker] error:", msg.error);
        processingBatchRef.current = false;
        processQueue();
      }
    };

    worker.onerror = (err) => {
      console.error("[pipeline-worker] uncaught worker error:", err.message);
      processingBatchRef.current = false;
      processQueue();
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      workerReadyRef.current = false;
      pendingItemsRef.current = [];
      processingBatchRef.current = false;
    };
  }, [handlePipelineResult, processQueue]);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    runIdRef.current += 1;
    batchIdRef.current = 0;
    pendingItemsRef.current = [];
    processingBatchRef.current = false;
    seenItemKeysRef.current.clear();
    sourceItemKeysBySourceRef.current.clear();
    filterResultMapRef.current.clear();
    eventCandidateMapRef.current.clear();
    firstAcceptedLoggedRef.current = false;
    firstMarkerLoggedRef.current = false;
    sourceStartAtRef.current = performance.now();
    setFilterResults([]);
    setEventCandidates([]);
    setMarkerCandidates([]);

    logSourceIntelProfile("progressive run start", {
      itemCount: activeSourceRegistry.length,
      batchItemCount: PIPELINE_BATCH_SIZE,
    });

    for (const source of activeSourceRegistry) {
      void previewSource(source.id);
    }
  }, [previewSource]);

  const combinedItems = useMemo(
    () => sortByPublishedDesc(Object.values(itemsBySourceId).flat()),
    [itemsBySourceId],
  );

  const loadState = useMemo((): SourceIntelligenceLoadState => {
    const ids = SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS;
    const isAnyLoading = ids.some((id) => loadingBySourceId[id] ?? false);
    const isAnyError = ids.some((id) => (errorBySourceId[id] ?? null) !== null);
    const hasAnyItems = eventCandidates.length > 0;
    const hasAnySourceResponse = ids.some(
      (id) => itemsBySourceId[id] !== undefined || errorBySourceId[id],
    );
    const hasAllSourceResponses = ids.every(
      (id) => itemsBySourceId[id] !== undefined || errorBySourceId[id],
    );

    if (!hasAnySourceResponse || (isAnyLoading && !hasAnyItems)) {
      return "loading";
    }
    if (!hasAnyItems && !isAnyLoading) return "error";
    if (hasAnyItems && (isAnyError || !hasAllSourceResponses)) return "partial";
    return "loaded";
  }, [
    errorBySourceId,
    itemsBySourceId,
    loadingBySourceId,
    eventCandidates.length,
  ]);

  const value = useMemo<SourceIntelligenceStore>(
    () => ({
      sources: activeSourceRegistry,
      itemsBySourceId,
      collectedAtBySourceId,
      loadingBySourceId,
      errorBySourceId,
      combinedItems,
      filterResults,
      eventCandidates,
      markerCandidates,
      loadState,
      previewSource,
    }),
    [
      combinedItems,
      collectedAtBySourceId,
      errorBySourceId,
      eventCandidates,
      filterResults,
      itemsBySourceId,
      loadState,
      loadingBySourceId,
      markerCandidates,
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
