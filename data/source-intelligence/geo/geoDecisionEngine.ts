import type {
  GeoBasis,
  GeoEvidence,
  GeoEvidenceRole,
  GeoEvidenceStrength,
  IntelligenceEventCandidate,
  MarkerEligibility,
  SourceDefinition,
  SourceFilterDomain,
} from "../sourceIntelligenceTypes";
import {
  findLocationResolutionCandidates,
  resolveLocationByCountryCode,
  type LocationResolutionCandidate,
  type ResolvedLocation,
} from "./locationResolver";

export type GeoDecision = {
  markerEligibility: MarkerEligibility;
  location?: ResolvedLocation;
  geoBasis?: GeoBasis;
  evidence: GeoEvidence[];
};

type WeightedEvidence = GeoEvidence & {
  location?: ResolvedLocation;
  priority: number;
};

function reasonForDomain(domain: SourceFilterDomain): GeoBasis["reason"] {
  switch (domain) {
    case "official_statement":
      return "official_statement";
    case "conflict":
      return "conflict";
    case "crisis":
      return "crisis";
    case "humanitarian":
      return "humanitarian";
    case "peace_process":
      return "peace_process";
    case "sanctions_law":
      return "sanctions";
    case "border_territory":
      return "border_incident";
    default:
      return "fallback";
  }
}

function textForGeoResolution(candidate: IntelligenceEventCandidate): string {
  const item = candidate.item;
  return [
    item.title,
    item.summary,
    item.bodyText,
    item.eventCountry,
    item.actorCountries?.join(" "),
    item.mentionedCountries?.join(" "),
    item.mentionedRegions?.join(" "),
    item.institutions?.join(" "),
    item.organizations?.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function strengthForScore(score: number): GeoEvidenceStrength {
  if (score >= 88) return "strong";
  if (score >= 78) return "moderate";
  return "weak";
}

function roleForCandidate(
  candidate: LocationResolutionCandidate,
): GeoEvidenceRole {
  switch (candidate.method) {
    case "official_actor_phrase":
      return "official_actor";
    case "country_actor_phrase":
      return "country_actor";
    case "target_country_phrase":
      return "target";
    case "negotiation_location_phrase":
      return "venue";
    case "event_location_phrase":
    case "headline_location_prefix":
      return "event_location";
    case "mentioned_location_phrase":
      return "mentioned_only";
  }
}

function basisTypeForRole(role: GeoEvidenceRole): GeoBasis["type"] {
  switch (role) {
    case "institution_location":
      return "institution_location";
    case "official_actor":
    case "country_actor":
      return "actor_country";
    case "target":
      return "target_country";
    case "event_location":
    case "venue":
    case "payload_coordinates":
      return "event_location";
    default:
      return "mentioned_country";
  }
}

function rolePriority(
  domain: SourceFilterDomain,
  role: GeoEvidenceRole,
): number | null {
  if (role === "mentioned_only" || role === "source_country_fallback") {
    return null;
  }

  let priorities: Partial<Record<GeoEvidenceRole, number>>;
  switch (domain) {
    case "official_statement":
      priorities = {
        official_actor: 104,
        institution_location: 100,
        payload_coordinates: 96,
        event_location: 92,
        country_actor: 88,
        target: 78,
        venue: 76,
      };
      return priorities[role] ?? null;
    case "diplomacy":
      priorities = {
        venue: 105,
        event_location: 96,
        official_actor: 90,
        institution_location: 86,
        country_actor: 84,
        payload_coordinates: 84,
      };
      return priorities[role] ?? null;
    case "peace_process":
      priorities = {
        venue: 106,
        event_location: 98,
        target: 86,
        official_actor: 84,
        country_actor: 82,
        payload_coordinates: 84,
      };
      return priorities[role] ?? null;
    case "sanctions_law":
      priorities = {
        official_actor: 102,
        institution_location: 98,
        target: 96,
        event_location: 88,
        payload_coordinates: 86,
        country_actor: 82,
      };
      return priorities[role] ?? null;
    case "conflict":
    case "crisis":
    case "humanitarian":
    case "border_territory":
    case "instability":
      priorities = {
        event_location: 106,
        target: 98,
        payload_coordinates: 94,
        country_actor: 90,
        official_actor: 88,
        venue: 80,
      };
      return priorities[role] ?? null;
    case "international_org":
      priorities = {
        venue: 100,
        event_location: 98,
        target: 94,
        institution_location: 92,
        official_actor: 88,
        country_actor: 86,
        payload_coordinates: 86,
      };
      return priorities[role] ?? null;
  }
}

function shouldTrustLocationHint(
  candidate: IntelligenceEventCandidate,
  source: SourceDefinition,
): boolean {
  if (!candidate.item.locationHint) return false;
  if (candidate.item.sourceBasis === "official_source") return true;
  if (source.sourceType === "crisis_humanitarian") return true;
  if (source.sourceType === "conflict_dataset") return true;
  if (source.collectionMethod === "dataset") return true;
  if (source.collectionMethod === "script_import") return true;
  if (source.collectionMethod === "official_page") return true;
  return false;
}

function weightedEvidence(
  evidence: GeoEvidence,
  location: ResolvedLocation | undefined,
  domain: SourceFilterDomain,
  score = 0,
): WeightedEvidence {
  const basePriority = rolePriority(domain, evidence.role);
  const acceptedForMarker = basePriority !== null && evidence.strength !== "weak";
  return {
    ...evidence,
    acceptedForMarker,
    rejectionReason: acceptedForMarker ? undefined : evidence.rejectionReason,
    location,
    priority: acceptedForMarker ? basePriority + Math.min(score, 10) : 0,
  };
}

function institutionEvidence(
  source: SourceDefinition,
  domain: SourceFilterDomain,
): WeightedEvidence | null {
  const location = source.institutionLocation;
  if (!location) return null;
  return weightedEvidence(
    {
      role: "institution_location",
      method: "institution_location",
      locationLabel: location.label ?? location.city,
      countryCode: location.countryCode,
      evidenceText: `source institution: ${source.name}`,
      strength: "strong",
      acceptedForMarker: true,
    },
    {
      latitude: location.lat,
      longitude: location.lon,
      label: location.label ?? location.city,
      countryCode: location.countryCode,
    },
    domain,
    10,
  );
}

function payloadEvidence(
  candidate: IntelligenceEventCandidate,
  source: SourceDefinition,
): WeightedEvidence | null {
  const hint = candidate.item.locationHint;
  if (!hint) return null;
  const trusted = shouldTrustLocationHint(candidate, source);
  return weightedEvidence(
    {
      role: "payload_coordinates",
      method: "payload_coordinates",
      locationLabel: hint.label,
      countryCode: hint.countryCode,
      evidenceText: trusted
        ? "trusted source payload coordinates"
        : "untrusted general-source payload coordinates",
      strength: trusted ? "strong" : "weak",
      acceptedForMarker: trusted,
      rejectionReason: trusted ? undefined : "untrusted_payload",
    },
    {
      latitude: hint.latitude,
      longitude: hint.longitude,
      label: hint.label,
      countryCode: hint.countryCode,
    },
    candidate.primaryDomain,
    trusted ? 8 : 0,
  );
}

function locationCandidateEvidence(
  candidate: IntelligenceEventCandidate,
  locationCandidate: LocationResolutionCandidate,
): WeightedEvidence {
  const role = roleForCandidate(locationCandidate);
  const strength = strengthForScore(locationCandidate.score);
  return weightedEvidence(
    {
      role,
      method: locationCandidate.method,
      locationLabel: locationCandidate.location.label,
      countryCode: locationCandidate.location.countryCode,
      region: locationCandidate.location.region,
      matchedText: locationCandidate.matchedAlias,
      evidenceText: locationCandidate.evidence.join("; "),
      strength,
      acceptedForMarker: true,
      rejectionReason:
        role === "mentioned_only"
          ? "mentioned_only"
          : strength === "weak"
            ? "weak_evidence"
            : undefined,
    },
    locationCandidate.location,
    candidate.primaryDomain,
    Math.round(locationCandidate.score / 10),
  );
}

function sourceCountryFallbackEvidence(
  candidate: IntelligenceEventCandidate,
): WeightedEvidence | null {
  const location = resolveLocationByCountryCode(candidate.item.sourceCountry);
  if (!location) return null;
  return {
    role: "source_country_fallback",
    method: "source_country_fallback",
    locationLabel: location.label,
    countryCode: location.countryCode,
    evidenceText: "source country fallback is not marker eligible",
    strength: "weak",
    acceptedForMarker: false,
    rejectionReason: "fallback_only",
    location,
    priority: 0,
  };
}

function domainAllowsInstitutionFirst(
  candidate: IntelligenceEventCandidate,
  source: SourceDefinition,
): boolean {
  if (!source.institutionLocation) return false;
  if (source.markerLocationStrategy === "institution_location") return true;
  return (
    candidate.item.sourceBasis === "official_source" &&
    (candidate.primaryDomain === "official_statement" ||
      candidate.primaryDomain === "diplomacy" ||
      candidate.primaryDomain === "sanctions_law" ||
      candidate.primaryDomain === "international_org")
  );
}

function ambiguityRejects(top: WeightedEvidence, next?: WeightedEvidence): boolean {
  if (!next?.acceptedForMarker || !top.location || !next.location) return false;
  const topKey = top.location.countryCode ?? top.location.label;
  const nextKey = next.location.countryCode ?? next.location.label;
  if (topKey === nextKey) return false;
  if (top.role === "venue" || top.role === "official_actor") return false;
  if (
    top.method === "event_location_phrase" &&
    next.method === "headline_location_prefix"
  ) {
    return false;
  }
  return top.priority - next.priority <= 3;
}

function geoBasisFromEvidence(
  selected: WeightedEvidence,
  allEvidence: GeoEvidence[],
  domain: SourceFilterDomain,
): GeoBasis | undefined {
  if (!selected.location) return undefined;
  return {
    type: basisTypeForRole(selected.role),
    reason:
      selected.role === "official_actor" && domain === "official_statement"
        ? "ministry_statement"
        : reasonForDomain(domain),
    countryCode: selected.location.countryCode,
    region: selected.location.region,
    label: selected.location.label,
    resolutionMethod: selected.method,
    evidence: allEvidence.map((item) => item.evidenceText),
    evidenceDetails: allEvidence,
  };
}

function toPublicEvidence(item: WeightedEvidence): GeoEvidence {
  return {
    role: item.role,
    method: item.method,
    locationLabel: item.locationLabel,
    countryCode: item.countryCode,
    region: item.region,
    matchedText: item.matchedText,
    evidenceText: item.evidenceText,
    strength: item.strength,
    acceptedForMarker: item.acceptedForMarker,
    rejectionReason: item.rejectionReason,
  };
}

export function resolveGeoDecision(
  candidate: IntelligenceEventCandidate,
  source: SourceDefinition,
): GeoDecision {
  const scanText = textForGeoResolution(candidate);
  const evidence: WeightedEvidence[] = [];

  if (domainAllowsInstitutionFirst(candidate, source)) {
    const institution = institutionEvidence(source, candidate.primaryDomain);
    if (institution) evidence.push(institution);
  }

  const payload = payloadEvidence(candidate, source);
  if (payload) evidence.push(payload);

  for (const locationCandidate of findLocationResolutionCandidates(scanText)) {
    evidence.push(locationCandidateEvidence(candidate, locationCandidate));
  }

  const fallback = sourceCountryFallbackEvidence(candidate);
  if (fallback && source.markerLocationStrategy !== "none") evidence.push(fallback);

  const accepted = evidence
    .filter((item) => item.acceptedForMarker && item.location)
    .sort((a, b) => b.priority - a.priority);
  const publicEvidence: GeoEvidence[] = evidence.map(toPublicEvidence);

  const selected = accepted[0];
  if (!selected) {
    return {
      markerEligibility:
        source.markerLocationStrategy === "none" ? "feed_only" : "needs_location",
      geoBasis:
        publicEvidence.length > 0
          ? {
              type: "mentioned_country",
              reason: "fallback",
              resolutionMethod: fallback?.method,
              evidence: publicEvidence.map((item) => item.evidenceText),
              evidenceDetails: publicEvidence,
            }
          : undefined,
      evidence: publicEvidence,
    };
  }

  if (ambiguityRejects(selected, accepted[1])) {
    const ambiguousEvidence = publicEvidence.map((item) =>
      item.acceptedForMarker
        ? {
            ...item,
            acceptedForMarker: false,
            rejectionReason: "ambiguous_candidates" as const,
          }
        : item,
    );
    return {
      markerEligibility: "needs_location",
      geoBasis: {
        type: "mentioned_country",
        reason: "fallback",
        evidence: ambiguousEvidence.map((item) => item.evidenceText),
        evidenceDetails: ambiguousEvidence,
      },
      evidence: ambiguousEvidence,
    };
  }

  return {
    markerEligibility: "eligible",
    location: selected.location,
    geoBasis: geoBasisFromEvidence(
      selected,
      publicEvidence,
      candidate.primaryDomain,
    ),
    evidence: publicEvidence,
  };
}
