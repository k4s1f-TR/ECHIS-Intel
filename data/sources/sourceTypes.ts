// Source candidate foundation types.
// These types support the first RSS candidate/test phase but are intentionally
// generic so future adapters (RSS, API, static, GDELT, CISA KEV, NVD, GDACS,
// ReliefWeb, etc.) can share the same shape.

export type SourceAccessType = "rss" | "api" | "static" | "manual";

export type SourceCandidateStatus =
  | "candidate_test"
  | "review_more"
  | "later"
  | "rejected";

export type SourceStatus =
  | "public_news_source"
  | "official_feed"
  | "community_signal"
  | "reference_dataset";

export type VerificationStatus =
  | "source_reported"
  | "official_entry"
  | "multi_source_reference"
  | "manual_sample";

export type SourceBasis =
  | "single_public_source"
  | "single_official_source"
  | "multiple_public_sources"
  | "manual_sample";

export type ExtractionMethod =
  | "rss_summary"
  | "official_json"
  | "manual_sample"
  | "keyword_match"
  | "api_result";

export type SourceRegionScope =
  | "global"
  | "middle_east"
  | "europe"
  | "asia_pacific"
  | "americas"
  | "africa";

export type SourceTargetScreen =
  | "monitor"
  | "intel_watch"
  | "cyber_news"
  | "defense_industry"
  | "policy"
  | "sources";

export type SourceLanguage = "tr" | "en" | "ar" | "fr" | "es" | "ru" | "de";

export type SourceDefinition = {
  id: string;
  name: string;
  category: string;
  accessType: SourceAccessType;
  candidateStatus: SourceCandidateStatus;
  sourceStatus: SourceStatus;
  verificationStatus: VerificationStatus;
  sourceBasis: SourceBasis;
  extractionMethod: ExtractionMethod;
  baseUrl: string;
  candidateFeedUrl?: string;
  language: SourceLanguage;
  regionScope: SourceRegionScope;
  targetScreens: SourceTargetScreen[];
  notes?: string;
};

export type NormalizedSourceItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  collectedAt: string;
  sourceType: SourceAccessType;
  sourceStatus: SourceStatus;
  verificationStatus: VerificationStatus;
  sourceBasis: SourceBasis;
  extractionMethod: ExtractionMethod;
  relatedCountries: string[];
  relatedRegions: SourceRegionScope[];
  category: string;
  isSample: boolean;
};
