/* ─── Defense Industry mock data ──────────────────────────────── */

export type DefenseActivityType =
  | "Procurement"
  | "Export Review"
  | "Industrial Partnership"
  | "Production Capacity"
  | "Naval Program"
  | "UAV / Aerospace"
  | "Supply Chain"
  | "Sustainment";

export type DefenseIndustryContext = {
  countryRegion: string;
  organization: string;
  program: string;
  activityType: DefenseActivityType;
  industrySegment: string;
  supplyChainArea: string;
  summary: string;
  sourceType: string;
  firstSeen: string;
  lastUpdate: string;
  confidence: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  confidenceLevel: number; // 1..5
  impactLevel: number; // 1..5
};

export type DefenseFeedItem = {
  id: string;
  headline: string;
  source: string;
  timeAgo: string;
  summary: string;
  activityType: DefenseActivityType;
  priority: "elevated" | "high" | "medium" | "low";
  context: DefenseIndustryContext;
};

export type DefenseMapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  segment: "Aerospace" | "Naval" | "Land" | "UAV" | "Supply";
};

export type DefenseSegmentMention = {
  rank: number;
  segment: string;
  count: number;
  change: number;
};

export type DefenseSupplyChainPressure = {
  name: string;
  score: number;
  status: "Critical" | "High" | "Elevated" | "Moderate";
};

/* ─── Feed items ──────────────────────────────────────────────── */
export const defenseFeedItems: DefenseFeedItem[] = [
  {
    id: "df-001",
    headline: "National operator extends multi-year procurement framework for next-generation rotary platforms",
    source: "Industry Bulletin",
    timeAgo: "32m ago",
    summary:
      "Public statement outlines an expanded procurement framework covering training, MRO and follow-on deliveries through 2032.",
    activityType: "Procurement",
    priority: "high",
    context: {
      countryRegion: "Western Europe",
      organization: "National Defense Procurement Agency",
      program: "Next-Gen Rotary Platform Framework",
      activityType: "Procurement",
      industrySegment: "Rotary Aerospace",
      supplyChainArea: "Airframe assembly, avionics integration",
      summary:
        "Framework consolidates multi-year requirements across training and operational fleets, with sustainment scoped under a separate follow-on package.",
      sourceType: "Government statement",
      firstSeen: "2025-12-04 09:14",
      lastUpdate: "2026-05-20 11:02",
      confidence: "High",
      impact: "High",
      confidenceLevel: 4,
      impactLevel: 4,
    },
  },
  {
    id: "df-002",
    headline: "Export license review opens for advanced naval sensors package",
    source: "Trade Register",
    timeAgo: "1h ago",
    summary:
      "Regulator placed an inter-agency review on an export package linked to a partner-country surface combatant program.",
    activityType: "Export Review",
    priority: "elevated",
    context: {
      countryRegion: "North America",
      organization: "Maritime Sensors Consortium",
      program: "Surface Combatant Sensor Suite",
      activityType: "Export Review",
      industrySegment: "Naval Electronics",
      supplyChainArea: "Sensor modules, signal processing",
      summary:
        "Review process expected to last several weeks; partner program timelines remain unchanged according to public statements.",
      sourceType: "Regulatory filing",
      firstSeen: "2026-05-17 14:30",
      lastUpdate: "2026-05-20 09:48",
      confidence: "Medium",
      impact: "Medium",
      confidenceLevel: 3,
      impactLevel: 3,
    },
  },
  {
    id: "df-003",
    headline: "Two primes confirm industrial partnership on long-range UAV airframe",
    source: "Press Release",
    timeAgo: "2h ago",
    summary:
      "Joint statement outlines shared design authority and a co-production line for a long-endurance UAV airframe.",
    activityType: "Industrial Partnership",
    priority: "high",
    context: {
      countryRegion: "Southern Europe / Middle East",
      organization: "Joint Aerospace Partnership",
      program: "Long-Endurance UAV Airframe",
      activityType: "Industrial Partnership",
      industrySegment: "UAV / Aerospace",
      supplyChainArea: "Composite airframe, mission systems",
      summary:
        "Public statement frames the partnership as a co-production effort, with deliveries indicatively starting in 2028.",
      sourceType: "Press release",
      firstSeen: "2026-05-19 10:05",
      lastUpdate: "2026-05-20 08:40",
      confidence: "High",
      impact: "Medium",
      confidenceLevel: 4,
      impactLevel: 3,
    },
  },
  {
    id: "df-004",
    headline: "Shipyard reports second production line going live for frigate program",
    source: "Industry Bulletin",
    timeAgo: "3h ago",
    summary:
      "A national shipyard confirmed activation of an additional production line as part of an ongoing frigate program.",
    activityType: "Naval Program",
    priority: "elevated",
    context: {
      countryRegion: "Mediterranean",
      organization: "State Shipyard Authority",
      program: "Multi-Role Frigate Program",
      activityType: "Naval Program",
      industrySegment: "Naval Shipbuilding",
      supplyChainArea: "Hull blocks, propulsion integration",
      summary:
        "Second line is described as increasing parallel hull throughput; sustainment infrastructure announcements expected separately.",
      sourceType: "Industry bulletin",
      firstSeen: "2026-05-18 16:12",
      lastUpdate: "2026-05-20 07:25",
      confidence: "High",
      impact: "Medium",
      confidenceLevel: 4,
      impactLevel: 3,
    },
  },
  {
    id: "df-005",
    headline: "Production capacity guidance updated for tactical UAV family",
    source: "Company Filing",
    timeAgo: "5h ago",
    summary:
      "Public guidance raises annual production capacity targets for a tactical UAV family, citing facility expansion.",
    activityType: "Production Capacity",
    priority: "medium",
    context: {
      countryRegion: "Eastern Mediterranean",
      organization: "Tactical UAV Manufacturer",
      program: "Tactical UAV Family",
      activityType: "Production Capacity",
      industrySegment: "UAV / Aerospace",
      supplyChainArea: "Final assembly, payload integration",
      summary:
        "Updated guidance reflects facility expansion already underway, per the company's most recent public filing.",
      sourceType: "Company filing",
      firstSeen: "2026-05-15 12:00",
      lastUpdate: "2026-05-20 05:18",
      confidence: "Medium",
      impact: "Medium",
      confidenceLevel: 3,
      impactLevel: 3,
    },
  },
  {
    id: "df-006",
    headline: "Supply chain pressure flagged on precision electronics components",
    source: "Trade Register",
    timeAgo: "7h ago",
    summary:
      "Open-source reporting points to extended lead times for select precision electronics used across multiple platforms.",
    activityType: "Supply Chain",
    priority: "elevated",
    context: {
      countryRegion: "Global",
      organization: "Multiple Tier-2 Suppliers",
      program: "Precision Electronics Components",
      activityType: "Supply Chain",
      industrySegment: "Defense Electronics",
      supplyChainArea: "Semiconductors, precision components",
      summary:
        "Reports describe extended lead times rather than confirmed shortages; platform programs have not publicly revised schedules.",
      sourceType: "Open-source reporting",
      firstSeen: "2026-05-12 08:00",
      lastUpdate: "2026-05-20 03:42",
      confidence: "Medium",
      impact: "High",
      confidenceLevel: 3,
      impactLevel: 4,
    },
  },
  {
    id: "df-007",
    headline: "Sustainment contract awarded for transport aircraft fleet",
    source: "Government Notice",
    timeAgo: "9h ago",
    summary:
      "A multi-year sustainment contract covering transport aircraft MRO and spares was awarded under a published framework.",
    activityType: "Sustainment",
    priority: "low",
    context: {
      countryRegion: "Northern Europe",
      organization: "National Air Logistics Command",
      program: "Transport Aircraft Sustainment",
      activityType: "Sustainment",
      industrySegment: "Aerospace Sustainment",
      supplyChainArea: "MRO, spares, depot-level repair",
      summary:
        "Contract is described as a continuation of an existing sustainment framework, with no major scope changes from prior cycles.",
      sourceType: "Government notice",
      firstSeen: "2026-05-19 17:40",
      lastUpdate: "2026-05-20 02:10",
      confidence: "High",
      impact: "Low",
      confidenceLevel: 4,
      impactLevel: 2,
    },
  },
  {
    id: "df-008",
    headline: "Aerospace prime confirms next milestone on combat aircraft program",
    source: "Press Release",
    timeAgo: "12h ago",
    summary:
      "A public statement confirms completion of a development milestone within a multi-national combat aircraft program.",
    activityType: "UAV / Aerospace",
    priority: "medium",
    context: {
      countryRegion: "Western Europe",
      organization: "Multinational Aerospace Consortium",
      program: "Combat Aircraft Development",
      activityType: "UAV / Aerospace",
      industrySegment: "Combat Aerospace",
      supplyChainArea: "Airframe, propulsion, mission systems",
      summary:
        "Milestone is presented as on-schedule; consortium reiterated existing public timelines without further detail.",
      sourceType: "Press release",
      firstSeen: "2026-05-19 21:00",
      lastUpdate: "2026-05-19 23:58",
      confidence: "Medium",
      impact: "Medium",
      confidenceLevel: 3,
      impactLevel: 3,
    },
  },
];

/* ─── Static map markers (neutral, no animation) ──────────────── */
export const defenseMapMarkers: DefenseMapMarker[] = [
  { id: "m-eu-west", lat: 48.86, lng: 2.35, label: "Western Europe Hub", segment: "Aerospace" },
  { id: "m-uk", lat: 51.5, lng: -0.12, label: "UK Hub", segment: "Aerospace" },
  { id: "m-de", lat: 52.52, lng: 13.4, label: "Central Europe Hub", segment: "Land" },
  { id: "m-it", lat: 41.9, lng: 12.49, label: "Mediterranean Hub", segment: "Naval" },
  { id: "m-tr", lat: 39.93, lng: 32.86, label: "E. Med Hub", segment: "UAV" },
  { id: "m-il", lat: 32.08, lng: 34.78, segment: "UAV" },
  { id: "m-us-east", lat: 38.9, lng: -77.04, label: "NA East Hub", segment: "Aerospace" },
  { id: "m-us-west", lat: 33.94, lng: -118.4, label: "NA West Hub", segment: "Aerospace" },
  { id: "m-kr", lat: 37.56, lng: 126.98, label: "ROK Hub", segment: "Naval" },
  { id: "m-jp", lat: 35.68, lng: 139.69, label: "Japan Hub", segment: "Naval" },
  { id: "m-in", lat: 28.61, lng: 77.21, label: "South Asia Hub", segment: "Land" },
  { id: "m-au", lat: -35.28, lng: 149.13, label: "AU Hub", segment: "Naval" },
  { id: "m-br", lat: -23.55, lng: -46.63, label: "LatAm Hub", segment: "Aerospace" },
  { id: "m-se", lat: 59.33, lng: 18.07, segment: "Aerospace" },
  { id: "m-no", lat: 59.91, lng: 10.75, segment: "Naval" },
  { id: "m-sg", lat: 1.35, lng: 103.82, segment: "Supply" },
];

/* ─── Key Segments (compact ranked panel) ─────────────────────── */
export const defenseKeySegments: DefenseSegmentMention[] = [
  { rank: 1, segment: "Aerospace", count: 1180, change: 14.2 },
  { rank: 2, segment: "Naval", count: 942, change: 9.8 },
  { rank: 3, segment: "UAV / Unmanned", count: 871, change: 17.4 },
  { rank: 4, segment: "Land Systems", count: 705, change: 4.6 },
  { rank: 5, segment: "Munitions", count: 612, change: 11.3 },
  { rank: 6, segment: "Electronics", count: 538, change: 6.1 },
  { rank: 7, segment: "Space / Satellite", count: 421, change: 8.7 },
];

/* ─── Supply Chain Pressure (compact bars) ────────────────────── */
export const defenseSupplyChainPressure: DefenseSupplyChainPressure[] = [
  { name: "Semiconductors", score: 88, status: "Critical" },
  { name: "Precision Components", score: 79, status: "High" },
  { name: "Composite Materials", score: 68, status: "High" },
  { name: "Energetic Materials", score: 57, status: "Elevated" },
  { name: "Specialty Metals", score: 49, status: "Elevated" },
  { name: "Optronics", score: 38, status: "Moderate" },
];
