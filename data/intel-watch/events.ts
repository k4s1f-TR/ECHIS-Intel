import type { FeedEvent } from "@/types/intel-watch";

export const liveFeedEvents: FeedEvent[] = [
  {
    id: "fe-001",
    agencyAbbr: "EU",
    title: "EU–GCC diplomatic meeting held in Brussels",
    description:
      "Senior officials from the European Union and Gulf Cooperation Council convened to discuss trade, energy cooperation, and regional security frameworks.",
    category: "diplomatic",
    source: "Reuters",
    timestamp: "09:41",
  },
  {
    id: "fe-002",
    agencyAbbr: "TR",
    title: "Turkey–Syria border tensions reported by local monitors",
    description:
      "Cross-border incidents near the Hatay region have been logged by regional observers. Turkish and Syrian authorities have not issued formal statements.",
    category: "border",
    source: "Al Jazeera",
    timestamp: "09:17",
  },
  {
    id: "fe-003",
    agencyAbbr: "US",
    title: "U.S. Treasury issues new sanctions on Iranian entities",
    description:
      "The Office of Foreign Assets Control designated six Iranian front companies and three individuals linked to procurement networks for dual-use materials.",
    category: "sanctions",
    source: "Treasury.gov",
    timestamp: "08:55",
  },
  {
    id: "fe-004",
    agencyAbbr: "RU",
    title: "FSB warns of coordinated foreign influence operation",
    description:
      "Russian Federal Security Service released a bulletin alleging a multi-vector disinformation campaign targeting domestic audiences ahead of regional elections.",
    category: "influence",
    source: "TASS",
    timestamp: "08:34",
  },
  {
    id: "fe-005",
    agencyAbbr: "UN",
    title: "UN DPA convenes emergency consultations on Red Sea shipping",
    description:
      "Department of Political and Peacebuilding Affairs called member-state representatives to discuss escalating disruptions to commercial traffic in the Bab-el-Mandeb strait.",
    category: "security",
    source: "UN News",
    timestamp: "08:12",
  },
  {
    id: "fe-006",
    agencyAbbr: "DE",
    title: "Germany announces updated National Security Strategy review",
    description:
      "The German Federal Chancellery confirmed a parliamentary briefing on revisions to the 2023 strategy, with emphasis on hybrid threats and critical infrastructure.",
    category: "policy",
    source: "DW",
    timestamp: "07:49",
  },
  {
    id: "fe-007",
    agencyAbbr: "CN",
    title: "China–Philippines diplomatic note exchanged over Spratly Islands",
    description:
      "Beijing's Ministry of Foreign Affairs submitted a formal diplomatic note objecting to Philippine patrol activities near contested maritime features in the South China Sea.",
    category: "diplomatic",
    source: "Bloomberg",
    timestamp: "07:22",
  },
  {
    id: "fe-008",
    agencyAbbr: "IL",
    title: "Israel–Hamas ceasefire talks resume in Doha",
    description:
      "Qatari and Egyptian mediators facilitated a new round of indirect negotiations. Both parties attended through intermediaries; no joint statement has been issued.",
    category: "diplomatic",
    source: "BBC",
    timestamp: "06:58",
  },
];
