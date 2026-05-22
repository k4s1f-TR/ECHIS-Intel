import type { RegionKey } from "./event";

export type SourceCategory =
  | "PUBLIC_NEWS_WIRE"
  | "GOVERNMENT_INSTITUTIONAL"
  | "THINK_TANK_POLICY"
  | "CYBER_SECURITY_FEEDS"
  | "DEFENSE_INDUSTRY"
  | "REGIONAL_MONITORING"
  | "SOCIAL_OPEN_WEB_SIGNALS";

export type OsintSourceType =
  | "OFFICIAL"
  | "MEDIA"
  | "SPECIALIST"
  | "NGO"
  | "UNVERIFIED"
  | "MARITIME_SOURCE"
  | "INTEL_SOURCE"
  | "SIGNAL_SOURCE"
  | "OPEN_DATA";

export type SourceStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "FUTURE";

export type OsintSource = {
  id: string;
  name: string;
  type: OsintSourceType;
  status: SourceStatus;
  categories: SourceCategory[];
  regions: RegionKey[];
  lastReviewed: string;
  description: string;
  url?: string;
  eventCount?: number;
};
