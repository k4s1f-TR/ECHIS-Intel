/**
 * Source-Intelligence Pipeline — Dedicated Web Worker entry point.
 *
 * Receives NormalizedSourceItem[] via postMessage, runs the full pipeline
 * (keyword filter → geo-resolution → marker grouping) and posts the results
 * back to the main thread.  All heavy computation executes here so the main
 * thread — and the MapLibre globe's RAF loop — is never blocked.
 *
 * ── Import rules ─────────────────────────────────────────────────────────────
 * Do NOT import React, Next.js (/app, /server, /navigation…), or any module
 * that accesses document / window at module-load time.  fetch() is available
 * in dedicated worker scope; all pipeline modules are pure computation.
 *
 * ── Startup sequence ────────────────────────────────────────────────────────
 * 1. Worker script is parsed and evaluated by the browser.
 * 2. ES module imports run synchronously:
 *      → sourceIntelligencePipeline → applySourceFilters, resolveGeoBasis
 *      → locationResolver eager alias-regex warmup runs (fills _aliasRegexCache)
 *      → _geoCache is initialised (empty, will accumulate across runs)
 * 3. The last statement in this file posts WORKER_READY — guaranteeing that
 *    the warmup is complete before any RUN_PIPELINE message is accepted.
 */

import { runSourceIntelligencePipeline } from "./sourceIntelligencePipeline";
import { sourceItemsToMarkers } from "./markers/sourceItemsToMarkers";
import { logSourceIntelProfile } from "./pipelineProfiling";
import { getSourceDefinition } from "./sourceRegistry";
import type { WorkerRequest, WorkerResponse } from "./pipelineWorkerMessages";

// ── Worker global typing ──────────────────────────────────────────────────────
// TypeScript's default lib types `self` as `Window & typeof globalThis`.
// Rather than adding /// <reference lib="webworker" /> (which conflicts with
// the project-wide dom lib in tsconfig), we cast globalThis to a minimal
// DedicatedWorker interface that covers only what we use.
type WorkerGlobal = {
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (data: WorkerResponse) => void;
};
const workerSelf = globalThis as unknown as WorkerGlobal;

// ── Message handler ───────────────────────────────────────────────────────────
workerSelf.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const { type, normalizedItems, runId, batchId } = ev.data;
  if (type !== "RUN_PIPELINE") return;

  try {
    const t0 = performance.now();

    // Full pipeline: keyword filter → geo-resolution (cache-aware) → sort
    const result = runSourceIntelligencePipeline(normalizedItems, getSourceDefinition);

    // Group accepted candidates into globe marker features
    const markersStart = performance.now();
    const markerCandidates = sourceItemsToMarkers(result.eventCandidates);
    const sourceItemsToMarkersMs = performance.now() - markersStart;

    const perfMs = performance.now() - t0;

    const response: WorkerResponse = {
      type: "PIPELINE_RESULT",
      runId,
      batchId,
      itemCount: normalizedItems.length,
      filterResults: result.filterResults,
      eventCandidates: result.eventCandidates,
      markerCandidates,
      perfMs,
      profile: {
        ...result.profile,
        sourceItemsToMarkersMs,
        totalMs: perfMs,
      },
    };
    logSourceIntelProfile("worker pipeline", response.profile);
    workerSelf.postMessage(response);
  } catch (err) {
    const errorResponse: WorkerResponse = {
      type: "PIPELINE_ERROR",
      runId,
      batchId,
      error: err instanceof Error ? err.message : String(err),
    };
    workerSelf.postMessage(errorResponse);
  }
};

// ── Ready signal ──────────────────────────────────────────────────────────────
// All module-level code above (including locationResolver eager warmup) has
// now completed synchronously.  The provider will flush any queued items.
workerSelf.postMessage({ type: "WORKER_READY" });
