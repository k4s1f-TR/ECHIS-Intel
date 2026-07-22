"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bookmark, Database } from "lucide-react";
import {
  EchisGlobe,
  type EchisGlobeHandle,
  type GlobeGeographySelection,
  type GlobeMarker,
  type GlobeRegionDefinition,
} from "@/components/map/EchisGlobe";
import type {
  GlobeActivitySnapshot,
  GlobeActivitySnapshotState,
} from "@/types/globe-activity";
import styles from "./MonitorLanding.module.css";

export type MonitorDestination =
  | "global"
  | "socmint"
  | "airtrack"
  | "intel"
  | "cyber"
  | "defense"
  | "policy"
  | "sources"
  | "bookmarks";

export type MonitorLandingProps = {
  onNavigate?: (
    destination: MonitorDestination,
    geography: GlobeGeographySelection | null,
  ) => void;
  selectedGeography?: GlobeGeographySelection | null;
  onGeographyChange?: (geography: GlobeGeographySelection | null) => void;
  activitySnapshot: GlobeActivitySnapshot;
  bookmarkCount?: number;
};

type ContextRoute = {
  destination: MonitorDestination;
  label: string;
};

const GEOGRAPHIC_REGIONS: GlobeRegionDefinition[] = [
  {
    id: "region-red-sea",
    name: "Red Sea Corridor",
    lng: 39.2,
    lat: 20.3,
    rings: [
      [
        [32.2, 30.1],
        [33.8, 27.0],
        [35.2, 24.0],
        [37.2, 20.0],
        [40.0, 16.0],
        [42.3, 12.7],
        [43.4, 12.8],
        [42.3, 16.0],
        [39.8, 20.0],
        [37.8, 24.0],
        [35.4, 27.0],
        [32.8, 30.1],
        [32.2, 30.1],
      ],
    ],
  },
];

const COUNTRY_ROUTES: ContextRoute[] = [
  { destination: "global", label: "Regional Situation" },
  { destination: "socmint", label: "Public Signals" },
  { destination: "policy", label: "Policy Context" },
  { destination: "sources", label: "Source Context" },
];

const REGION_ROUTES: ContextRoute[] = [
  { destination: "global", label: "Regional Situation" },
  { destination: "socmint", label: "Public Signals" },
  { destination: "defense", label: "Defense Context" },
  { destination: "sources", label: "Source Context" },
];

const ACTIVITY_CARD_VISIBLE_MS = 7_800;
const ACTIVITY_CARD_CYCLE_MS = 48_000;

function activityCardOffset(id: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % ACTIVITY_CARD_CYCLE_MS;
}

function getPipelineState(
  state: GlobeActivitySnapshotState,
  snapshot: GlobeActivitySnapshot,
) {
  if (state === "fresh") {
    return {
      label: "Synchronized",
      detail: `${snapshot.totalItemCount} reports indexed`,
      tone: "ready",
    };
  }
  if (state === "partial") {
    return {
      label: "Limited",
      detail: `${snapshot.totalItemCount} reports indexed`,
      tone: "partial",
    };
  }
  if (state === "stale") {
    return {
      label: "Snapshot stale",
      detail: `${snapshot.geolocatedItemCount} mapped reports`,
      tone: "stale",
    };
  }
  if (state === "unavailable") {
    return {
      label: "Unavailable",
      detail: "No geographic snapshot",
      tone: "error",
    };
  }
  return {
    label: "Synchronizing",
    detail: "Collecting public sources",
    tone: "loading",
  };
}

function effectiveSnapshotState(
  snapshot: GlobeActivitySnapshot,
  now: number,
): GlobeActivitySnapshotState {
  if (
    (snapshot.state === "fresh" || snapshot.state === "partial") &&
    snapshot.expiresAt &&
    now > new Date(snapshot.expiresAt).getTime()
  ) {
    return "stale";
  }
  return snapshot.state;
}

function formatSnapshotAge(generatedAt: string | null, now: number): string {
  if (!generatedAt) return "Update time unavailable";
  const ageMs = Math.max(0, now - new Date(generatedAt).getTime());
  const ageMinutes = Math.floor(ageMs / 60_000);
  if (ageMinutes < 1) return "Updated now";
  if (ageMinutes < 60) return `Updated ${ageMinutes}m ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `Updated ${ageHours}h ago`;
  return `Updated ${Math.floor(ageHours / 24)}d ago`;
}

function getActivitySummary(
  snapshot: GlobeActivitySnapshot,
  state: GlobeActivitySnapshotState,
  now: number,
) {
  if (state === "loading") {
    return {
      eyebrow: "Geographic pulse",
      title: "Mapping current public-source activity…",
      meta: "Waiting for verified locations",
    };
  }
  if (state === "unavailable") {
    return {
      eyebrow: "Snapshot unavailable",
      title: "No verified geographic activity available.",
      meta: "Base globe remains interactive",
    };
  }
  if (snapshot.points.length === 0) {
    return {
      eyebrow:
        state === "stale" ? "Last available snapshot" : "Public-source snapshot",
      title: `No geolocated reports in the current ${snapshot.windowHours}h window.`,
      meta: formatSnapshotAge(snapshot.generatedAt, now),
    };
  }
  return {
    eyebrow:
      state === "stale"
        ? "Last available snapshot"
        : state === "partial"
          ? "Limited public-source snapshot"
          : "Latest public-source snapshot",
    title: `${snapshot.points.length} mapped locations`,
    meta: `${snapshot.geolocatedItemCount} geolocated reports · ${formatSnapshotAge(snapshot.generatedAt, now)}`,
  };
}

export const MonitorLanding = forwardRef<EchisGlobeHandle, MonitorLandingProps>(
  function MonitorLanding(
    {
      onNavigate,
      selectedGeography,
      onGeographyChange,
      activitySnapshot,
      bookmarkCount = 0,
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const globeRef = useRef<EchisGlobeHandle>(null);
    const leaderPathRef = useRef<SVGPathElement>(null);
    const revealTimerRef = useRef<number | null>(null);
    const actionTimerRef = useRef<number | null>(null);
    const [internalGeography, setInternalGeography] =
      useState<GlobeGeographySelection | null>(null);
    const [hoveredGeography, setHoveredGeography] =
      useState<GlobeGeographySelection | null>(null);
    const [contextReady, setContextReady] = useState(false);
    const [navigatingTo, setNavigatingTo] =
      useState<MonitorDestination | null>(null);
    const [snapshotNow, setSnapshotNow] = useState(() => Date.now());
    const activityCardEpochRef = useRef(Date.now());

    const isControlled = selectedGeography !== undefined;
    const activeGeography = isControlled
      ? selectedGeography
      : internalGeography;
    const routes =
      activeGeography?.kind === "region" ? REGION_ROUTES : COUNTRY_ROUTES;
    const snapshotState = effectiveSnapshotState(activitySnapshot, snapshotNow);
    const pipeline = getPipelineState(snapshotState, activitySnapshot);
    const activitySummary = getActivitySummary(
      activitySnapshot,
      snapshotState,
      snapshotNow,
    );
    const activityMarkers = useMemo<GlobeMarker[]>(() => {
      return activitySnapshot.points.map((point) => ({
          id: `activity-${point.id}`,
          lng: point.lng,
          lat: point.lat,
          level: point.level,
          pulseScale: Math.min(0.92, 0.68 + point.itemCount * 0.045),
          displayStartedAtMs:
            activityCardEpochRef.current + activityCardOffset(point.id),
          displayDurationMs: ACTIVITY_CARD_VISIBLE_MS,
          displayCycleMs: ACTIVITY_CARD_CYCLE_MS,
          label: point.locationLabel,
          detail: `${point.itemCount} ${point.itemCount === 1 ? "report" : "reports"} · ${point.sourceCount} ${point.sourceCount === 1 ? "source" : "sources"}`,
        }));
    }, [activitySnapshot.points]);

    useEffect(() => {
      const intervalId = window.setInterval(
        () => setSnapshotNow(Date.now()),
        30_000,
      );
      return () => window.clearInterval(intervalId);
    }, []);

    const commitGeography = useCallback(
      (geography: GlobeGeographySelection | null) => {
        if (!isControlled) setInternalGeography(geography);
        onGeographyChange?.(geography);
      },
      [isControlled, onGeographyChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => globeRef.current?.zoomIn(),
        zoomOut: () => globeRef.current?.zoomOut(),
        centerView: () => globeRef.current?.centerView(),
        focusMarker: (lng, lat) => globeRef.current?.focusMarker(lng, lat),
        projectMarker: (lng, lat) =>
          globeRef.current?.projectMarker(lng, lat) ?? null,
        setAutoRotatePaused: (paused) =>
          globeRef.current?.setAutoRotatePaused(paused),
        resumeAutoRotate: () => globeRef.current?.resumeAutoRotate(),
      }),
      [],
    );

    useEffect(() => {
      if (!activeGeography) {
        setContextReady(false);
        return;
      }
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }

      setContextReady(false);
      setHoveredGeography(null);
      globeRef.current?.focusMarker(activeGeography.lng, activeGeography.lat);
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 280;
      revealTimerRef.current = window.setTimeout(() => {
        setContextReady(true);
        revealTimerRef.current = null;
      }, delay);
    }, [activeGeography]);

    useEffect(() => {
      if (!activeGeography) return;

      let frameId = 0;
      const leaderPath = leaderPathRef.current;
      const updateLeader = () => {
        frameId = window.requestAnimationFrame(updateLeader);
        const root = rootRef.current;
        const point = globeRef.current?.projectMarker(
          activeGeography.lng,
          activeGeography.lat,
        );
        if (!root || !leaderPath || !point?.visible) {
          if (leaderPath) delete leaderPath.dataset.projected;
          return;
        }

        const { width, height } = root.getBoundingClientRect();
        const endX = Math.max(point.x + 110, width - 320);
        const endY = height * 0.43;
        const elbowX = Math.max(point.x + 52, endX - 48);
        leaderPath.setAttribute(
          "d",
          `M ${point.x.toFixed(1)} ${point.y.toFixed(1)} L ${elbowX.toFixed(1)} ${point.y.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`,
        );
        leaderPath.dataset.projected = "true";
      };

      updateLeader();
      return () => {
        window.cancelAnimationFrame(frameId);
        if (leaderPath) delete leaderPath.dataset.projected;
      };
    }, [activeGeography]);

    useEffect(
      () => () => {
        if (revealTimerRef.current !== null) {
          window.clearTimeout(revealTimerRef.current);
        }
        if (actionTimerRef.current !== null) {
          window.clearTimeout(actionTimerRef.current);
        }
      },
      [],
    );

    const clearSelection = useCallback(() => {
      if (!activeGeography || navigatingTo) return;
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
      if (actionTimerRef.current !== null) {
        window.clearTimeout(actionTimerRef.current);
      }

      setContextReady(false);
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 220;
      actionTimerRef.current = window.setTimeout(() => {
        commitGeography(null);
        globeRef.current?.centerView();
        actionTimerRef.current = null;
      }, delay);
    }, [activeGeography, commitGeography, navigatingTo]);

    const resumeFromAtmosphere = useCallback(() => {
      if (navigatingTo) return;
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if (actionTimerRef.current !== null) {
        window.clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }

      setContextReady(false);
      setHoveredGeography(null);
      globeRef.current?.resumeAutoRotate();

      if (!activeGeography) return;
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 180;
      actionTimerRef.current = window.setTimeout(() => {
        commitGeography(null);
        actionTimerRef.current = null;
      }, delay);
    }, [activeGeography, commitGeography, navigatingTo]);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") clearSelection();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [clearSelection]);

    const handleGeographySelect = (geography: GlobeGeographySelection) => {
      if (navigatingTo) return;
      if (geography.id === activeGeography?.id) {
        clearSelection();
        return;
      }
      if (actionTimerRef.current !== null) {
        window.clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
      commitGeography(geography);
    };

    const handleRouteNavigate = (destination: MonitorDestination) => {
      if (navigatingTo) return;
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }

      setNavigatingTo(destination);
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 320;
      actionTimerRef.current = window.setTimeout(() => {
        if (onNavigate) {
          onNavigate(destination, activeGeography ?? null);
        } else {
          setNavigatingTo(null);
        }
        actionTimerRef.current = null;
      }, delay);
    };

    return (
      <div
        ref={rootRef}
        aria-label="ECHIS geographic workspace gateway"
        className={styles.root}
        data-selected={activeGeography ? "true" : undefined}
        data-leaving={navigatingTo ? "true" : undefined}
        data-activity-state={snapshotState}
      >
        <div className={styles.globeStage}>
          <EchisGlobe
            ref={globeRef}
            size="hero"
            autoRotatePaused={Boolean(activeGeography)}
            markers={activeGeography ? [] : activityMarkers}
            showLabels
            markerLabelVariant="country-card"
            showMarkerCore={false}
            showMarkerWaves={false}
            showAdminBorders
            showPlaceLabels
            enableGeographySelection
            geographyRegions={GEOGRAPHIC_REGIONS}
            selectedGeographyId={activeGeography?.id ?? null}
            onGeographySelect={handleGeographySelect}
            onGeographyHover={setHoveredGeography}
            onAtmosphereTripleClick={resumeFromAtmosphere}
            focusZoomOffset={1.7}
            focusLatitudeBiasDeg={1}
            focusEasing={0.045}
          />
        </div>

        <div aria-hidden className={styles.surfaceLight} />
        <div aria-hidden className={styles.edgeVignette} />
        <div aria-hidden className={styles.fineGrid} />

        <header className={styles.topBar}>
          <div className={styles.scopeLabel}>
            <span>01</span>
            <i aria-hidden />
            <strong>Geographic gateway</strong>
          </div>

          <div className={styles.systemState} data-state={pipeline.tone}>
            <span className={styles.systemDot} aria-hidden />
            <span>
              <small>Public-source pipeline</small>
              <strong>{pipeline.label}</strong>
            </span>
            <i aria-hidden />
            <span className={styles.systemDetail}>{pipeline.detail}</span>
          </div>
        </header>

        <svg
          aria-hidden
          className={styles.leaderLayer}
          preserveAspectRatio="none"
        >
          <path
            ref={leaderPathRef}
            className={styles.leaderPath}
            data-ready={contextReady ? "true" : undefined}
          />
        </svg>

        {!activeGeography && (
          <div className={styles.orientation} aria-live="polite">
            <span>
              {hoveredGeography
                ? hoveredGeography.kind === "country"
                  ? "Country workspace"
                  : "Regional corridor"
                : activitySummary.eyebrow}
            </span>
            <p>
              {hoveredGeography ? (
                hoveredGeography.name
              ) : (
                activitySummary.title
              )}
            </p>
            {!hoveredGeography && (
              <div className={styles.activityMeta}>
                <i aria-hidden />
                <span>{activitySummary.meta}</span>
                <small>{activitySnapshot.windowHours}h window</small>
              </div>
            )}
          </div>
        )}

        {activeGeography && (
          <>
            <div
              className={styles.selectedPlaceCaption}
              data-ready={contextReady ? "true" : undefined}
            >
              <span>
                {activeGeography.kind === "country"
                  ? "Country workspace"
                  : "Regional corridor"}
              </span>
              <strong>{activeGeography.name}</strong>
              <small>
                Geographic selection
                <i aria-hidden />
                Context retained
              </small>
            </div>

            <section
              className={styles.contextGateway}
              aria-labelledby="gateway-place-title"
              data-ready={contextReady ? "true" : undefined}
            >
              <button
                type="button"
                className={styles.clearSelection}
                onClick={clearSelection}
                aria-label="Clear geographic selection"
              >
                Clear
              </button>
              <div className={styles.gatewayHeading}>
                <h1 id="gateway-place-title">{activeGeography.name}</h1>
                <p>
                  {activeGeography.kind === "country"
                    ? "Country-level workspace routes"
                    : "Regional corridor workspace routes"}
                </p>
              </div>

              <div className={styles.contextTitle}>
                <span>Workspace routes</span>
                <small>04 paths</small>
              </div>

              <div className={styles.contextRoutes}>
                {routes.map((route, index) => (
                  <button
                    type="button"
                    key={route.destination}
                    onClick={() => handleRouteNavigate(route.destination)}
                    data-active={
                      navigatingTo === route.destination ? "true" : undefined
                    }
                    aria-disabled={navigatingTo !== null || undefined}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{route.label}</strong>
                  </button>
                ))}
              </div>

              <div className={styles.routeFooter}>
                <span>Selection continues into workspace</span>
                <i aria-hidden />
                <small>
                  {activeGeography.kind === "country" ? "Country" : "Region"}
                </small>
              </div>
            </section>
          </>
        )}

        <div className={styles.globeGuide} aria-hidden>
          <span className={styles.guideLine} />
          <span>Drag to rotate</span>
          <i />
          <span>Hover country</span>
          <i />
          <span>Select geography</span>
          <i />
          <span>Esc to clear</span>
        </div>

        <div className={styles.utilityDock}>
          <button type="button" onClick={() => handleRouteNavigate("sources")}>
            <Database size={14} aria-hidden />
            <span>Sources</span>
          </button>
          <button type="button" onClick={() => handleRouteNavigate("bookmarks")}>
            <Bookmark size={14} aria-hidden />
            <span>Saved</span>
            {bookmarkCount > 0 && <small>{bookmarkCount}</small>}
          </button>
        </div>
      </div>
    );
  },
);
