"use client";

import { useMemo, useRef, useState } from "react";
import { LeftRail } from "./LeftRail";
import { HeaderNav } from "./HeaderNav";
import {
  MapLibreGlobe,
  type MapLibreGlobeHandle,
} from "@/components/maplibre/MapLibreGlobe";
import { FloatingMonitoringCard } from "@/components/map/FloatingMonitoringCard";
import { MapControls } from "@/components/map/MapControls";
import { LiveStatusPill } from "@/components/map/LiveStatusPill";
import { RightEventsPanel } from "@/components/events/RightEventsPanel";
import { BookmarksView } from "@/components/events/BookmarksView";
import { useBookmarks } from "@/components/events/useBookmarks";
import { SignalsPanel } from "@/components/signals/SignalsPanel";
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
export function AppShell() {
  const globeMapRef = useRef<MapLibreGlobeHandle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [activeTopTab, setActiveTopTab] = useState<ActiveTopTab>("situation");
  const [activeRailMode, setActiveRailMode] = useState<ActiveRailMode>(null);
  const [activeView, setActiveView] = useState<ViewMode>("situation");
  const [activeRegion, setActiveRegion] = useState<RegionKey>("middle-east");
  const [activeCategory, setActiveCategory] = useState<EventCategory | "all">("all");
  const [activeSignalRegion, setActiveSignalRegion] = useState<SignalCoverage>("global");
  const [signalConfidenceMin, setSignalConfidenceMin] = useState(0);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const { bookmarkedItems, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks } =
    useBookmarks(mockEvents, socmintReports);

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
    activeMapRailMode === "global" ? 390 : activeMapRailMode === "signals" ? 368 : 0;

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

  function handleViewChange(view: ViewMode) {
    setActiveSection("dashboard");
    setActiveTopTab("situation");
    setActiveView(view);
    setActiveCategory("all");
    setSelectedId(null);
    setSelectedSignalId(null);
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
    setSelectedSignalId(null);
  }

  function handleBookmarksOpen() {
    setActiveSection("bookmarks");
    setActiveTopTab("situation");
    setActiveRailMode(null);
    setSelectedId(null);
    setSelectedSignalId(null);
  }

  function handleRegionChange(region: RegionKey) {
    setActiveSection("dashboard");
    setActiveTopTab("situation");
    setActiveRailMode("global");
    setActiveRegion(region);
    setActiveView("situation");
    setSelectedId(null);
  }

  function handleCategoryChange(category: EventCategory | "all") {
    setActiveCategory(category);
    if (activeTopTab === "politics" && category !== "politics") {
      setActiveTopTab("situation");
    }
    const nextDisplayedEvents =
      category === "all" ? baseEvents : baseEvents.filter((e) => e.category === category);

    if (selectedId !== null && !nextDisplayedEvents.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }

  function handleTopTabSelect(tab: ActiveTopTab) {
    if (tab === "sources") {
      setActiveSection("sources");
      setActiveTopTab("sources");
      setActiveRailMode(null);
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
      setSelectedSignalId(null);
      return;
    }

    if (tab === "intel" || tab === "cyber" || tab === "defense") {
      setActiveSection("dashboard");
      setActiveTopTab(tab);
      setActiveRailMode(null);
      setActiveCategory("all");
      setSelectedId(null);
      setSelectedSignalId(null);
      return;
    }

    handleViewChange("situation");
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "#0a0a0a" }}
    >
      <HeaderNav
        activeTab={activeTopTab}
        onTabSelect={handleTopTabSelect}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftRail
          activeView={activeSection === "dashboard" && activeTopTab === "situation" ? activeRailMode : null}
          activeBookmarks={activeSection === "bookmarks"}
          onViewChange={handleViewChange}
          onBookmarks={handleBookmarksOpen}
          onHome={handleHomeReset}
        />

        <div className="relative flex-1 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              opacity: isMapScreen ? 1 : 0,
              pointerEvents: isMapScreen ? "auto" : "none",
              transition: "opacity 120ms ease",
            }}
          >
            <MapLibreGlobe ref={globeMapRef} />
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
                }}
                onConfidenceChange={(min) => {
                  setSignalConfidenceMin(min);
                  setSelectedSignalId(null);
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
              <RightEventsPanel
                events={displayedEvents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isBookmarked={isBookmarked}
                onToggleBookmark={toggleBookmark}
              />
            </div>
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: "372px",
                transform: activeMapRailMode === "signals" ? "translateX(0)" : "translateX(100%)",
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
                onSelect={setSelectedSignalId}
                isBookmarked={isBookmarked}
                onToggleBookmark={toggleBookmark}
              />
            </div>
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
