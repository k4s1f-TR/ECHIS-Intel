import type {
  GeoBasis,
  IntelligenceEventCandidate,
  MarkerEligibility,
  SourceDefinition,
  SourceFilterDomain,
} from "../sourceIntelligenceTypes";
import {
  resolveLocationByCountryCode,
  resolveOfficialActorLocation,
  resolveLocationByText,
  type ResolvedLocation,
} from "./locationResolver";

export type ResolvedGeoBasis = {
  geoBasis?: GeoBasis;
  location?: ResolvedLocation;
  markerEligibility: MarkerEligibility;
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

function institutionBasis(source: SourceDefinition): ResolvedGeoBasis | null {
  const location = source.institutionLocation;
  if (!location) return null;
  return {
    markerEligibility: "eligible",
    location: {
      latitude: location.lat,
      longitude: location.lon,
      label: location.label ?? location.city,
      countryCode: location.countryCode,
    },
    geoBasis: {
      type: "institution_location",
      reason: "official_statement",
      countryCode: location.countryCode,
      city: location.city,
      label: location.label ?? location.city,
    },
  };
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

function shouldPreferOfficialActor(candidate: IntelligenceEventCandidate): boolean {
  return (
    candidate.primaryDomain === "official_statement" ||
    candidate.primaryDomain === "diplomacy" ||
    candidate.primaryDomain === "sanctions_law"
  );
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

export function resolveGeoBasis(
  candidate: IntelligenceEventCandidate,
  source: SourceDefinition,
): ResolvedGeoBasis {
  const item = candidate.item;
  const scanText = textForGeoResolution(candidate);

  if (
    (candidate.primaryDomain === "official_statement" ||
      source.markerLocationStrategy === "institution_location" ||
      item.sourceBasis === "official_source") &&
    source.institutionLocation
  ) {
    const basis = institutionBasis(source);
    if (basis) return basis;
  }

  if (shouldPreferOfficialActor(candidate)) {
    const officialActorLocation = resolveOfficialActorLocation(scanText);
    if (officialActorLocation) {
      return {
        markerEligibility: "eligible",
        location: officialActorLocation,
        geoBasis: {
          type: "actor_country",
          reason:
            candidate.primaryDomain === "official_statement"
              ? "ministry_statement"
              : reasonForDomain(candidate.primaryDomain),
          countryCode: officialActorLocation.countryCode,
          label: officialActorLocation.label,
        },
      };
    }
  }

  if (item.locationHint && shouldTrustLocationHint(candidate, source)) {
    return {
      markerEligibility: "eligible",
      location: {
        latitude: item.locationHint.latitude,
        longitude: item.locationHint.longitude,
        label: item.locationHint.label,
        countryCode: item.locationHint.countryCode,
      },
      geoBasis: {
        type: "event_location",
        reason: reasonForDomain(candidate.primaryDomain),
        countryCode: item.locationHint.countryCode,
        label: item.locationHint.label,
      },
    };
  }

  const mentionedLocation = resolveLocationByText(scanText);
  if (mentionedLocation) {
    const type: GeoBasis["type"] =
      candidate.primaryDomain === "sanctions_law"
        ? "target_country"
        : candidate.primaryDomain === "diplomacy" ||
            candidate.primaryDomain === "peace_process"
          ? "actor_country"
          : "mentioned_country";
    return {
      markerEligibility: "eligible",
      location: mentionedLocation,
      geoBasis: {
        type,
        reason: reasonForDomain(candidate.primaryDomain),
        countryCode: mentionedLocation.countryCode,
        label: mentionedLocation.label,
      },
    };
  }

  const countryCodeLocation = resolveLocationByCountryCode(item.sourceCountry);
  if (countryCodeLocation && source.markerLocationStrategy !== "none") {
    return {
      markerEligibility: "needs_location",
      geoBasis: {
        type: "mentioned_country",
        reason: "fallback",
        countryCode: countryCodeLocation.countryCode,
        label: countryCodeLocation.label,
      },
    };
  }

  return {
    markerEligibility:
      source.markerLocationStrategy === "none" ? "feed_only" : "needs_location",
  };
}
