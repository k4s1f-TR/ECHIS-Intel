"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Map as MapIcon } from "lucide-react";
import { LeftRail } from "./LeftRail";
import { HeaderNav } from "./HeaderNav";
// Luxe and MapLibre share the same map handle / marker contract so the user
// can switch engines without changing the surrounding monitor workflow.
import { LuxeGlobeMap } from "@/components/luxe/LuxeGlobeMap";
import {
  MapLibreGlobe,
  type MapLibreGlobeHandle,
  type MarkerFeature,
} from "@/components/maplibre/MapLibreGlobe";
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
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { BookmarksView } from "@/components/events/BookmarksView";
import { useBookmarks } from "@/components/events/useBookmarks";
import { SignalsPanel } from "@/components/signals/SignalsPanel";
import { SocmintDetailModal } from "@/components/signals/SocmintDetailModal";
import { SignalsFloatingCard } from "@/components/signals/SignalsFloatingCard";
import { SourcesScreen } from "@/components/sources/SourcesScreen";
import { PolicyDossierScreen } from "@/components/policy/PolicyDossierScreen";
import { CyberSecPanel } from "@/components/cyber/CyberSecPanel";
import { IntelWatchPanel } from "@/components/intel-watch/IntelWatchPanel";
import { DefenseIndustryPanel } from "@/components/defense-industry/DefenseIndustryPanel";
import { mockEvents } from "@/data/mockEvents";
import { socmintReports } from "@/data/socmintReports";
import type { EventCategory, RegionKey } from "@/types/event";
import { socmintMatchesConfidenceFilter } from "@/types/socmint";
import { domainTags } from "@/data/source-intelligence/filters/geopoliticalFilterRules";
import type { SourceFilterDomain } from "@/data/source-intelligence/sourceIntelligenceTypes";
import type { SourceMarkerFeature } from "@/data/source-intelligence/markers/sourceMarkerTypes";

export type ViewMode = "situation" | "global" | "signals";
type ActiveSection = "dashboard" | "sources" | "bookmarks";
type ActiveTopTab = "situation" | "politics" | "intel" | "cyber" | "defense" | "sources";
type ActiveRailMode = "global" | "signals" | null;
type SignalCoverage = RegionKey | "global";
type MarkerPopupState = { kind: "global" | "signals"; id: string } | null;
type MapSystem = "luxe" | "maplibre";
const DEFAULT_MAP_SYSTEM: MapSystem = "maplibre";

const MAP_SYSTEM_OPTIONS = [
  { key: "luxe", label: "Luxe", title: "Use Luxe globe", icon: Globe2 },
  { key: "maplibre", label: "MapLibre", title: "Use MapLibre globe", icon: MapIcon },
] as const;

function MapSystemSwitch({
  value,
  onChange,
  dockedToPanel,
}: {
  value: MapSystem;
  onChange: (value: MapSystem) => void;
  dockedToPanel: boolean;
}) {
  return (
    <div
      aria-label="Map system"
      style={{
        position: "absolute",
        top: 16,
        right: dockedToPanel ? 400 : 14,
        zIndex: 18,
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: 3,
        borderRadius: 9,
        background: "rgba(7,8,10,0.72)",
        border: "1px solid var(--accent-blue-border)",
        boxShadow:
          "0 14px 36px rgba(0,0,0,0.42), 0 0 18px rgba(255,43,61,0.10), 0 1px 0 rgba(255,255,255,0.04) inset",
        backdropFilter: "blur(14px)",
        transition: "right 180ms ease, opacity 120ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          top: 0,
          height: 1,
          background: "var(--accent-grad)",
          opacity: 0.92,
        }}
      />
      {MAP_SYSTEM_OPTIONS.map(({ key, label, title, icon: Icon }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            title={title}
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className="map-system-switch__btn"
            style={{
              height: 24,
              minWidth: key === "maplibre" ? 82 : 62,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              borderRadius: 6,
              padding: "0 8px",
              border: selected
                ? "1px solid var(--c-accent-border)"
                : "1px solid transparent",
              background: selected ? "var(--c-accent-grad-soft)" : "transparent",
              color: selected ? "#fff4f4" : "var(--c-t4)",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              lineHeight: 1,
              cursor: "pointer",
              transition: "background 150ms ease, color 140ms ease, border-color 150ms ease",
              whiteSpace: "nowrap",
            }}
          >
            <Icon size={11} strokeWidth={1.7} />
            {label}
          </button>
        );
      })}
    </div>
  );
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
  const luxeGlobeRef = useRef<MapLibreGlobeHandle | null>(null);
  const mapLibreGlobeRef = useRef<MapLibreGlobeHandle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [markerPopup, setMarkerPopup] = useState<MarkerPopupState>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTopTab, setActiveTopTab] = useState<ActiveTopTab>("situation");
  const [activeRailMode, setActiveRailMode] = useState<ActiveRailMode>(null);
  const [mapSystem, setMapSystem] = useState<MapSystem>(DEFAULT_MAP_SYSTEM);
  const [mapLibreReady, setMapLibreReady] = useState(false);
  const [shouldMountLuxe, setShouldMountLuxe] = useState(
    DEFAULT_MAP_SYSTEM === "luxe",
  );
  const [activeView, setActiveView] = useState<ViewMode>("situation");
  const [activeRegion, setActiveRegion] = useState<RegionKey>("middle-east");
  const [activeCategory, setActiveCategory] = useState<EventCategory | "all">("all");
  const [activeSourceCategory, setActiveSourceCategory] = useState<SourceFilterDomain | "all">("all");
  const [activeSignalRegion, setActiveSignalRegion] = useState<SignalCoverage>("global");
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
  const getActiveGlobe = useCallback(
    () =>
      mapSystem === "luxe"
        ? luxeGlobeRef.current
        : mapLibreGlobeRef.current,
    [mapSystem],
  );

  useEffect(() => {
    if (!mapLibreReady || shouldMountLuxe) return;

    let idleId: number | null = null;
    const delayId = window.setTimeout(() => {
      const requestIdle = window.requestIdleCallback;
      if (requestIdle) {
        idleId = requestIdle(() => setShouldMountLuxe(true), {
          timeout: 5000,
        });
        return;
      }
      setShouldMountLuxe(true);
    }, 1200);

    return () => {
      window.clearTimeout(delayId);
      if (idleId !== null) window.cancelIdleCallback?.(idleId);
    };
  }, [mapLibreReady, shouldMountLuxe]);

  const handleMapSystemChange = useCallback((next: MapSystem) => {
    if (next === "luxe") setShouldMountLuxe(true);
    setMapSystem(next);
  }, []);
  const { bookmarkedItems, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks } =
    useBookmarks(mockEvents, socmintReports);

  // Same accepted source-intelligence candidates drive the feed and map pins.
  const {
    items: sourceItems,
    markers: sourceMarkers,
    loadState: sourceLoadState,
    pipelineBusy: sourcePipelineBusy,
    loadingBySourceId,
  } = useSourceIntelligenceItems();

  const globalMarkersLoading =
    sourceLoadState === "loading" ||
    sourcePipelineBusy ||
    Object.values(loadingBySourceId).some(Boolean);

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

  // When a Global View event is selected (from panel click or marker click),
  // smoothly pan the globe to that marker's coordinates.
  useEffect(() => {
    if (!selectedId || activeRailModeRef.current !== "global") return;
    const event = mockEvents.find((e) => e.id === selectedId);
    if (!event?.coordinates) return;
    getActiveGlobe()?.focusMarker(event.coordinates.lng, event.coordinates.lat);
  }, [getActiveGlobe, selectedId]);

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
  const globeView =
    activeMapRailMode === "global" || activeMapRailMode === "signals"
      ? activeMapRailMode
      : activeView;
  const globeRegion =
    activeMapRailMode === "global" && activeView !== "global" ? activeRegion : undefined;
  const globeSignalsRegion =
    activeMapRailMode === "signals" && activeSignalRegion !== "global"
      ? activeSignalRegion
      : undefined;
  const mapControlPanelOffset =
    activeMapRailMode === "global" ? 390 : activeMapRailMode === "signals" ? 390 : 0;

  const baseEvents = useMemo(
    () =>
      activeView === "global"
        ? mockEvents
        : mockEvents.filter((e) => e.region === activeRegion),
    [activeView, activeRegion],
  );

  const displayedEvents = useMemo(
    () =>
      activeCategory === "all"
        ? baseEvents
        : baseEvents.filter((e) => e.category === activeCategory),
    [baseEvents, activeCategory],
  );

  const selectedGlobalEvent = useMemo(
    () => displayedEvents.find((event) => event.id === selectedId) ?? null,
    [displayedEvents, selectedId],
  );
  const markerPopupEvent = useMemo(
    () =>
      markerPopup?.kind === "global"
        ? displayedEvents.find((event) => event.id === markerPopup.id) ?? null
        : null,
    [displayedEvents, markerPopup],
  );

  // Source marker popup — used when the clicked marker belongs to a source
  // intelligence item rather than a mock event.
  const markerPopupSourceMarker = useMemo(
    () =>
      markerPopup?.kind === "global" && markerPopupEvent === null
        ? (displayedSourceMarkers.find((m) => m.id === markerPopup.id) ?? null)
        : null,
    [displayedSourceMarkers, markerPopup, markerPopupEvent],
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

  // Global View markers — source-intelligence candidates only.
  // Mock event markers are not shown in Global View; the globe renders only
  // items that have a deterministic location match in the source pipeline.
  // SOCMINT markers are untouched (separate signalsMarkers array below).
  const globalMarkers = useMemo<MarkerFeature[]>(
    () => displayedSourceMarkers,
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
    setActiveCategory("all");
    setActiveSourceCategory("all");
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setEventDetailOpen(false);
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
    setActiveCategory("all");
    setActiveSourceCategory("all");
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
    setSelectedSignalId(null);
    setSignalDetailOpen(false);
  }

  function handleBookmarksOpen() {
    setActiveSection("bookmarks");
    setActiveTopTab("situation");
    setActiveRailMode(null);
    setSelectedId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
    setSelectedSignalId(null);
    setSignalDetailOpen(false);
  }

  function handleRegionChange(region: RegionKey) {
    setActiveSection("dashboard");
    setActiveTopTab("situation");
    setActiveRailMode("global");
    setActiveRegion(region);
    setActiveView("situation");
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
  }

  function handleSourceCategoryChange(category: string) {
    setActiveSourceCategory(
      category === "all" ? "all" : (category as SourceFilterDomain),
    );
    setSelectedSourceFilterId(ALL_SOURCES_FILTER);
    setSelectedId(null);
    setSelectedSourceItemId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
  }

  function handleSourceFilterChange(sourceId: string) {
    setSelectedSourceFilterId(sourceId);
    setSelectedId(null);
    setSelectedSourceItemId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
  }

  function handleTopTabSelect(tab: ActiveTopTab) {
    if (tab === "sources") {
      setActiveSection("sources");
      setActiveTopTab("sources");
      setActiveRailMode(null);
      setSelectedSourceFilterId(ALL_SOURCES_FILTER);
      setSelectedId(null);
      setEventDetailOpen(false);
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
      setActiveCategory("politics");
      setSelectedSourceFilterId(ALL_SOURCES_FILTER);
      setSelectedId(null);
      setEventDetailOpen(false);
      setMarkerPopup(null);
      setSelectedSignalId(null);
      setSignalDetailOpen(false);
      return;
    }

    if (tab === "intel" || tab === "cyber" || tab === "defense") {
      setActiveSection("dashboard");
      setActiveTopTab(tab);
      setActiveRailMode(null);
      setActiveCategory("all");
      setActiveSourceCategory("all");
      setSelectedSourceFilterId(ALL_SOURCES_FILTER);
      setSelectedId(null);
      setEventDetailOpen(false);
      setMarkerPopup(null);
      setSelectedSignalId(null);
      setSignalDetailOpen(false);
      return;
    }

    handleViewChange("situation");
  }

  function handleSignalSelect(id: string) {
    setSelectedSignalId(id);
    setMarkerPopup(null);
    setSignalDetailOpen(true);
  }

  function handleGlobalMarkerSelect(id: string) {
    setSelectedId(id);
    setEventDetailOpen(false);
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

  function handleGlobalDetailClose() {
    setEventDetailOpen(false);
    setSelectedId(null);
    setMarkerPopup(null);
  }

  function handleSignalDetailClose() {
    setSignalDetailOpen(false);
    setSelectedSignalId(null);
    setMarkerPopup(null);
  }

  const getMarkerPopupPosition = useCallback(() => {
    if (markerPopup?.kind === "global" && markerPopupEvent?.coordinates) {
      return (
        getActiveGlobe()?.projectMarker(
          markerPopupEvent.coordinates.lng,
          markerPopupEvent.coordinates.lat,
        ) ?? null
      );
    }
    // Source marker: use pipeline-resolved coordinates directly.
    if (markerPopup?.kind === "global" && markerPopupSourceMarker) {
      return (
        getActiveGlobe()?.projectMarker(
          markerPopupSourceMarker.lng,
          markerPopupSourceMarker.lat,
        ) ?? null
      );
    }
    if (markerPopup?.kind === "signals" && markerPopupSignal?.coordinates) {
      return (
        getActiveGlobe()?.projectMarker(
          markerPopupSignal.coordinates[0],
          markerPopupSignal.coordinates[1],
        ) ?? null
      );
    }
    return null;
  }, [
    getActiveGlobe,
    markerPopup,
    markerPopupEvent,
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
          onViewChange={handleViewChange}
          onBookmarks={handleBookmarksOpen}
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
            {shouldMountLuxe && (
              <div
                className="absolute inset-0"
                aria-hidden={mapSystem !== "luxe"}
                style={{
                  zIndex: mapSystem === "luxe" ? 2 : 1,
                  opacity: mapSystem === "luxe" ? 1 : 0,
                  pointerEvents: mapSystem === "luxe" ? "auto" : "none",
                  transition: "opacity 180ms ease",
                }}
              >
                <LuxeGlobeMap
                  ref={luxeGlobeRef}
                  activeView={globeView}
                  activeRegion={globeRegion}
                  activeSignalsRegion={globeSignalsRegion}
                  globalMarkers={globalMarkers}
                  signalsMarkers={signalsMarkers}
                  globalMarkersLoading={globalMarkersLoading}
                  autoRotatePaused={mapSystem !== "luxe" || !isMapScreen}
                  selectedGlobalId={selectedId}
                  selectedSignalsId={selectedSignalId}
                  onMarkerClick={(id, kind) => {
                    if (kind === "global") handleGlobalMarkerSelect(id);
                    else if (kind === "signals") handleSignalMarkerSelect(id);
                  }}
                />
              </div>
            )}
            <div
              className="absolute inset-0"
              aria-hidden={mapSystem !== "maplibre"}
              style={{
                zIndex: mapSystem === "maplibre" ? 2 : 1,
                opacity: mapSystem === "maplibre" ? 1 : 0,
                pointerEvents: mapSystem === "maplibre" ? "auto" : "none",
                transition: "opacity 180ms ease",
              }}
            >
              <MapLibreGlobe
                ref={mapLibreGlobeRef}
                activeView={globeView}
                activeRegion={globeRegion}
                activeSignalsRegion={globeSignalsRegion}
                globalMarkers={globalMarkers}
                signalsMarkers={signalsMarkers}
                globalMarkersLoading={globalMarkersLoading}
                autoRotatePaused={mapSystem !== "maplibre" || !isMapScreen}
                onReady={() => setMapLibreReady(true)}
                selectedGlobalId={selectedId}
                selectedSignalsId={selectedSignalId}
                onMarkerClick={(id, kind) => {
                  if (kind === "global") handleGlobalMarkerSelect(id);
                  else if (kind === "signals") handleSignalMarkerSelect(id);
                }}
              />
            </div>
            <MapSystemSwitch
              value={mapSystem}
              onChange={handleMapSystemChange}
              dockedToPanel={activeMapRailMode !== null}
            />
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
            <MapControls
              onCenterView={() => getActiveGlobe()?.centerView()}
              onZoomIn={() => getActiveGlobe()?.zoomIn()}
              onZoomOut={() => getActiveGlobe()?.zoomOut()}
              panelOffset={mapControlPanelOffset}
            />
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
                        setEventDetailOpen(false);
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
            {activeMapRailMode === "global" && eventDetailOpen && selectedGlobalEvent && (
              <EventDetailModal
                event={selectedGlobalEvent}
                onClose={handleGlobalDetailClose}
              />
            )}
            {activeMapRailMode === "global" && markerPopupEvent && (
              <MarkerInfoPopup
                title={markerPopupEvent.title}
                location={markerPopupEvent.location}
                summary={markerPopupEvent.summary}
                source={markerPopupEvent.sourceId}
                time={markerPopupEvent.time}
                accent="var(--accent-blue-text)"
                getPosition={getMarkerPopupPosition}
                onClose={handleMarkerPopupClose}
              />
            )}
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
              />
            )}
          </div>

          {activeSection === "sources" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <SourcesScreen />
            </div>
          )}
          {activeSection === "bookmarks" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <BookmarksView
                items={bookmarkedItems}
                onRemoveBookmark={removeBookmark}
                onClearBookmarks={clearBookmarks}
              />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "politics" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <PolicyDossierScreen />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "cyber" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <CyberSecPanel />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "intel" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <IntelWatchPanel />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "defense" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <DefenseIndustryPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
