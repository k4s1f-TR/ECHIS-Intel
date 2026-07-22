"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LeftRail } from "./LeftRail";
import { HeaderNav } from "./HeaderNav";
import {
  REGION_GLOBE_VIEWS,
  type MarkerFeature,
} from "@/components/maplibre/MapLibreGlobe";
import { ScreenGlobe } from "@/components/map/ScreenGlobe";
import {
  markersFromFeatures,
  prefetchGlobeData,
  type EchisGlobeHandle,
  type GlobeGeographySelection,
} from "@/components/map/EchisGlobe";
import {
  MonitorLanding,
  type MonitorDestination,
} from "@/components/monitor/MonitorLanding";
import {
  FloatingMonitoringCard,
  type MonitorCategoryOption,
} from "@/components/map/FloatingMonitoringCard";
import { MapControls } from "@/components/map/MapControls";
import { MarkerInfoPopup } from "@/components/map/MarkerInfoPopup";
import { LiveStatusPill } from "@/components/map/LiveStatusPill";
import {
  ALL_SOURCES_FILTER,
  SourceFilterList,
  SourceGlobalFeedPanel,
  buildSourceFilterOptions,
} from "@/components/source-intelligence/SourceGlobalFeedPanel";
import { useSourceIntelligenceItems } from "@/components/source-intelligence/useSourceIntelligenceItems";
import { BookmarksView } from "@/components/events/BookmarksView";
import { useBookmarks } from "@/components/events/useBookmarks";
import { SignalsPanel } from "@/components/signals/SignalsPanel";
import { SocmintDetailModal } from "@/components/signals/SocmintDetailModal";
import { SignalsFloatingCard } from "@/components/signals/SignalsFloatingCard";
import { SourcesScreen } from "@/components/sources/SourcesScreen";
import { PolicyDossierScreen } from "@/components/policy/PolicyDossierScreen";
import { prefetchPolicyFeed } from "@/components/policy/usePolicyFeed";
import { CyberSecPanel } from "@/components/cyber/CyberSecPanel";
import { prefetchCyberNewsFeed } from "@/components/cyber/useCyberNewsFeed";
import { IntelWatchPanel } from "@/components/intel-watch/IntelWatchPanel";
import { sendToIntelWatch } from "@/components/intel-watch/workspaceStore";
import { DefenseIndustryPanel } from "@/components/defense-industry/DefenseIndustryPanel";
import { prefetchDefenseIndustryFeed } from "@/components/defense-industry/useDefenseIndustryFeed";
import { ContactScreen } from "@/components/contact/ContactScreen";
import { AirTrackScreen } from "@/components/airtrack/AirTrackScreen";
import { socmintReports } from "@/data/socmintReports";
import type { RegionKey } from "@/types/event";
import { socmintMatchesConfidenceFilter } from "@/types/socmint";
import { domainTags } from "@/data/source-intelligence/filters/geopoliticalFilterRules";
import type { SourceFilterDomain } from "@/data/source-intelligence/sourceIntelligenceTypes";
import type { SourceMarkerFeature } from "@/data/source-intelligence/markers/sourceMarkerTypes";
import { buildGlobeActivitySnapshot } from "@/data/source-intelligence/buildGlobeActivitySnapshot";

export type ViewMode = "situation" | "global" | "signals";
type ActiveSection = "dashboard" | "sources" | "bookmarks" | "airtrack";
type ActiveTopTab = "situation" | "politics" | "intel" | "cyber" | "defense" | "sources" | "contact";
type ActiveRailMode = "global" | "signals" | null;
type SignalCoverage = RegionKey | "global";
type MarkerPopupState = { kind: "global" | "signals"; id: string } | null;

// Screen-space framing for the work-view globes — same free-zone edges the
// MapLibre globe used: the floating card on the left, MapControls + feed panel
// on the right. Keeps the sphere centered in the open area, not behind a panel.
const GLOBE_SCREEN_FRAMING = { left: 220, right: 422 } as const;

function regionFromGeography(
  geography: GlobeGeographySelection,
): RegionKey {
  const { lng, lat } = geography;
  if (lng >= 25 && lng <= 67 && lat >= 10 && lat <= 45) {
    return "middle-east";
  }
  if (lng >= -22 && lng <= 55 && lat >= -38 && lat < 37) {
    return "africa";
  }
  if (lng >= -25 && lng <= 65 && lat >= 35 && lat <= 72) {
    return "europe";
  }
  if (lng >= 55 || lng <= -150) return "asia-pacific";
  return "americas";
}

function filterSourceMarkerItems(
  marker: SourceMarkerFeature,
  predicate: (item: SourceMarkerFeature["items"][number]) => boolean,
): SourceMarkerFeature | null {
  const items = marker.items.filter(predicate);
  if (items.length === 0) return null;

  const lead = items.reduce((best, item) =>
    item.priorityScore > best.priorityScore ? item : best,
  );

  return {
    ...marker,
    itemCount: items.length,
    items,
    candidate: {
      ...marker.candidate,
      eventId: lead.id,
      itemIds: items.map((item) => item.id),
      title: lead.title,
      summary: lead.summary,
      sourceBasis: lead.sourceBasis,
      tags: Array.from(new Set(items.flatMap((item) => item.tags))),
    },
  };
}

export function AppShell() {
  const homeGlobeRef = useRef<EchisGlobeHandle | null>(null);
  const globalGlobeRef = useRef<EchisGlobeHandle | null>(null);
  const signalsGlobeRef = useRef<EchisGlobeHandle | null>(null);
  const gatewayEntryTimerRef = useRef<number | null>(null);

  // Warm the globe border + label data while the opening screen is idle, so the
  // data screens' borders/labels are ready on first open instead of queueing
  // behind the RSS calls and appearing late.
  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (idle) {
      const id = idle(() => prefetchGlobeData(), { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => prefetchGlobeData(), 800);
    return () => window.clearTimeout(timer);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markerPopup, setMarkerPopup] = useState<MarkerPopupState>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTopTab, setActiveTopTab] = useState<ActiveTopTab>("situation");
  const [activeRailMode, setActiveRailMode] = useState<ActiveRailMode>(null);
  const [activeView, setActiveView] = useState<ViewMode>("situation");
  const [activeRegion, setActiveRegion] = useState<RegionKey>("middle-east");
  const [activeSourceCategory, setActiveSourceCategory] = useState<SourceFilterDomain | "all">("all");
  const [activeSignalRegion, setActiveSignalRegion] = useState<SignalCoverage>("global");
  const [workspaceGeography, setWorkspaceGeography] =
    useState<GlobeGeographySelection | null>(null);
  const [gatewayEntry, setGatewayEntry] =
    useState<MonitorDestination | null>(null);
  const [signalConfidenceMin, setSignalConfidenceMin] = useState(0);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [signalDetailOpen, setSignalDetailOpen] = useState(false);
  // Single source of truth for the active source item across feed, marker popup,
  // and pager.  All three UI surfaces read from / write to this one value so
  // they can never disagree.
  const [selectedSourceItemId, setSelectedSourceItemId] = useState<string | null>(null);
  const [selectedSourceFilterId, setSelectedSourceFilterId] =
    useState(ALL_SOURCES_FILTER);
  const [monitorCardCollapsed, setMonitorCardCollapsed] = useState(false);
  const [sourceFilterCollapsed, setSourceFilterCollapsed] = useState(false);
  // Each map surface owns a distinct globe lifecycle. Only the active screen's
  // instance is mounted, so Home, Global View, and SOCMINT never share camera
  // state or retain hidden WebGL renderers.
  const getActiveGlobe = useCallback(() => {
    if (activeRailMode === null) return homeGlobeRef.current;
    return activeRailMode === "global"
      ? globalGlobeRef.current
      : signalsGlobeRef.current;
  }, [activeRailMode]);

  // Warm the Cyber News + Defense Industry feed caches at app open so those
  // tabs render instantly instead of re-fetching on first visit.
  useEffect(() => {
    prefetchCyberNewsFeed();
    prefetchDefenseIndustryFeed();
    prefetchPolicyFeed();
  }, []);

  useEffect(
    () => () => {
      if (gatewayEntryTimerRef.current !== null) {
        window.clearTimeout(gatewayEntryTimerRef.current);
      }
    },
    [],
  );
  const {
    bookmarkedItems,
    isBookmarked,
    toggleBookmark,
    isSourceBookmarked,
    toggleSourceBookmark,
    removeBookmark,
    clearBookmarks,
  } = useBookmarks(socmintReports);

  // Same accepted source-intelligence candidates drive the feed and map pins.
  const {
    items: sourceItems,
    markers: sourceMarkers,
    loadState: sourceLoadState,
  } = useSourceIntelligenceItems();

  const globeActivitySnapshot = useMemo(
    () =>
      buildGlobeActivitySnapshot({
        items: sourceItems,
        markers: sourceMarkers,
        loadState: sourceLoadState,
      }),
    [sourceItems, sourceMarkers, sourceLoadState],
  );

  const sourceCategoryOptions = useMemo<MonitorCategoryOption[]>(() => {
    const counts = new Map<SourceFilterDomain, number>();
    for (const item of sourceItems) {
      counts.set(item.primaryDomain, (counts.get(item.primaryDomain) ?? 0) + 1);
    }

    const domainOptions = (Object.keys(domainTags) as SourceFilterDomain[])
      .filter((domain) => counts.has(domain))
      .map((domain) => ({
        key: domain,
        label: domainTags[domain],
      }));

    return [{ key: "all", label: "All Source Categories" }, ...domainOptions];
  }, [sourceItems]);

  const sourceCategoryItems = useMemo(
    () =>
      activeSourceCategory === "all"
        ? sourceItems
        : sourceItems.filter((item) => item.primaryDomain === activeSourceCategory),
    [activeSourceCategory, sourceItems],
  );
  const sourceFilterOptions = useMemo(
    () => buildSourceFilterOptions(sourceCategoryItems),
    [sourceCategoryItems],
  );
  const effectiveSourceFilterId = useMemo(() => {
    if (selectedSourceFilterId === ALL_SOURCES_FILTER) return ALL_SOURCES_FILTER;
    return sourceFilterOptions.some((source) => source.id === selectedSourceFilterId)
      ? selectedSourceFilterId
      : ALL_SOURCES_FILTER;
  }, [selectedSourceFilterId, sourceFilterOptions]);
  const displayedSourceItems = useMemo(
    () =>
      effectiveSourceFilterId === ALL_SOURCES_FILTER
        ? sourceCategoryItems
        : sourceCategoryItems.filter((item) => item.sourceId === effectiveSourceFilterId),
    [effectiveSourceFilterId, sourceCategoryItems],
  );

  const displayedSourceMarkers = useMemo(
    () => {
      const predicate = (item: SourceMarkerFeature["items"][number]) =>
        (activeSourceCategory === "all" ||
          item.primaryDomain === activeSourceCategory) &&
        (effectiveSourceFilterId === ALL_SOURCES_FILTER ||
          item.sourceId === effectiveSourceFilterId);

      return sourceMarkers
        .map((marker) => filterSourceMarkerItems(marker, predicate))
        .filter((marker): marker is SourceMarkerFeature => marker !== null);
    },
    [activeSourceCategory, effectiveSourceFilterId, sourceMarkers],
  );

  // O(1) lookup: source item id -> { markerId, itemIndex }.
  // Used by the feed-click handler to find the correct marker and item position
  // without scanning the filtered source marker array on every click.
  const sourceItemKeyToMarker = useMemo(() => {
    const map = new Map<string, { markerId: string; itemIndex: number }>();
    for (const m of displayedSourceMarkers) {
      m.items.forEach((item, idx) => {
        map.set(item.id, { markerId: m.id, itemIndex: idx });
      });
    }
    return map;
  }, [displayedSourceMarkers]);

  // Stable refs so the focus effects below only re-run when the selected ID
  // changes, not when the rail mode changes (avoids spurious camera jumps
  // when switching view modes while a selection is already active).
  const activeRailModeRef = useRef(activeRailMode);
  useEffect(() => { activeRailModeRef.current = activeRailMode; }, [activeRailMode]);

  // When a SOCMINT report is selected, pan to its marker coordinates.
  useEffect(() => {
    if (!selectedSignalId || activeRailModeRef.current !== "signals") return;
    const report = socmintReports.find((r) => r.id === selectedSignalId);
    if (!report?.coordinates) return;
    getActiveGlobe()?.focusMarker(report.coordinates[0], report.coordinates[1]);
  }, [getActiveGlobe, selectedSignalId]);


  const displayedSignals = useMemo(
    () =>
      activeRailMode === "signals"
        ? socmintReports
            .filter((report) => socmintMatchesConfidenceFilter(report, signalConfidenceMin))
            .filter((s) => activeSignalRegion === "global" || s.region === activeSignalRegion)
        : [],
    [activeRailMode, activeSignalRegion, signalConfidenceMin],
  );

  const isMapScreen = activeSection === "dashboard" && activeTopTab === "situation";
  const activeMapRailMode = isMapScreen ? activeRailMode : null;
  const mapControlPanelOffset =
    activeMapRailMode === "global" ? 390 : activeMapRailMode === "signals" ? 390 : 0;

  // Source marker popup — Global View markers all come from the source
  // intelligence pipeline.
  const markerPopupSourceMarker = useMemo(
    () =>
      markerPopup?.kind === "global"
        ? (displayedSourceMarkers.find((m) => m.id === markerPopup.id) ?? null)
        : null,
    [displayedSourceMarkers, markerPopup],
  );
  // Derive the pager index from selectedSourceItemId so the feed highlight and
  // the popup "REPORT XX / NN" label always agree.  Falls back to 0 when the
  // selected item is not part of this marker (e.g. a no-location item was
  // selected after the popup was already open).
  const markerPopupSourceItemIndex = useMemo(() => {
    if (!markerPopupSourceMarker || !selectedSourceItemId) return 0;
    const idx = markerPopupSourceMarker.items.findIndex(
      (it) => it.id === selectedSourceItemId,
    );
    return idx >= 0 ? idx : 0;
  }, [markerPopupSourceMarker, selectedSourceItemId]);

  const markerPopupSourceItem = useMemo(
    () =>
      markerPopupSourceMarker
        ? (markerPopupSourceMarker.items[markerPopupSourceItemIndex] ?? null)
        : null,
    [markerPopupSourceMarker, markerPopupSourceItemIndex],
  );

  // Global View markers — source-intelligence candidates only; the globe
  // renders items that have a deterministic location match in the pipeline.
  // SOCMINT markers are untouched (separate signalsMarkers array below).
  const globalMarkers = useMemo<MarkerFeature[]>(
    () =>
      displayedSourceMarkers.map((marker) => ({
        ...marker,
        severity:
          marker.candidate.severity === "high_interest"
            ? "critical"
            : marker.candidate.severity === "important"
              ? "high"
              : "medium",
      })),
    [displayedSourceMarkers],
  );

  const signalsMarkers = useMemo<MarkerFeature[]>(
    () =>
      displayedSignals.map((s) => ({
        id: s.id,
        lng: s.coordinates[0],
        lat: s.coordinates[1],
        confidence: s.confidence,
      })),
    [displayedSignals],
  );

  // three.js globe marker contract — severity → level, same source arrays.
  const globalViewGlobeMarkers = useMemo(
    () => markersFromFeatures(globalMarkers),
    [globalMarkers],
  );
  const signalsGlobeMarkers = useMemo(
    () => markersFromFeatures(signalsMarkers),
    [signalsMarkers],
  );

  // Region framing — picking a region in the monitoring / signals card moves
  // the globe to that region's centre (same table the MapLibre globe framed
  // with); the "global" coverage option returns to the default camera.
  useEffect(() => {
    if (activeMapRailMode !== "global") return;
    const globe = globalGlobeRef.current;
    if (!globe) return;
    if (activeView === "global") {
      globe.centerView();
      return;
    }
    const view = REGION_GLOBE_VIEWS[activeRegion];
    globe.focusMarker(view.center[0], view.center[1]);
  }, [activeMapRailMode, activeView, activeRegion]);

  useEffect(() => {
    if (activeMapRailMode !== "signals") return;
    const globe = signalsGlobeRef.current;
    if (!globe) return;
    if (activeSignalRegion === "global") {
      globe.centerView();
      return;
    }
    const view = REGION_GLOBE_VIEWS[activeSignalRegion];
    globe.focusMarker(view.center[0], view.center[1]);
  }, [activeMapRailMode, activeSignalRegion]);

  const selectedSignalReport = useMemo(
    () => displayedSignals.find((report) => report.id === selectedSignalId) ?? null,
    [displayedSignals, selectedSignalId],
  );
  const markerPopupSignal = useMemo(
    () =>
      markerPopup?.kind === "signals"
        ? displayedSignals.find((report) => report.id === markerPopup.id) ?? null
        : null,
    [displayedSignals, markerPopup],
  );

  function handleViewChange(view: ViewMode) {
    setActiveSection("dashboard");
    setActiveTopTab("situation");
    setActiveView(view);
    setActiveSourceCategory("all");
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setMarkerPopup(null);
    setSelectedSignalId(null);
    setSignalDetailOpen(false);
    if (view === "global") {
      setActiveRailMode("global");
      return;
    }
    if (view === "signals") {
      setActiveRailMode("signals");
      return;
    }
    setActiveRailMode(null);
    setActiveRegion("middle-east");
  }

  function handleHomeReset() {
    setActiveSection("dashboard");
    setActiveTopTab("situation");
    setActiveRailMode(null);
    setActiveView("situation");
    setActiveRegion("middle-east");
    setActiveSourceCategory("all");
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setMarkerPopup(null);
    setSelectedSignalId(null);
    setSignalDetailOpen(false);
  }

  function handleBookmarksOpen() {
    setActiveSection("bookmarks");
    setActiveTopTab("situation");
    setActiveRailMode(null);
    setSelectedId(null);
    setMarkerPopup(null);
    setSelectedSignalId(null);
    setSignalDetailOpen(false);
  }

  function handleAirTrackOpen() {
    setActiveSection("airtrack");
    setActiveTopTab("situation");
    setActiveRailMode(null);
    setSelectedId(null);
    setMarkerPopup(null);
    setSelectedSignalId(null);
    setSignalDetailOpen(false);
  }

  function handleMonitorNavigate(
    destination: MonitorDestination,
    geography: GlobeGeographySelection | null,
  ) {
    if (geography) {
      setWorkspaceGeography(geography);
      const region = regionFromGeography(geography);
      setActiveRegion(region);
      setActiveSignalRegion(region);
    }

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGatewayEntry(destination);
      if (gatewayEntryTimerRef.current !== null) {
        window.clearTimeout(gatewayEntryTimerRef.current);
      }
      gatewayEntryTimerRef.current = window.setTimeout(() => {
        setGatewayEntry(null);
        gatewayEntryTimerRef.current = null;
      }, 560);
    }

    if (destination === "global") {
      handleViewChange("global");
      return;
    }
    if (destination === "socmint") {
      handleViewChange("signals");
      return;
    }
    if (destination === "airtrack") {
      handleAirTrackOpen();
      return;
    }
    if (destination === "bookmarks") {
      handleBookmarksOpen();
      return;
    }

    const topTab: ActiveTopTab =
      destination === "policy" ? "politics" : destination;
    handleTopTabSelect(topTab);
  }

  function handleRegionChange(region: RegionKey) {
    setActiveSection("dashboard");
    setActiveTopTab("situation");
    setActiveRailMode("global");
    setActiveRegion(region);
    setActiveView("situation");
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setMarkerPopup(null);
  }

  function handleSourceCategoryChange(category: string) {
    setActiveSourceCategory(
      category === "all" ? "all" : (category as SourceFilterDomain),
    );
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setSelectedSourceItemId(null);
    setMarkerPopup(null);
  }

  function handleSourceFilterChange(sourceId: string) {
    setSelectedSourceFilterId(sourceId);
    setSelectedId(null);
    setSelectedSourceItemId(null);
    setMarkerPopup(null);
  }

  function handleTopTabSelect(tab: ActiveTopTab) {
    if (tab === "sources") {
      setActiveSection("sources");
      setActiveTopTab("sources");
      setActiveRailMode(null);
      setSelectedSourceFilterId(ALL_SOURCES_FILTER);
      setSelectedId(null);
      setMarkerPopup(null);
      setSelectedSignalId(null);
      setSignalDetailOpen(false);
      return;
    }

    if (tab === "politics") {
      setActiveSection("dashboard");
      setActiveTopTab("politics");
      setActiveRailMode("global");
      setActiveView("global");
      setActiveRegion("middle-east");
      setSelectedSourceFilterId(ALL_SOURCES_FILTER);
      setSelectedId(null);
      setMarkerPopup(null);
      setSelectedSignalId(null);
      setSignalDetailOpen(false);
      return;
    }

    if (tab === "intel" || tab === "cyber" || tab === "defense" || tab === "contact") {
      setActiveSection("dashboard");
      setActiveTopTab(tab);
      setActiveRailMode(null);
      setActiveSourceCategory("all");
      setSelectedSourceFilterId(ALL_SOURCES_FILTER);
      setSelectedId(null);
      setMarkerPopup(null);
      setSelectedSignalId(null);
      setSignalDetailOpen(false);
      return;
    }

    handleViewChange("situation");
  }

  // Same interaction contract as Global View: a feed card click focuses the
  // marker on the globe and opens the on-globe popup; the detail modal opens
  // from the card's detail toggle instead.
  function handleSignalSelect(id: string) {
    setSelectedSignalId(id);
    setSignalDetailOpen(false);
    setMarkerPopup({ kind: "signals", id });
    const report = socmintReports.find((r) => r.id === id);
    if (report?.coordinates) {
      getActiveGlobe()?.focusMarker(report.coordinates[0], report.coordinates[1]);
    }
  }

  function handleSignalDetailOpen(id: string) {
    setSelectedSignalId(id);
    setMarkerPopup(null);
    setSignalDetailOpen(true);
  }

  function handleGlobalMarkerSelect(id: string) {
    setSelectedId(id);
    setMarkerPopup({ kind: "global", id });
    // For source markers: default to the first item unless the currently selected
    // item already belongs to this marker (e.g. user re-clicks the same pin).
    const sourceMarker = displayedSourceMarkers.find((m) => m.id === id);
    if (sourceMarker) {
      const currentBelongs = sourceMarker.items.some(
        (it) => it.id === selectedSourceItemId,
      );
      if (!currentBelongs) {
        setSelectedSourceItemId(sourceMarker.items[0]?.id ?? null);
      }
      getActiveGlobe()?.focusMarker(sourceMarker.lng, sourceMarker.lat);
    }
  }

  function handleSignalMarkerSelect(id: string) {
    setSelectedSignalId(id);
    setSignalDetailOpen(false);
    setMarkerPopup({ kind: "signals", id });
  }

  function handleMarkerPopupClose() {
    if (markerPopup?.kind === "global") {
      setSelectedId(null);
      setSelectedSourceItemId(null);
    }
    if (markerPopup?.kind === "signals") {
      setSelectedSignalId(null);
    }
    setMarkerPopup(null);
  }

  function handleSignalDetailClose() {
    setSignalDetailOpen(false);
    setSelectedSignalId(null);
    setMarkerPopup(null);
  }

  const getMarkerPopupPosition = useCallback(() => {
    // The globe reports whether the point is on the near hemisphere; a marker
    // that has rotated to the back projects to a mirrored screen point, so it
    // must read as "no position" rather than a popup floating over open space.
    const project = (lng: number, lat: number) => {
      const projected = getActiveGlobe()?.projectMarker(lng, lat) ?? null;
      if (!projected) return null;
      return projected.visible === false ? null : projected;
    };
    // Source marker: use pipeline-resolved coordinates directly.
    if (markerPopup?.kind === "global" && markerPopupSourceMarker) {
      return project(markerPopupSourceMarker.lng, markerPopupSourceMarker.lat);
    }
    if (markerPopup?.kind === "signals" && markerPopupSignal?.coordinates) {
      return project(
        markerPopupSignal.coordinates[0],
        markerPopupSignal.coordinates[1],
      );
    }
    return null;
  }, [
    getActiveGlobe,
    markerPopup,
    markerPopupSourceMarker,
    markerPopupSignal,
  ]);

  return (
    <div
      className="cyber-premium flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "var(--c-bg-base)" }}
    >
      <HeaderNav
        activeTab={activeTopTab}
        onTabSelect={handleTopTabSelect}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftRail
          activeView={activeSection === "dashboard" && activeTopTab === "situation" ? activeRailMode : null}
          activeBookmarks={activeSection === "bookmarks"}
          activeAirTrack={activeSection === "airtrack"}
          onViewChange={handleViewChange}
          onBookmarks={handleBookmarksOpen}
          onAirTrack={handleAirTrackOpen}
          onHome={handleHomeReset}
        />

        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              opacity: isMapScreen ? 1 : 0,
              pointerEvents: isMapScreen ? "auto" : "none",
              transition: "opacity 120ms ease",
            }}
          >
            {isMapScreen && activeMapRailMode === null && (
              <div
                className="absolute inset-0"
                style={{ zIndex: 1 }}
              >
                <MonitorLanding
                  ref={homeGlobeRef}
                  onNavigate={handleMonitorNavigate}
                  selectedGeography={workspaceGeography}
                  onGeographyChange={setWorkspaceGeography}
                  activitySnapshot={globeActivitySnapshot}
                  bookmarkCount={bookmarkedItems.length}
                />
              </div>
            )}
            {isMapScreen && activeMapRailMode === "global" && (
              <div
                className="absolute inset-0"
                style={{ zIndex: 1 }}
              >
                <ScreenGlobe
                  key="global-view-globe"
                  ref={globalGlobeRef}
                  framing={GLOBE_SCREEN_FRAMING}
                  markerShape="pin"
                  markers={globalViewGlobeMarkers}
                  selectedMarkerId={selectedId}
                  onMarkerSelect={handleGlobalMarkerSelect}
                  caption="GLOBAL VIEW"
                />
              </div>
            )}
            {isMapScreen && activeMapRailMode === "signals" && (
              <div
                className="absolute inset-0"
                style={{ zIndex: 1 }}
              >
                <ScreenGlobe
                  key="socmint-globe"
                  ref={signalsGlobeRef}
                  framing={GLOBE_SCREEN_FRAMING}
                  markers={signalsGlobeMarkers}
                  selectedMarkerId={selectedSignalId}
                  onMarkerSelect={handleSignalMarkerSelect}
                  caption="SOCMINT WATCH"
                />
              </div>
            )}
            <div
              style={{
                opacity: activeMapRailMode === "signals" ? 1 : 0,
                pointerEvents: activeMapRailMode === "signals" ? "auto" : "none",
                transition: "opacity 120ms ease",
              }}
            >
              <SignalsFloatingCard
                activeRegion={activeSignalRegion}
                confidenceMin={signalConfidenceMin}
                onRegionChange={(region) => {
                  setActiveSignalRegion(region);
                  setSelectedSignalId(null);
                  setSignalDetailOpen(false);
                  setMarkerPopup(null);
                }}
                onConfidenceChange={(min) => {
                  setSignalConfidenceMin(min);
                  setSelectedSignalId(null);
                  setSignalDetailOpen(false);
                  setMarkerPopup(null);
                }}
              />
            </div>
            <div
              style={{
                opacity: activeMapRailMode === "global" ? 1 : 0,
                pointerEvents: activeMapRailMode === "global" ? "auto" : "none",
                transition: "opacity 120ms ease",
              }}
            >
              <FloatingMonitoringCard
                view={activeView}
                activeRegion={activeRegion}
                activeCategory={activeSourceCategory}
                categoryOptions={sourceCategoryOptions}
                isPoliticsWatch={false}
                eventCount={displayedSourceItems.length}
                onViewChange={handleViewChange}
                onRegionChange={handleRegionChange}
                onCategoryChange={handleSourceCategoryChange}
                onCollapsedChange={setMonitorCardCollapsed}
              />
              {(sourceLoadState === "loaded" || sourceLoadState === "partial") && (
                <div
                  style={{
                    position: "absolute",
                    top: monitorCardCollapsed ? "64px" : "286px",
                    left: "16px",
                    width: sourceFilterCollapsed ? "auto" : "206px",
                    zIndex: 10,
                    transition: "top 160ms ease",
                  }}
                >
                  <SourceFilterList
                    standalone
                    collapsed={sourceFilterCollapsed}
                    onCollapsedChange={setSourceFilterCollapsed}
                    options={sourceFilterOptions}
                    totalCount={sourceCategoryItems.length}
                    selectedSourceId={effectiveSourceFilterId}
                    onSelectSource={handleSourceFilterChange}
                  />
                </div>
              )}
            </div>
            {activeMapRailMode !== null && (
              <MapControls
                onCenterView={() => getActiveGlobe()?.centerView()}
                onZoomIn={() => getActiveGlobe()?.zoomIn()}
                onZoomOut={() => getActiveGlobe()?.zoomOut()}
                panelOffset={mapControlPanelOffset}
              />
            )}
            {activeMapRailMode !== null && (
              <LiveStatusPill panelOffset={mapControlPanelOffset} />
            )}

            <div
              style={{
                position: "absolute",
                top: "16px",
                right: "14px",
                bottom: "10px",
                width: "372px",
                zIndex: 14,
                transform:
                  activeMapRailMode === "global"
                    ? "translateX(0)"
                    : "translateX(calc(100% + 14px))",
                opacity: activeMapRailMode === "global" ? 1 : 0,
                transition: "transform 180ms ease, opacity 120ms ease",
                willChange: "transform",
                pointerEvents: activeMapRailMode === "global" ? "auto" : "none",
              }}
            >
              {activeMapRailMode === "global" && (
                <SourceGlobalFeedPanel
                  selectedItemId={selectedSourceItemId}
                  items={displayedSourceItems}
                  selectedSourceId={effectiveSourceFilterId}
                  isItemBookmarked={isSourceBookmarked}
                  onToggleItemBookmark={(item) =>
                    toggleSourceBookmark({
                      id: item.id,
                      title: item.title,
                      summary: item.summary,
                      sourceName: item.sourceName,
                      url: item.url,
                      publishedAt: item.publishedAt,
                      domainLabel: domainTags[item.primaryDomain],
                    })
                  }
                  onItemSelect={(itemId) => {
                    const entry = sourceItemKeyToMarker.get(itemId);
                    if (entry) {
                      // Item has a deterministic location — sync popup + globe.
                      // Set selectedSourceItemId first so the derived index is
                      // already correct when the popup re-renders.
                      setSelectedSourceItemId(itemId);
                      const grouped = displayedSourceMarkers.find(
                        (m) => m.id === entry.markerId,
                      );
                      if (grouped) {
                        setSelectedId(entry.markerId);
                        setMarkerPopup({ kind: "global", id: entry.markerId });
                        getActiveGlobe()?.focusMarker(
                          grouped.lng,
                          grouped.lat,
                        );
                      }
                    } else {
                      // No location match — update feed highlight only;
                      // do not open or change the marker popup.
                      setSelectedSourceItemId(itemId);
                    }
                  }}
                />
              )}
            </div>
            {activeMapRailMode === "global" && markerPopupSourceItem && markerPopupSourceMarker && (
              <MarkerInfoPopup
                title={markerPopupSourceItem.title}
                location={markerPopupSourceMarker.locationName}
                summary={markerPopupSourceItem.summary ?? ""}
                source={markerPopupSourceItem.sourceName}
                time={markerPopupSourceItem.publishedAt}
                accent="var(--accent-blue-text)"
                getPosition={getMarkerPopupPosition}
                onClose={handleMarkerPopupClose}
                onSendToIntelWatch={() =>
                  sendToIntelWatch({
                    itemId: markerPopupSourceItem.id,
                    lng: markerPopupSourceMarker.lng,
                    lat: markerPopupSourceMarker.lat,
                    title: markerPopupSourceItem.title,
                    source: markerPopupSourceItem.sourceName,
                    updated: markerPopupSourceItem.publishedAt ?? "—",
                    note: markerPopupSourceItem.summary,
                  })
                }
                itemIndex={markerPopupSourceItemIndex}
                itemCount={markerPopupSourceMarker.items.length}
                onPrev={() => {
                  const prev =
                    markerPopupSourceMarker.items[markerPopupSourceItemIndex - 1];
                  if (prev) setSelectedSourceItemId(prev.id);
                }}
                onNext={() => {
                  const next =
                    markerPopupSourceMarker.items[markerPopupSourceItemIndex + 1];
                  if (next) setSelectedSourceItemId(next.id);
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                top: "16px",
                right: "14px",
                bottom: "10px",
                width: "372px",
                zIndex: 14,
                transform: activeMapRailMode === "signals" ? "translateX(0)" : "translateX(calc(100% + 14px))",
                opacity: activeMapRailMode === "signals" ? 1 : 0,
                transition: "transform 180ms ease, opacity 120ms ease",
                willChange: "transform",
                pointerEvents: activeMapRailMode === "signals" ? "auto" : "none",
              }}
            >
              <SignalsPanel
                signals={displayedSignals}
                confidenceMin={signalConfidenceMin}
                selectedId={selectedSignalId}
                onSelect={handleSignalSelect}
                onOpenDetail={handleSignalDetailOpen}
                isBookmarked={isBookmarked}
                onToggleBookmark={toggleBookmark}
              />
            </div>
            {activeMapRailMode === "signals" && signalDetailOpen && selectedSignalReport && (
              <SocmintDetailModal
                report={selectedSignalReport}
                onClose={handleSignalDetailClose}
              />
            )}
            {activeMapRailMode === "signals" && markerPopupSignal && (
              <MarkerInfoPopup
                title={markerPopupSignal.title}
                location={markerPopupSignal.locationName}
                summary={markerPopupSignal.summary}
                source={markerPopupSignal.sourceName}
                time={markerPopupSignal.timestamp}
                accent="var(--accent-blue-text)"
                getPosition={getMarkerPopupPosition}
                onClose={handleMarkerPopupClose}
                onSendToIntelWatch={() =>
                  sendToIntelWatch({
                    itemId: markerPopupSignal.id,
                    lng: markerPopupSignal.coordinates[0],
                    lat: markerPopupSignal.coordinates[1],
                    title: markerPopupSignal.title,
                    source: markerPopupSignal.sourceName,
                    updated: markerPopupSignal.timestamp,
                    note: markerPopupSignal.summary,
                  })
                }
              />
            )}
          </div>

          {activeSection === "sources" && (
            <div className={`${gatewayEntry === "sources" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <SourcesScreen />
            </div>
          )}
          {activeSection === "airtrack" && (
            <div className={`${gatewayEntry === "airtrack" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <AirTrackScreen />
            </div>
          )}
          {activeSection === "bookmarks" && (
            <div className={`${gatewayEntry === "bookmarks" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <BookmarksView
                items={bookmarkedItems}
                onRemoveBookmark={removeBookmark}
                onClearBookmarks={clearBookmarks}
              />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "politics" && (
            <div className={`${gatewayEntry === "policy" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <PolicyDossierScreen />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "cyber" && (
            <div className={`${gatewayEntry === "cyber" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <CyberSecPanel />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "intel" && (
            <div className={`${gatewayEntry === "intel" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <IntelWatchPanel />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "defense" && (
            <div className={`${gatewayEntry === "defense" ? "gateway-screen-enter" : "ui-fade-in"} absolute inset-0 z-20 flex flex-col overflow-hidden`}>
              <DefenseIndustryPanel />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "contact" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <ContactScreen />
            </div>
          )}

          {workspaceGeography &&
            !(isMapScreen && activeMapRailMode === null) && (
              <div
                className="absolute left-1/2 top-3 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5"
                style={{
                  color: "var(--c-t3)",
                  background: "rgba(7, 6, 8, 0.88)",
                  border: "1px solid rgba(242, 56, 77, 0.2)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.34)",
                  backdropFilter: "blur(10px)",
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: "7px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                <span style={{ color: "rgba(242, 87, 105, 0.82)" }}>
                  Geography
                </span>
                <i
                  aria-hidden
                  style={{
                    width: "18px",
                    height: "1px",
                    background:
                      "linear-gradient(90deg, rgba(242,56,77,.55), transparent)",
                  }}
                />
                <strong
                  style={{
                    color: "rgba(225, 229, 235, 0.9)",
                    fontWeight: 650,
                  }}
                >
                  {workspaceGeography.name}
                </strong>
                <button
                  type="button"
                  aria-label="Clear workspace geography"
                  onClick={() => setWorkspaceGeography(null)}
                  className="ml-1 grid h-4 w-4 place-items-center rounded-full transition-colors"
                  style={{
                    color: "rgba(151, 160, 174, 0.7)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  ×
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
