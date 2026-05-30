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

function sortByPublishedDesc<
  T extends { publishedAt?: string; collectedAt?: string },
>(items: T[]): T[] {
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
  // ── Source fetch state ──────────────────────────────────────────────────────
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

  // ── Pipeline result state ───────────────────────────────────────────────────
  // Populated by the worker (USE_PIPELINE_WORKER = true) or the sync fallback.
  // Replaces the previous pipeline useMemo + markerCandidates useMemo.
  const [filterResults, setFilterResults] = useState<
    SourceFilterResult<NormalizedSourceItem>[]
  >([]);
  const [eventCandidates, setEventCandidates] = useState<
    IntelligenceEventCandidate[]
  >([]);
  const [markerCandidates, setMarkerCandidates] = useState<
    SourceMarkerFeature[]
  >([]);

  // ── Worker refs ─────────────────────────────────────────────────────────────
  const workerRef      = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  /**
   * Items queued before WORKER_READY arrived.
   * Flushed once the worker signals it is ready.
   */
  const pendingItemsRef = useRef<NormalizedSourceItem[] | null>(null);
  /**
   * Monotonic counter — incremented on every RUN_PIPELINE send.
   * PIPELINE_RESULT responses that carry an older runId are dropped.
   */
  const runIdRef = useRef(0);

  // ── previewSource — unchanged from original ─────────────────────────────────
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

      setItemsBySourceId((prev) => ({ ...prev, [sourceId]: normalizedItems }));
      setCollectedAtBySourceId((prev) => ({ ...prev, [sourceId]: collectedAt }));
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

  // ── Initial fetch — unchanged from original ─────────────────────────────────
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    for (const source of activeSourceRegistry) {
      void previewSource(source.id);
    }
  }, [previewSource]);

  // ── sendToWorker — stable callback, accesses only refs ─────────────────────
  const sendToWorker = useCallback((items: NormalizedSourceItem[]) => {
    const worker = workerRef.current;
    if (!worker) return;
    const runId = ++runIdRef.current;
    worker.postMessage({
      type: "RUN_PIPELINE",
      normalizedItems: items,
      runId,
    } satisfies WorkerRequest);
  }, []);

  // ── Worker lifecycle ────────────────────────────────────────────────────────
  // Created once on mount; terminated on unmount.  Not recreated on re-renders.
  // Skipped entirely when USE_PIPELINE_WORKER = false (sync fallback active).
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
        // Flush items queued before the worker finished initialising.
        if (pendingItemsRef.current !== null) {
          sendToWorker(pendingItemsRef.current);
          pendingItemsRef.current = null;
        }
        return;
      }

      if (msg.type === "PIPELINE_RESULT") {
        // Drop stale responses (runId mismatch means a newer send is in flight).
        if (msg.runId !== runIdRef.current) return;

        setFilterResults(msg.filterResults);
        setEventCandidates(msg.eventCandidates);
        setMarkerCandidates(msg.markerCandidates);
        return;
      }

      if (msg.type === "PIPELINE_ERROR") {
        console.error("[pipeline-worker] error:", msg.error);
      }
    };

    worker.onerror = (err) => {
      console.error("[pipeline-worker] uncaught worker error:", err.message);
    };

    return () => {
      worker.terminate();
      workerRef.current    = null;
      workerReadyRef.current = false;
      pendingItemsRef.current = null;
    };
  }, [sendToWorker]);

  // ── Combined items ──────────────────────────────────────────────────────────
  // Sorted flat array of all fetched items — used by the feed panel and sent
  // to the worker as pipeline input.  Computed directly from itemsBySourceId
  // (no extra debounce needed — sorting is O(n log n) and fast).
  const combinedItems = useMemo(
    () => sortByPublishedDesc(Object.values(itemsBySourceId).flat()),
    [itemsBySourceId],
  );

  // ── Debounced pipeline trigger ──────────────────────────────────────────────
  // 80 ms window collapses parallel source-fetch completions into one pipeline
  // run.  Worker mode: sends combinedItems to the worker (off main thread).
  // Sync fallback (USE_PIPELINE_WORKER = false): runs inline on main thread.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (USE_PIPELINE_WORKER) {
        if (workerReadyRef.current) {
          sendToWorker(combinedItems);
        } else {
          // Worker still initialising — save for the WORKER_READY flush.
          pendingItemsRef.current = combinedItems;
        }
      } else {
        // ── Sync fallback ───────────────────────────────────────────────────
        // Reproduces the previous useMemo behaviour for easy rollback.
        const result = runSourceIntelligencePipeline(
          combinedItems,
          getSourceDefinition,
        );
        const markers = sourceItemsToMarkers(result.eventCandidates);
        setFilterResults(result.filterResults);
        setEventCandidates(result.eventCandidates);
        setMarkerCandidates(markers);
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [combinedItems, sendToWorker]);

  // ── Load state ──────────────────────────────────────────────────────────────
  const loadState = useMemo((): SourceIntelligenceLoadState => {
    const ids = SOURCE_INTELLIGENCE_DEFAULT_SOURCE_IDS;
    const isAnyLoading = ids.some((id) => loadingBySourceId[id] ?? false);
    const isAnyError   = ids.some((id) => (errorBySourceId[id] ?? null) !== null);
    const hasAnyItems  = eventCandidates.length > 0;
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
  }, [
    errorBySourceId,
    itemsBySourceId,
    loadingBySourceId,
    eventCandidates.length,
  ]);

  // ── Context value ───────────────────────────────────────────────────────────
  // API surface is identical to the original — all consumers (AppShell,
  // MapLibreGlobe, SourceGlobalFeedPanel, SourcesScreen) require no changes.
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
