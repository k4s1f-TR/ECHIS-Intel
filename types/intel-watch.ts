export type AgencyType = "Intelligence" | "Diplomatic" | "Supranational";

export type AgencyRegion =
  | "North America"
  | "Western & Central Europe"
  | "Eastern Europe"
  | "Eurasia & Russia"
  | "MENA"
  | "South & East Asia"
  | "Southeast Asia & Oceania"
  | "Latin America & Africa"
  | "Supranational";

export type Agency = {
  id: string;
  name: string;
  fullName: string;
  type: AgencyType;
  region: AgencyRegion;
  city: string;
  country: string;
  lat: number;
  lng: number;
  activityLevel: number;
};

export type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";

export type WatchlistEntry = {
  id: string;
  region: string;
  topic: string;
  priority: PriorityLevel;
  confidence: number;
  lastUpdate: string;
};

export type FeedCategory =
  | "diplomatic"
  | "security"
  | "sanctions"
  | "influence"
  | "border"
  | "policy";

export type FeedEvent = {
  id: string;
  agencyAbbr: string;
  title: string;
  description: string;
  category: FeedCategory;
  source: string;
  timestamp: string;
};

export type SignalTheme = {
  label: string;
  values: { na: number; eu: number; me: number; eurasia: number; apac: number };
};

export type AgencyActivityEntry = {
  name: string;
  value: number;
};
