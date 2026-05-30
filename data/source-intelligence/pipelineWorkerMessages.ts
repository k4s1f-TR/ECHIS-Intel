// ---------------------------------------------------------------------------
// Pipeline Worker — shared message types and rollback flag.
//
// Imported by both the main thread (SourceIntelligenceProvider) and the
// dedicated worker (pipelineWorker.ts).  All imports are type-only; zero
// runtime overhead in either context.
// ---------------------------------------------------------------------------
import type {
  IntelligenceEventCandidate,
  NormalizedSourceItem,
  SourceFilterResult,
} from "./sourceIntelligenceTypes";
import type { SourceMarkerFeature } from "./markers/sourceMarkerTypes";

// ── Rollback flag ─────────────────────────────────────────────────────────────
// Set to false to revert to the synchronous main-thread pipeline (useMemo).
// One-line rollback: change this to false and rebuild.
export const USE_PIPELINE_WORKER = true;

// ── Main thread → Worker ──────────────────────────────────────────────────────
export type WorkerRequest = {
  type: "RUN_PIPELINE";
  /** All normalized items from all fetched sources — structured-clone safe. */
  normalizedItems: NormalizedSourceItem[];
  /**
   * Monotonic counter incremented on every send.
   * The provider drops PIPELINE_RESULT responses whose runId is older
   * than the most recently dispatched request, avoiding stale state.
   */
  runId: number;
};

// ── Worker → Main thread ──────────────────────────────────────────────────────
export type WorkerResponse =
  | {
      /**
       * Fired once after module load + locationResolver eager alias-regex
       * warmup completes.  The provider flushes any queued items on receipt.
       */
      type: "WORKER_READY";
    }
  | {
      type: "PIPELINE_RESULT";
      runId: number;
      /** Number of normalizedItems received — used for the [perf-worker] log. */
      itemCount: number;
      filterResults: SourceFilterResult<NormalizedSourceItem>[];
      eventCandidates: IntelligenceEventCandidate[];
      markerCandidates: SourceMarkerFeature[];
      /** Wall-clock ms the worker spent running the full pipeline. */
      perfMs: number;
    }
  | {
      type: "PIPELINE_ERROR";
      runId: number;
      error: string;
    };
