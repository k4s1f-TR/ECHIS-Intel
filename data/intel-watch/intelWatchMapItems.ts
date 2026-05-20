export type IntelWatchCategory =
  | "Diplomatic"
  | "Security"
  | "Policy"
  | "Sanctions"
  | "Border"
  | "Influence"
  | "Cooperation"
  | "Maritime";

export type IntelWatchMapItem = {
  id: string;
  title: string;
  countryRegion: string;
  lat: number;
  lng: number;
  category: IntelWatchCategory;
  source: string;
  lastUpdate: string;
  confidence: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  summary: string;
};

export const intelWatchMapItems: IntelWatchMapItem[] = [
  {
    id: "iw-001",
    title: "Bilateral dialogue resumed at ministerial level",
    countryRegion: "Western Europe",
    lat: 48.86,
    lng: 2.35,
    category: "Diplomatic",
    source: "Government statement",
    lastUpdate: "2026-05-20 09:12",
    confidence: "High",
    impact: "Medium",
    summary:
      "Public statement confirms resumption of bilateral dialogue covering trade and security files.",
  },
  {
    id: "iw-002",
    title: "Public statement on cross-border incident",
    countryRegion: "Eastern Mediterranean",
    lat: 39.93,
    lng: 32.86,
    category: "Border",
    source: "Official statement",
    lastUpdate: "2026-05-20 08:45",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Official statement references a cross-border incident; no escalation indicators in public sources.",
  },
  {
    id: "iw-003",
    title: "Sanctions list update published",
    countryRegion: "North America",
    lat: 38.9,
    lng: -77.04,
    category: "Sanctions",
    source: "Regulatory filing",
    lastUpdate: "2026-05-20 07:30",
    confidence: "High",
    impact: "High",
    summary:
      "Regulatory filing publishes an updated sanctions list expanding existing designations.",
  },
  {
    id: "iw-004",
    title: "Joint naval cooperation exercise announced",
    countryRegion: "Indo-Pacific",
    lat: 35.68,
    lng: 139.69,
    category: "Cooperation",
    source: "Press release",
    lastUpdate: "2026-05-20 06:14",
    confidence: "High",
    impact: "Medium",
    summary:
      "Multinational press release outlines a planned naval cooperation exercise later in the quarter.",
  },
  {
    id: "iw-005",
    title: "Public-source reporting on regional security activity",
    countryRegion: "South Caucasus",
    lat: 41.72,
    lng: 44.78,
    category: "Security",
    source: "Regional media",
    lastUpdate: "2026-05-20 04:55",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Regional media reports on security activity near the line of contact; no official confirmation.",
  },
  {
    id: "iw-006",
    title: "Policy signal on export controls",
    countryRegion: "Western Europe",
    lat: 52.52,
    lng: 13.4,
    category: "Policy",
    source: "Government notice",
    lastUpdate: "2026-05-20 03:48",
    confidence: "High",
    impact: "Medium",
    summary:
      "Government notice signals upcoming consultation on export control framework adjustments.",
  },
  {
    id: "iw-007",
    title: "Public mention of influence campaign indicators",
    countryRegion: "South Asia",
    lat: 28.61,
    lng: 77.21,
    category: "Influence",
    source: "Open-source reporting",
    lastUpdate: "2026-05-19 23:10",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Open-source reporting documents content patterns consistent with a coordinated influence campaign.",
  },
  {
    id: "iw-008",
    title: "Maritime domain awareness advisory issued",
    countryRegion: "Red Sea / Bab el-Mandeb",
    lat: 12.58,
    lng: 43.33,
    category: "Maritime",
    source: "Maritime advisory",
    lastUpdate: "2026-05-19 21:30",
    confidence: "High",
    impact: "High",
    summary:
      "Maritime advisory references heightened caution in transit lanes; routing guidance unchanged.",
  },
  {
    id: "iw-009",
    title: "High-level diplomatic visit publicly confirmed",
    countryRegion: "Southeast Asia",
    lat: 1.35,
    lng: 103.82,
    category: "Diplomatic",
    source: "Official statement",
    lastUpdate: "2026-05-19 19:00",
    confidence: "High",
    impact: "Medium",
    summary:
      "Official statement confirms a high-level diplomatic visit with multilateral cooperation on the agenda.",
  },
  {
    id: "iw-010",
    title: "Public-source reporting on migration corridor pressure",
    countryRegion: "Central Mediterranean",
    lat: 35.9,
    lng: 14.5,
    category: "Security",
    source: "Regional media",
    lastUpdate: "2026-05-19 17:42",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Regional media documents elevated migration corridor pressure; agencies issued no public revisions.",
  },
  {
    id: "iw-011",
    title: "Sanctions enforcement notice published",
    countryRegion: "Western Europe",
    lat: 51.5,
    lng: -0.12,
    category: "Sanctions",
    source: "Regulatory filing",
    lastUpdate: "2026-05-19 15:08",
    confidence: "High",
    impact: "Medium",
    summary:
      "Regulatory filing publishes enforcement notice tied to the existing designation framework.",
  },
  {
    id: "iw-012",
    title: "Bilateral cooperation framework signed",
    countryRegion: "Latin America",
    lat: -23.55,
    lng: -46.63,
    category: "Cooperation",
    source: "Press release",
    lastUpdate: "2026-05-19 12:25",
    confidence: "High",
    impact: "Medium",
    summary:
      "Press release outlines a bilateral cooperation framework covering trade and infrastructure.",
  },
  {
    id: "iw-013",
    title: "Border crossing operational status update",
    countryRegion: "Central Europe",
    lat: 50.08,
    lng: 14.43,
    category: "Border",
    source: "Government notice",
    lastUpdate: "2026-05-19 10:11",
    confidence: "High",
    impact: "Low",
    summary:
      "Government notice updates border crossing operational status; impact described as routine.",
  },
  {
    id: "iw-014",
    title: "Policy paper published on regional cooperation",
    countryRegion: "Eurasia",
    lat: 55.75,
    lng: 37.62,
    category: "Policy",
    source: "Government statement",
    lastUpdate: "2026-05-19 07:48",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Government statement accompanies a policy paper outlining priorities for regional cooperation.",
  },
  {
    id: "iw-015",
    title: "Public-source maritime activity observation",
    countryRegion: "South China Sea",
    lat: 14.06,
    lng: 114.0,
    category: "Maritime",
    source: "Open-source reporting",
    lastUpdate: "2026-05-19 04:12",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Open-source reporting documents maritime activity in disputed waters; no formal statements issued.",
  },
  {
    id: "iw-016",
    title: "Coordinated influence narrative mention",
    countryRegion: "Eastern Europe",
    lat: 50.45,
    lng: 30.52,
    category: "Influence",
    source: "Open-source reporting",
    lastUpdate: "2026-05-18 22:40",
    confidence: "Medium",
    impact: "Medium",
    summary:
      "Open-source reporting documents narrative amplification patterns across multiple platforms.",
  },
];
