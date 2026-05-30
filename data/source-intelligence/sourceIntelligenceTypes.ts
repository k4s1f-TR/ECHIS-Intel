export type CollectionMethod =
  | "rss"
  | "api"
  | "aggregator_api"
  | "official_page"
  | "scraping"
  | "script_import"
  | "dataset";

export type SourceType =
  | "official_government"
  | "intergovernmental_org"
  | "wire_agency"
  | "regional_news"
  | "global_news"
  | "crisis_humanitarian"
  | "conflict_dataset"
  | "aggregator"
  | "scraped_official_page"
  | "script_import";

export type SourceStatus = "candidate" | "test" | "active" | "disabled";

export type MarkerLocationStrategy =
  | "institution_location"
  | "item_location"
  | "none";

export type SourceBasis =
  | "official_source"
  | "source_reported"
  | "multi_source"
  | "single_public_source"
  | "scraped_candidate"
  | "dataset_record";

export type VerificationStatus =
  | "official"
  | "reported"
  | "cross_source_matched"
  | "needs_review";

export type ExtractionMethod =
  | "rss_summary"
  | "api_payload"
  | "scraped_page"
  | "dataset_record"
  | "script_import";

export type SourceDefinition = {
  id: string;
  name: string;
  sourceType: SourceType;
  collectionMethod: CollectionMethod;
  countryCode?: string;
  language?: string;
  endpoint?: string;
  feedUrl?: string;
  sourceStatus?: SourceStatus;
  institutionLocation?: {
    countryCode: string;
    city: string;
    lat: number;
    lon: number;
    label?: string;
  };
  markerLocationStrategy?: MarkerLocationStrategy;
  legacyCategory?: string;
  legacyRegionScope?: string;
};

export type RawSourceItem = Record<string, unknown>;

export type NormalizedSourceItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  collectionMethod: CollectionMethod;

  title: string;
  summary?: string;
  bodyText?: string;
  url?: string;
  language?: string;
  publishedAt?: string;
  collectedAt?: string;

  sourceCountry?: string;
  eventCountry?: string;
  actorCountries?: string[];
  mentionedCountries?: string[];
  mentionedRegions?: string[];

  institutions?: string[];
  persons?: string[];
  organizations?: string[];

  sourceBasis?: SourceBasis;
  verificationStatus?: VerificationStatus;
  extractionMethod?: ExtractionMethod;

  locationHint?: {
    latitude: number;
    longitude: number;
    label: string;
    countryCode?: string;
  };
  legacyCategory?: string;
};

export type SourceFilterDomain =
  | "diplomacy"
  | "official_statement"
  | "conflict"
  | "peace_process"
  | "crisis"
  | "sanctions_law"
  | "border_territory"
  | "humanitarian"
  | "instability"
  | "international_org";

export type MarkerEligibility =
  | "eligible"
  | "needs_location"
  | "feed_only"
  | "rejected";

export type GeoBasisType =
  | "institution_location"
  | "event_location"
  | "actor_country"
  | "target_country"
  | "mentioned_country";

export type GeoResolutionMethod =
  | "institution_location"
  | "payload_coordinates"
  | "event_location_phrase"
  | "official_actor_phrase"
  | "country_actor_phrase"
  | "target_country_phrase"
  | "negotiation_location_phrase"
  | "headline_location_prefix"
  | "mentioned_location_phrase"
  | "source_country_fallback";

export type GeoEvidenceRole =
  | "event_location"
  | "official_actor"
  | "country_actor"
  | "target"
  | "venue"
  | "mentioned_only"
  | "payload_coordinates"
  | "institution_location"
  | "source_country_fallback";

export type GeoEvidenceStrength = "strong" | "moderate" | "weak";

export type GeoEvidence = {
  role: GeoEvidenceRole;
  method: GeoResolutionMethod;
  locationLabel?: string;
  countryCode?: string;
  region?: string;
  matchedText?: string;
  evidenceText: string;
  strength: GeoEvidenceStrength;
  acceptedForMarker: boolean;
  rejectionReason?:
    | "mentioned_only"
    | "domain_mismatch"
    | "weak_evidence"
    | "ambiguous_candidates"
    | "untrusted_payload"
    | "fallback_only";
};

export type GeoBasis = {
  type: GeoBasisType;
  reason:
    | "official_statement"
    | "ministry_statement"
    | "presidential_statement"
    | "conflict"
    | "crisis"
    | "border_incident"
    | "humanitarian"
    | "peace_process"
    | "sanctions"
    | "fallback";
  countryCode?: string;
  city?: string;
  region?: string;
  label?: string;
  resolutionMethod?: GeoResolutionMethod;
  evidence?: string[];
  evidenceDetails?: GeoEvidence[];
};

export type SourceFilterMatch = {
  domain: SourceFilterDomain;
  score: number;
  matchedKeywords: string[];
  matchedGroups: string[];
};

export type SourceFilterResult<T> = {
  item: T;
  accepted: boolean;
  primaryDomain?: SourceFilterDomain;
  tags: string[];
  relevanceScore: number;
  priorityScore: number;
  sourceBasis: SourceBasis;
  verificationStatus: VerificationStatus;
  extractionMethod: ExtractionMethod;
  matchedKeywords: string[];
  matches: SourceFilterMatch[];
  markerEligibility: MarkerEligibility;
  geoBasis?: GeoBasis;
  rejectedBy?: "negative_noise" | "low_relevance" | "missing_text";
};

export type IntelligenceEventCandidate = {
  id: string;
  item: NormalizedSourceItem;
  title: string;
  summary?: string;
  url?: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  collectionMethod: CollectionMethod;
  publishedAt?: string;
  collectedAt?: string;
  primaryDomain: SourceFilterDomain;
  tags: string[];
  relevanceScore: number;
  priorityScore: number;
  sourceBasis: SourceBasis;
  verificationStatus: VerificationStatus;
  extractionMethod: ExtractionMethod;
  matchedKeywords: string[];
  matches: SourceFilterMatch[];
  markerEligibility: MarkerEligibility;
  geoBasis?: GeoBasis;
  /** Resolved map coordinates cached from the first geo-resolution pass so
   *  sourceItemsToMarkers can place the pin without running resolveGeoBasis
   *  a second time on the same item. */
  resolvedLocation?: import("./geo/locationResolver").ResolvedLocation;
};

export type SourceAdapter = {
  id: string;
  collectionMethod: CollectionMethod;
  fetchItems(source: SourceDefinition): Promise<RawSourceItem[]>;
  normalizeItem(
    raw: RawSourceItem,
    source: SourceDefinition,
  ): NormalizedSourceItem;
};
