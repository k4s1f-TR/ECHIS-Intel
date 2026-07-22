import type { SourceMarkerFeature } from "@/data/source-intelligence/markers/sourceMarkerTypes";
import type {
  IntelligenceEventCandidate,
} from "@/data/source-intelligence/sourceIntelligenceTypes";
import {
  GLOBE_ACTIVITY_SNAPSHOT_VERSION,
  type GlobeActivityGeoConfidence,
  type GlobeActivityLevel,
  type GlobeActivityPoint,
  type GlobeActivitySnapshot,
  type GlobeActivitySnapshotState,
} from "@/types/globe-activity";

const ACTIVITY_WINDOW_HOURS = 24;
const SNAPSHOT_FRESHNESS_MS = 10 * 60 * 1000;

type BuildGlobeActivitySnapshotInput = {
  items: IntelligenceEventCandidate[];
  markers: SourceMarkerFeature[];
  loadState: "loading" | "loaded" | "partial" | "error";
  now?: number;
};

function eventTime(item: IntelligenceEventCandidate): number {
  return new Date(item.publishedAt ?? item.collectedAt ?? 0).getTime();
}

function newestIso(values: Array<string | undefined>): string | null {
  const newest = values.reduce((latest, value) => {
    if (!value) return latest;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
  }, 0);
  return newest > 0 ? new Date(newest).toISOString() : null;
}

function snapshotState(
  loadState: BuildGlobeActivitySnapshotInput["loadState"],
): GlobeActivitySnapshotState {
  if (loadState === "loaded") return "fresh";
  if (loadState === "partial") return "partial";
  if (loadState === "error") return "unavailable";
  return "loading";
}

function activityLevel(priorityScore: number): GlobeActivityLevel {
  if (priorityScore >= 85) return "high";
  if (priorityScore >= 70) return "medium";
  return "low";
}

function geoConfidence(
  marker: SourceMarkerFeature,
): GlobeActivityGeoConfidence {
  const acceptedEvidence = marker.candidate.geoBasis.evidenceDetails?.filter(
    (evidence) => evidence.acceptedForMarker,
  );
  return acceptedEvidence?.some((evidence) => evidence.strength === "strong")
    ? "high"
    : "medium";
}

function pointFromMarker(
  marker: SourceMarkerFeature,
  cutoff: number,
): GlobeActivityPoint | null {
  const recentItems = marker.items.filter((item) => eventTime(item) >= cutoff);
  if (recentItems.length === 0) return null;

  const lead = recentItems.reduce((best, item) =>
    item.priorityScore > best.priorityScore ? item : best,
  );
  const observedAt = newestIso(
    recentItems.flatMap((item) => [item.publishedAt, item.collectedAt]),
  );
  if (!observedAt) return null;

  return {
    id: marker.id,
    lng: marker.lng,
    lat: marker.lat,
    locationLabel: marker.locationName,
    headline: lead.title,
    sourceName: lead.sourceName,
    sourceUrl: lead.url,
    sourceBasis: lead.sourceBasis,
    collectionMethod: lead.collectionMethod,
    publishedAt: lead.publishedAt,
    observedAt,
    itemCount: recentItems.length,
    sourceCount: new Set(recentItems.map((item) => item.sourceId)).size,
    level: activityLevel(
      Math.max(...recentItems.map((item) => item.priorityScore)),
    ),
    geoConfidence: geoConfidence(marker),
  };
}

export function buildGlobeActivitySnapshot({
  items,
  markers,
  loadState,
  now = Date.now(),
}: BuildGlobeActivitySnapshotInput): GlobeActivitySnapshot {
  const cutoff = now - ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000;
  const allPoints = markers
    .map((marker) => pointFromMarker(marker, cutoff))
    .filter((point): point is GlobeActivityPoint => point !== null)
    .sort((a, b) => {
      const levelRank = { high: 3, medium: 2, low: 1 } as const;
      const levelDifference = levelRank[b.level] - levelRank[a.level];
      if (levelDifference !== 0) return levelDifference;
      return new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime();
    });
  const points = allPoints;

  const generatedAt = newestIso(items.map((item) => item.collectedAt));
  const expiresAt = generatedAt
    ? new Date(new Date(generatedAt).getTime() + SNAPSHOT_FRESHNESS_MS).toISOString()
    : null;

  return {
    schemaVersion: GLOBE_ACTIVITY_SNAPSHOT_VERSION,
    sourceMode: "visitor_pipeline",
    state: snapshotState(loadState),
    generatedAt,
    expiresAt,
    windowHours: ACTIVITY_WINDOW_HOURS,
    totalItemCount: items.length,
    geolocatedItemCount: allPoints.reduce(
      (count, point) => count + point.itemCount,
      0,
    ),
    points,
  };
}
