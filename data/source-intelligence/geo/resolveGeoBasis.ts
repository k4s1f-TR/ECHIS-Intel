import type {
  GeoBasis,
  IntelligenceEventCandidate,
  MarkerEligibility,
  SourceDefinition,
} from "../sourceIntelligenceTypes";
import { resolveGeoDecision } from "./geoDecisionEngine";
import type { ResolvedLocation } from "./locationResolver";

export type ResolvedGeoBasis = {
  geoBasis?: GeoBasis;
  location?: ResolvedLocation;
  markerEligibility: MarkerEligibility;
};

export function resolveGeoBasis(
  candidate: IntelligenceEventCandidate,
  source: SourceDefinition,
): ResolvedGeoBasis {
  return resolveGeoDecision(candidate, source);
}
