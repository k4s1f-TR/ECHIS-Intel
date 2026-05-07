export type EventCategory =
  | "politics"
  | "conflict"
  | "intel"
  | "maritime"
  | "humanitarian"
  | "energy"
  | "air";

export type EventSeverity = "low" | "medium" | "high" | "critical";

export type SourceType =
  | "official"
  | "media"
  | "specialist"
  | "unverified"
  | "ngo"
  | "maritime_source"
  | "intel_source";

export type VerificationStatus =
  | "confirmed"
  | "reported"
  | "single_source"
  | "unverified"
  | "disputed";

export type EventScope = "regional" | "global";

export type RegionKey = "middle-east" | "europe" | "asia-pacific" | "americas";

export type EventMarkerVariant = "turkey-focus";

export const REGION_OPTIONS: { key: RegionKey; label: string }[] = [
  { key: "middle-east", label: "Middle East" },
  { key: "europe", label: "Europe" },
  { key: "asia-pacific", label: "Asia-Pacific" },
  { key: "americas", label: "Americas" },
];

export const CATEGORY_OPTIONS: { key: EventCategory | "all"; label: string }[] = [
  { key: "all", label: "All Categories" },
  { key: "politics", label: "Policy" },
  { key: "conflict", label: "Conflict" },
  { key: "intel", label: "Intel" },
  { key: "maritime", label: "Maritime" },
  { key: "humanitarian", label: "Humanitarian" },
  { key: "energy", label: "Energy" },
  { key: "air", label: "Air" },
];

export type OsintEvent = {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  category: EventCategory;
  severity: EventSeverity;
  location: string;
  time: string;
  sourceType: SourceType;
  verification: VerificationStatus;
  scope: EventScope;
  region: RegionKey;
  markerVariant?: EventMarkerVariant;
  tags?: string[];
  coordinates?: { lat: number; lng: number };
};
