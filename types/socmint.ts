import type { RegionKey } from "./event";

export type SocmintReportType =
  | "local-report"
  | "social-claim"
  | "osint-account"
  | "local-media";

export type SocmintPlatform =
  | "telegram"
  | "osint-account"
  | "local-media"
  | "mastodon"
  | "bluesky"
  | "rss";

export type SocmintStatus =
  | "unverified"
  | "reported"
  | "corroborated"
  | "needs-review";

export type SocmintConfidence = "low" | "medium" | "high";

export type SocmintReport = {
  id: string;
  title: string;
  summary: string;
  detailedSummary?: string;
  type: SocmintReportType;
  platform: SocmintPlatform;
  sourceName: string;
  locationName: string;
  region: RegionKey;
  coordinates: [number, number];
  confidence: SocmintConfidence;
  confidenceScore?: number;
  status: SocmintStatus;
  timestamp: string;
  relatedEventId?: string;
  entities?: {
    country?: string;
    city?: string;
    organization?: string;
    actor?: string;
    sector?: string;
  };
};

export const SOCMINT_TYPE_OPTIONS: { key: SocmintReportType | "all"; label: string }[] = [
  { key: "all", label: "All Reports" },
  { key: "local-report", label: "Local Reports" },
  { key: "social-claim", label: "Social Claims" },
  { key: "osint-account", label: "OSINT Accounts" },
  { key: "local-media", label: "Local Media" },
];

export const SOCMINT_TYPE_LABELS: Record<SocmintReportType, string> = {
  "local-report": "Local Reports",
  "social-claim": "Social Claims",
  "osint-account": "OSINT Accounts",
  "local-media": "Local Media",
};

export const SOCMINT_TYPE_BADGE_LABELS: Record<SocmintReportType, string> = {
  "local-report": "LOCAL REPORT",
  "social-claim": "SOCIAL CLAIM",
  "osint-account": "OSINT ACCOUNT",
  "local-media": "LOCAL MEDIA",
};

export const SOCMINT_PLATFORM_LABELS: Record<SocmintPlatform, string> = {
  telegram: "TELEGRAM",
  "osint-account": "OSINT ACCOUNT",
  "local-media": "LOCAL MEDIA",
  mastodon: "MASTODON",
  bluesky: "BLUESKY",
  rss: "RSS",
};

export const SOCMINT_STATUS_LABELS: Record<SocmintStatus, string> = {
  unverified: "UNVERIFIED",
  reported: "REPORTED",
  corroborated: "CORROBORATED",
  "needs-review": "NEEDS REVIEW",
};

export function socmintConfidenceScore(report: SocmintReport): number {
  if (typeof report.confidenceScore === "number") return report.confidenceScore;
  if (report.confidence === "high") return 78;
  if (report.confidence === "medium") return 52;
  return 28;
}

export function socmintMatchesConfidenceFilter(
  report: SocmintReport,
  filterValue: number,
): boolean {
  if (filterValue === 0) return true;

  const score = socmintConfidenceScore(report);

  if (filterValue === 20) return score < 40;
  if (filterValue === 40) return score >= 40 && score < 70;
  if (filterValue === 70) return score >= 70;

  return true;
}
