export type CyberNewsContext = {
  country: string;
  affectedEntity: string;
  hackIncident: string;
  attackTypeVector: string;
  threatActorGroup: string;
  targetAsset: string;
  targetSector: string;
  contextSummary: string;
  firstSeen: string;
  lastUpdate: string;
  confidence: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  confidenceLevel: number;
  impactLevel: number;
};

export type CyberNewsItem = {
  id: string;
  headline: string;
  source: string;
  timeAgo: string;
  summary: string;
  categoryTag: string;
  severityTag: string;
  severityLevel: "critical" | "high" | "medium" | "low";
  accentColor: string;
  url?: string;
  publishedAt?: string;
  isLive?: boolean;
  context: CyberNewsContext;
};
