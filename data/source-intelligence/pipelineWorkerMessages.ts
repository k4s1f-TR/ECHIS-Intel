import type {
  IntelligenceEventCandidate,
  NormalizedSourceItem,
  SourcePipelineProfile,
  SourceFilterResult,
} from "./sourceIntelligenceTypes";
import type { SourceMarkerFeature } from "./markers/sourceMarkerTypes";

export const USE_PIPELINE_WORKER = true;

export type WorkerRequest = {
  type: "RUN_PIPELINE";
  normalizedItems: NormalizedSourceItem[];
  runId: number;
  batchId: number;
};

export type WorkerResponse =
  | {
      type: "WORKER_READY";
    }
  | {
      type: "PIPELINE_RESULT";
      runId: number;
      batchId: number;
      itemCount: number;
      filterResults: SourceFilterResult<NormalizedSourceItem>[];
      eventCandidates: IntelligenceEventCandidate[];
      markerCandidates: SourceMarkerFeature[];
      perfMs: number;
      profile: SourcePipelineProfile;
    }
  | {
      type: "PIPELINE_ERROR";
      runId: number;
      batchId?: number;
      error: string;
    };
