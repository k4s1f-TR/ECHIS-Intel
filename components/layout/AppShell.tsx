"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LeftRail } from "./LeftRail";
import { HeaderNav } from "./HeaderNav";
import {
  MapLibreGlobe,
  type MapLibreGlobeHandle,
  type MarkerFeature,
} from "@/components/maplibre/MapLibreGlobe";
import { FloatingMonitoringCard } from "@/components/map/FloatingMonitoringCard";
import { MapControls } from "@/components/map/MapControls";
import { MarkerInfoPopup } from "@/components/map/MarkerInfoPopup";
import { LiveStatusPill } from "@/components/map/LiveStatusPill";
import { RssGlobalFeedPanel } from "@/components/events/RssGlobalFeedPanel";
import { useRssPreviewItems } from "@/components/events/useRssPreviewItems";
import { rssItemsToMarkers, type RssMarkerFeature } from "@/data/sources/rssMarkerAdapter";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import { BookmarksView } from "@/components/events/BookmarksView";
import { useBookmarks } from "@/components/events/useBookmarks";
import { SignalsPanel } from "@/components/signals/SignalsPanel";
import { SocmintDetailModal } from "@/components/signals/SocmintDetailModal";
import { SignalsFloatingCard } from "@/components/signals/SignalsFloatingCard";
import { SourcesScreen } from "@/components/sources/SourcesScreen";
import { PoliticsPanel } from "@/components/politics/PoliticsPanel";
import { CyberSecPanel } from "@/components/cyber/CyberSecPanel";
import { IntelWatchPanel } from "@/components/intel-watch/IntelWatchPanel";
import { DefenseIndustryPanel } from "@/components/defense-industry/DefenseIndustryPanel";
import { mockEvents } from "@/data/mockEvents";
import { socmintReports } from "@/data/socmintReports";
import type { EventCategory, RegionKey } from "@/types/event";
import { socmintMatchesConfidenceFilter } from "@/types/socmint";

export type ViewMode = "situation" | "global" | "signals";
type ActiveSection = "dashboard" | "sources" | "bookmarks";
type ActiveTopTab = "situation" | "politics" | "intel" | "cyber" | "defense" | "sources";
type ActiveRailMode = "global" | "signals" | null;
type SignalCoverage = RegionKey | "global";
type MarkerPopupState = { kind: "global" | "signals"; id: string } | null;
export function AppShell() {
  const globeMapRef = useRef<MapLibreGlobeHandle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [markerPopup, setMarkerPopup] = useState<MarkerPopupState>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTopTab, setActiveTopTab] = useState<ActiveTopTab>("situation");
  const [activeRailMode, setActiveRailMode] = useState<ActiveRailMode>(null);
  const [activeView, setActiveView] = useState<ViewMode>("situation");
  const [activeRegion, setActiveRegion] = useState<RegionKey>("middle-east");
  const [activeCategory, setActiveCategory] = useState<EventCategory | "all">("all");
  const [activeSignalRegion, setActiveSignalRegion] = useState<SignalCoverage>("global");
  const [signalConfidenceMin, setSignalConfidenceMin] = useState(0);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [signalDetailOpen, setSignalDetailOpen] = useState(false);
  // Single source of truth for the active RSS item across feed, marker popup,
  // and pager.  All three UI surfaces read from / write to this one value so
  // they can never disagree.
  const [selectedRssItemId, setSelectedRssItemId] = useState<string | null>(null);
  const { bookmarkedItems, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks } =
    useBookmarks(mockEvents, socmintReports);

  // RSS preview items — same data that drives the right-side feed list.
  // Used here to produce globe markers without a second network fetch.
  const { items: rssItems } = useRssPreviewItems();
  const rssMarkers = useMemo<RssMarkerFeature[]>(
    () => rssItemsToMarkers(rssItems),
    [rssItems],
  );

  // O(1) lookup: RSS item id → { markerId, itemIndex }.
  // Used by the feed-click handler to find the correct marker and item position
  // without scanning the rssMarkers array on every click.
  const rssItemKeyToMarker = useMemo(() => {
    const map = new Map<string, { markerId: string; itemIndex: number }>();
    for (const m of rssMarkers) {
      m.items.forEach((item, idx) => {
        map.set(item.id, { markerId: m.id, itemIndex: idx });
      });
    }
    return map;
  }, [rssMarkers]);

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
    globeMapRef.current?.focusMarker(event.coordinates.lng, event.coordinates.lat);
  }, [selectedId]);

  // When a SOCMINT report is selected, pan to its marker coordinates.
  useEffect(() => {
    if (!selectedSignalId || activeRailModeRef.current !== "signals") return;
    const report = socmintReports.find((r) => r.id === selectedSignalId);
    if (!report?.coordinates) return;
    globeMapRef.current?.focusMarker(report.coordinates[0], report.coordinates[1]);
  }, [selectedSignalId]);


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

  // RSS marker popup — used when the clicked marker belongs to an RSS item
  // rather than a mock event (markerPopupEvent will be null in that case).
  const markerPopupRssMarker = useMemo(
    () =>
      markerPopup?.kind === "global" && markerPopupEvent === null
        ? (rssMarkers.find((m) => m.id === markerPopup.id) ?? null)
        : null,
    [markerPopup, markerPopupEvent, rssMarkers],
  );
  // Derive the pager index from selectedRssItemId so the feed highlight and
  // the popup "REPORT XX / NN" label always agree.  Falls back to 0 when the
  // selected item is not part of this marker (e.g. a no-location item was
  // selected after the popup was already open).
  const markerPopupRssItemIndex = useMemo(() => {
    if (!markerPopupRssMarker || !selectedRssItemId) return 0;
    const idx = markerPopupRssMarker.items.findIndex(
      (it) => it.id === selectedRssItemId,
    );
    return idx >= 0 ? idx : 0;
  }, [markerPopupRssMarker, selectedRssItemId]);

  const markerPopupRssItem = useMemo(
    () =>
      markerPopupRssMarker
        ? (markerPopupRssMarker.items[markerPopupRssItemIndex] ?? null)
        : null,
    [markerPopupRssMarker, markerPopupRssItemIndex],
  );

  // Global View markers — RSS-derived only.
  // Mock event markers are not shown in Global View; the globe renders only
  // items that have a deterministic location match in the RSS preview feed.
  // SOCMINT markers are untouched (separate signalsMarkers array below).
  const globalMarkers = useMemo<MarkerFeature[]>(
    () => rssMarkers,
    [rssMarkers],
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
    setSelectedId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
  }

  function handleCategoryChange(category: EventCategory | "all") {
    setActiveCategory(category);
    if (activeTopTab === "politics" && category !== "politics") {
      setActiveTopTab("situation");
    }
    setSelectedId(null);
    setEventDetailOpen(false);
    setMarkerPopup(null);
  }

  function handleTopTabSelect(tab: ActiveTopTab) {
    if (tab === "sources") {
      setActiveSection("sources");
      setActiveTopTab("sources");
      setActiveRailMode(null);
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
    // For RSS markers: default to the first item unless the currently selected
    // item already belongs to this marker (e.g. user re-clicks the same pin).
    const rssMarker = rssMarkers.find((m) => m.id === id);
    if (rssMarker) {
      const currentBelongs = rssMarker.items.some(
        (it) => it.id === selectedRssItemId,
      );
      if (!currentBelongs) {
        setSelectedRssItemId(rssMarker.items[0]?.id ?? null);
      }
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
      setSelectedRssItemId(null);
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
        globeMapRef.current?.projectMarker(
          markerPopupEvent.coordinates.lng,
          markerPopupEvent.coordinates.lat,
        ) ?? null
      );
    }
    // RSS marker: use adapter-resolved coordinates directly.
    if (markerPopup?.kind === "global" && markerPopupRssMarker) {
      return (
        globeMapRef.current?.projectMarker(
          markerPopupRssMarker.lng,
          markerPopupRssMarker.lat,
        ) ?? null
      );
    }
    if (markerPopup?.kind === "signals" && markerPopupSignal?.coordinates) {
      return (
        globeMapRef.current?.projectMarker(
          markerPopupSignal.coordinates[0],
          markerPopupSignal.coordinates[1],
        ) ?? null
      );
    }
    return null;
  }, [markerPopup, markerPopupEvent, markerPopupRssMarker, markerPopupSignal]);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "#0a0a0a" }}
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
            <MapLibreGlobe
              ref={globeMapRef}
              activeView={globeView}
              activeRegion={globeRegion}
              activeSignalsRegion={globeSignalsRegion}
              globalMarkers={globalMarkers}
              signalsMarkers={signalsMarkers}
              selectedGlobalId={selectedId}
              selectedSignalsId={selectedSignalId}
              onMarkerClick={(id, kind) => {
                if (kind === "global") handleGlobalMarkerSelect(id);
                else if (kind === "signals") handleSignalMarkerSelect(id);
              }}
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
                activeCategory={activeCategory}
                isPoliticsWatch={false}
                eventCount={displayedEvents.length}
                onViewChange={handleViewChange}
                onRegionChange={handleRegionChange}
                onCategoryChange={handleCategoryChange}
              />
            </div>
            <MapControls
              onCenterView={() => globeMapRef.current?.centerView()}
              onZoomIn={() => globeMapRef.current?.zoomIn()}
              onZoomOut={() => globeMapRef.current?.zoomOut()}
              panelOffset={mapControlPanelOffset}
            />
            {activeMapRailMode !== null && <LiveStatusPill />}

            <div
              style={{
                position: "absolute",
                top: "16px",
                right: "14px",
                bottom: "10px",
                width: "372px",
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
                <RssGlobalFeedPanel
                  selectedMarkerId={selectedRssItemId}
                  onItemSelect={(itemId) => {
                    const entry = rssItemKeyToMarker.get(itemId);
                    if (entry) {
                      // Item has a deterministic location — sync popup + globe.
                      // Set selectedRssItemId first so the derived index is
                      // already correct when the popup re-renders.
                      setSelectedRssItemId(itemId);
                      const grouped = rssMarkers.find(
                        (m) => m.id === entry.markerId,
                      );
                      if (grouped) {
                        setSelectedId(entry.markerId);
                        setEventDetailOpen(false);
                        setMarkerPopup({ kind: "global", id: entry.markerId });
                        globeMapRef.current?.focusMarker(
                          grouped.lng,
                          grouped.lat,
                        );
                      }
                    } else {
                      // No location match — update feed highlight only;
                      // do not open or change the marker popup.
                      setSelectedRssItemId(itemId);
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
                accent="#3b82f6"
                getPosition={getMarkerPopupPosition}
                onClose={handleMarkerPopupClose}
              />
            )}
            {activeMapRailMode === "global" && markerPopupRssItem && markerPopupRssMarker && (
              <MarkerInfoPopup
                title={markerPopupRssItem.title}
                location={markerPopupRssMarker.locationName}
                summary={markerPopupRssItem.summary}
                source={markerPopupRssItem.sourceName}
                time={markerPopupRssItem.publishedAt}
                accent="#60a5fa"
                getPosition={getMarkerPopupPosition}
                onClose={handleMarkerPopupClose}
                itemIndex={markerPopupRssItemIndex}
                itemCount={markerPopupRssMarker.items.length}
                onPrev={() => {
                  const prev =
                    markerPopupRssMarker.items[markerPopupRssItemIndex - 1];
                  if (prev) setSelectedRssItemId(prev.id);
                }}
                onNext={() => {
                  const next =
                    markerPopupRssMarker.items[markerPopupRssItemIndex + 1];
                  if (next) setSelectedRssItemId(next.id);
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
                accent="#60a5fa"
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
              <PoliticsPanel events={displayedEvents} />
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
