import type { MarkerFeature } from "@/components/maplibre/MapLibreGlobe";
import type {
  GeoBasis,
  IntelligenceEventCandidate,
  SourceBasis,
} from "../sourceIntelligenceTypes";

export type SourceMarkerCandidate = {
  id: string;
  eventId: string;
  itemIds: string[];

  title: string;
  summary?: string;

  latitude: number;
  longitude: number;
  locationLabel: string;

  markerType:
    | "official_statement"
    | "diplomatic_activity"
    | "conflict"
    | "peace_process"
    | "crisis"
    | "sanctions"
    | "international_org";

  severity: "monitoring" | "important" | "high_interest";

  sourceBasis: SourceBasis;
  tags: string[];

  publishedAt?: string;
  lastUpdatedAt?: string;

  geoBasis: GeoBasis;
};

export interface SourceMarkerFeature extends MarkerFeature {
  locationName: string;
  candidate: SourceMarkerCandidate;
  items: IntelligenceEventCandidate[];
}
