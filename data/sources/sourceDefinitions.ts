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
    candidateFeedUrl: "https://www.trthaber.com/sondakika_articles.rss",
    language: "tr",
    regionScope: "global",
    targetScreens: ["monitor", "intel_watch"],
    sourceProfile: "general_news",
    markerLocationStrategy: "item_location",
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
    sourceProfile: "general_news",
    markerLocationStrategy: "item_location",
    notes:
      "Candidate English-language Middle East RSS source. all.xml is a candidate feed URL; live filtering and live fetching are not implemented in this step.",
  },
  {
    id: "bbc-turkce",
    name: "BBC Türkçe",
    category: "Public News",
    accessType: "rss",
    candidateStatus: "candidate_test",
    sourceStatus: "public_news_source",
    verificationStatus: "source_reported",
    sourceBasis: "single_public_source",
    extractionMethod: "rss_summary",
    baseUrl: "https://www.bbc.com/turkce",
    candidateFeedUrl: "https://feeds.bbci.co.uk/turkce/rss.xml",
    language: "tr",
    regionScope: "global",
    targetScreens: ["monitor", "intel_watch"],
    sourceProfile: "general_news",
    markerLocationStrategy: "item_location",
    notes:
      "Candidate Turkish-language BBC news RSS feed. Preview only; live fetching not implemented for production.",
  },

  // ── General News ────────────────────────────────────────────────────────
  {
    id: "dw-turkce",
    name: "DW Türkçe",
    category: "Public News",
    accessType: "rss",
    candidateStatus: "candidate_test",
    sourceStatus: "public_news_source",
    verificationStatus: "source_reported",
    sourceBasis: "single_public_source",
    extractionMethod: "rss_summary",
    baseUrl: "https://www.dw.com/tr/",
    candidateFeedUrl: "https://rss.dw.com/rdf/rss-tur-all",
    language: "tr",
    regionScope: "global",
    targetScreens: ["monitor", "intel_watch"],
    sourceProfile: "general_news",
    markerLocationStrategy: "item_location",
    notes:
      "Candidate Turkish-language Deutsche Welle news RSS feed. Preview only.",
  },

  // ── Conflict / Crisis ────────────────────────────────────────────────────
  {
    id: "crisis-group-crisiswatch",
    name: "International Crisis Group — CrisisWatch",
    category: "Conflict / Crisis",
    accessType: "rss",
    candidateStatus: "candidate_test",
    sourceStatus: "public_news_source",
    verificationStatus: "source_reported",
    sourceBasis: "single_public_source",
    extractionMethod: "rss_summary",
    baseUrl: "https://www.crisisgroup.org/",
    candidateFeedUrl: "https://www.crisisgroup.org/rss.xml",
    language: "en",
    regionScope: "global",
    targetScreens: ["monitor", "intel_watch"],
    sourceProfile: "conflict_crisis",
    markerLocationStrategy: "item_location",
    notes:
      "Candidate International Crisis Group RSS feed covering active conflict situations globally.",
  },
];
