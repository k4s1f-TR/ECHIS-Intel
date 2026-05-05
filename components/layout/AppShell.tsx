"use client";

import { useMemo, useRef, useState } from "react";
import { LeftRail } from "./LeftRail";
import { HeaderNav } from "./HeaderNav";
import { GlobeMap, type GlobeMapHandle } from "@/components/map/GlobeMap";
import type { MapMode } from "@/components/map/cameraPresets";
import { FloatingMonitoringCard } from "@/components/map/FloatingMonitoringCard";
import { MapControls } from "@/components/map/MapControls";
import { LiveStatusPill } from "@/components/map/LiveStatusPill";
import { RightEventsPanel } from "@/components/events/RightEventsPanel";
import { SignalsPanel } from "@/components/signals/SignalsPanel";
import { SignalsFloatingCard } from "@/components/signals/SignalsFloatingCard";
import { SourcesScreen } from "@/components/sources/SourcesScreen";
import { PoliticsPanel } from "@/components/politics/PoliticsPanel";
import { mockEvents } from "@/data/mockEvents";
import { socmintReports } from "@/data/socmintReports";
import type { EventCategory, RegionKey } from "@/types/event";
import { socmintMatchesConfidenceFilter } from "@/types/socmint";

export type ViewMode = "situation" | "global" | "signals";
type ActiveSection = "dashboard" | "sources";
type ActiveTopTab = "situation" | "politics" | "sources";
type ActiveRailMode = "global" | "signals" | null;
type SignalCoverage = RegionKey | "global";

export function AppShell() {
  const globeMapRef = useRef<GlobeMapHandle | null>(null);
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
  const mapMode: MapMode =
    activeMapRailMode === "global"
      ? "global"
      : activeMapRailMode === "signals"
        ? "socmint"
        : "monitor-home";

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
          onViewChange={handleViewChange}
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
            <GlobeMap
              ref={globeMapRef}
              mode={mapMode}
              events={activeMapRailMode === "global" ? displayedEvents : []}
              selectedId={selectedId}
              onSelectEvent={setSelectedId}
              signals={isMapScreen ? displayedSignals : []}
              selectedSignalId={selectedSignalId}
              onSelectSignal={setSelectedSignalId}
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
              />
            </div>
          </div>

          {activeSection === "sources" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <SourcesScreen />
            </div>
          )}
          {activeSection === "dashboard" && activeTopTab === "politics" && (
            <div className="ui-fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
              <PoliticsPanel events={displayedEvents} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
