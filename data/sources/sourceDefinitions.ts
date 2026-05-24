import type { SourceDefinition } from "./sourceTypes";

// Initial candidate / test source definitions for the first RSS test phase.
// These are NOT approved production sources. They are static frontend records
// only. No live fetching, scraping, parsing, or API ingestion is performed.

export const candidateSourceDefinitions: SourceDefinition[] = [
  {
    id: "trt-haber-dunya",
    name: "TRT Haber - Dünya",
    category: "Public News",
    accessType: "rss",
    candidateStatus: "candidate_test",
    sourceStatus: "public_news_source",
    verificationStatus: "source_reported",
    sourceBasis: "single_public_source",
    extractionMethod: "rss_summary",
    baseUrl: "https://www.trthaber.com/",
    candidateFeedUrl: "https://www.trthaber.com/dunya_articles.rss",
    language: "tr",
    regionScope: "global",
    targetScreens: ["monitor", "intel_watch"],
    notes:
      "Candidate Turkish-language world-news RSS feed. Treat as test source only; live fetching is not implemented.",
  },
  {
    id: "aljazeera-middle-east",
    name: "Al Jazeera - Middle East",
    category: "Public News",
    accessType: "rss",
    candidateStatus: "candidate_test",
    sourceStatus: "public_news_source",
    verificationStatus: "source_reported",
    sourceBasis: "single_public_source",
    extractionMethod: "rss_summary",
    baseUrl: "https://www.aljazeera.com/middle-east/",
    candidateFeedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    language: "en",
    regionScope: "middle_east",
    targetScreens: ["monitor", "intel_watch"],
    notes:
      "Candidate English-language Middle East RSS source. all.xml is a candidate feed URL; live filtering and live fetching are not implemented in this step.",
  },
];
