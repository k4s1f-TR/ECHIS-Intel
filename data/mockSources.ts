import type { OsintSource } from "@/types/source";

export const mockSources: OsintSource[] = [
  {
    id: "src-regional-media-monitor",
    name: "Regional Media Monitor",
    type: "MEDIA",
    status: "ACTIVE",
    categories: ["PUBLIC_NEWS_WIRE", "REGIONAL_MONITORING"],
    regions: ["middle-east", "europe", "americas"],
    lastReviewed: "Today, 10:00 UTC",
    description:
      "Curated regional news and wire reporting used by Monitor and Intel Watch for public event discovery.",
    eventCount: 4,
  },
  {
    id: "src-official-statements-feed",
    name: "Government Statements Desk",
    type: "OFFICIAL",
    status: "ACTIVE",
    categories: ["GOVERNMENT_INSTITUTIONAL", "THINK_TANK_POLICY"],
    regions: ["middle-east", "asia-pacific"],
    lastReviewed: "Today, 09:55 UTC",
    description:
      "Public ministry, regulator, and institutional statements mapped to Policy and Intel Watch workflows.",
    eventCount: 2,
  },
  {
    id: "src-osint-specialist-watch",
    name: "Open Web Analyst Watch",
    type: "SPECIALIST",
    status: "ACTIVE",
    categories: ["SOCIAL_OPEN_WEB_SIGNALS", "REGIONAL_MONITORING"],
    regions: ["middle-east", "europe", "asia-pacific"],
    lastReviewed: "Today, 09:40 UTC",
    description:
      "Specialist public posts and analyst notes reviewed as static mock inputs for OSINT source mapping.",
    eventCount: 2,
  },
  {
    id: "src-relief-humanitarian-watch",
    name: "Humanitarian Access Watch",
    type: "NGO",
    status: "ACTIVE",
    categories: ["REGIONAL_MONITORING", "GOVERNMENT_INSTITUTIONAL"],
    regions: ["middle-east"],
    lastReviewed: "Today, 09:20 UTC",
    description:
      "Public relief, civil protection, and aid-access reporting used for regional context in Monitor.",
    eventCount: 1,
  },
  {
    id: "src-maritime-source-monitor",
    name: "Maritime Security Desk",
    type: "MARITIME_SOURCE",
    status: "ACTIVE",
    categories: ["REGIONAL_MONITORING", "GOVERNMENT_INSTITUTIONAL"],
    regions: ["middle-east", "asia-pacific"],
    lastReviewed: "Today, 09:05 UTC",
    description:
      "Open maritime advisories and port-security references for chokepoints, vessel behavior, and naval activity.",
    eventCount: 3,
  },
  {
    id: "src-cyber-news-feeds",
    name: "Cyber News Feed Set",
    type: "SPECIALIST",
    status: "ACTIVE",
    categories: ["CYBER_SECURITY_FEEDS", "PUBLIC_NEWS_WIRE"],
    regions: ["europe", "asia-pacific", "americas"],
    lastReviewed: "Today, 08:50 UTC",
    description:
      "Public vendor advisories, CERT notices, and security reporting aligned with the Cyber News section.",
    eventCount: 0,
  },
  {
    id: "src-defense-industry-desk",
    name: "Defense Industry Desk",
    type: "SPECIALIST",
    status: "ACTIVE",
    categories: ["DEFENSE_INDUSTRY", "GOVERNMENT_INSTITUTIONAL"],
    regions: ["middle-east", "europe", "asia-pacific", "americas"],
    lastReviewed: "Today, 08:35 UTC",
    description:
      "Public procurement notices, company releases, and trade-register references for Defense Industry mapping.",
    eventCount: 0,
  },
  {
    id: "src-policy-research-desk",
    name: "Policy Research Desk",
    type: "SPECIALIST",
    status: "PENDING",
    categories: ["THINK_TANK_POLICY", "GOVERNMENT_INSTITUTIONAL"],
    regions: ["middle-east", "europe", "asia-pacific", "americas"],
    lastReviewed: "Awaiting review",
    description:
      "Think tank publications and public policy briefs reserved for future manual classification in Policy.",
    eventCount: 0,
  },
  {
    id: "src-open-data-reference",
    name: "Open Data Reference Index",
    type: "OPEN_DATA",
    status: "FUTURE",
    categories: ["PUBLIC_NEWS_WIRE", "REGIONAL_MONITORING"],
    regions: ["middle-east", "europe", "asia-pacific", "americas"],
    lastReviewed: "Not connected",
    description:
      "Placeholder for public reference datasets. No live integration, scraping, or automated ingestion is connected.",
    eventCount: 0,
  },
];
