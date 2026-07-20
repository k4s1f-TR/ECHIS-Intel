"use client";

import { useCallback, useState } from "react";
import { Globe2, Map as MapIcon } from "lucide-react";
import { IntelWatchMap } from "./IntelWatchMap";
import { INTEL_WATCH_STORAGE_KEY } from "./workspaceStore";
import { ScreenGlobe } from "@/components/map/ScreenGlobe";
import type { GlobeMarker, GlobeMarkerLevel } from "@/components/map/EchisGlobe";

/**
 * Intel Watch — flat analyst map (default) plus the three.js globe as an
 * alternate view. Only one surface is mounted at a time, so the MapLibre map
 * and the WebGL globe never hold renderers simultaneously. Analyst work is
 * unaffected: pins/annotations live in localStorage, not in this component.
 */

type IntelView = "map" | "globe";

const LEVELS: GlobeMarkerLevel[] = ["critical", "high", "medium", "low"];

/** Read the persisted workspace pins as globe markers (schema owned by
 *  IntelWatchMap; anything malformed is skipped). */
function readWorkspaceMarkers(): GlobeMarker[] {
  if (typeof window === "undefined") return [];
  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(INTEL_WATCH_STORAGE_KEY);
    if (!raw) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const pins = (parsed as { pins?: unknown })?.pins;
  if (!Array.isArray(pins)) return [];

  const markers: GlobeMarker[] = [];
  for (const entry of pins) {
    if (!entry || typeof entry !== "object") continue;
    const pin = entry as Record<string, unknown>;
    if (
      typeof pin.id !== "string" ||
      typeof pin.lng !== "number" ||
      typeof pin.lat !== "number" ||
      !Number.isFinite(pin.lng) ||
      !Number.isFinite(pin.lat)
    ) {
      continue;
    }
    markers.push({
      id: pin.id,
      lng: pin.lng,
      lat: pin.lat,
      level: LEVELS.includes(pin.severity as GlobeMarkerLevel)
        ? (pin.severity as GlobeMarkerLevel)
        : "medium",
      label: typeof pin.title === "string" ? pin.title : undefined,
      detail: typeof pin.source === "string" ? pin.source : undefined,
    });
  }
  return markers;
}

export function IntelWatchPanel() {
  const [view, setView] = useState<IntelView>("map");
  const [markers, setMarkers] = useState<GlobeMarker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refresh from the persisted workspace every time the globe is opened, so
  // pins added on the map (or via "Send to Intel Watch") show up.
  const toggle = useCallback(() => {
    const next: IntelView = view === "map" ? "globe" : "map";
    if (next === "globe") setMarkers(readWorkspaceMarkers());
    setSelectedId(null);
    setView(next);
  }, [view]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        background: "#040404",
      }}
    >
      {view === "map" ? (
        <IntelWatchMap />
      ) : (
        <ScreenGlobe
          markers={markers}
          selectedMarkerId={selectedId}
          onMarkerSelect={setSelectedId}
          showLabels
          caption="INTEL WATCH · GLOBE"
        />
      )}

      {/* The map's right panel is 318px and narrows to 300px under 820px —
          the toggle tracks it so it never sits on top of the panel edge. */}
      <style>{`
        .iw-view-toggle { right: 14px; }
        .iw-view-toggle[data-behind-panel="true"] { right: 332px; }
        @media (max-width: 820px) {
          .iw-view-toggle[data-behind-panel="true"] { right: 314px; }
        }
      `}</style>
      <button
        type="button"
        className="iw-view-toggle"
        data-behind-panel={view === "map"}
        onClick={toggle}
        aria-label={view === "map" ? "Switch to globe view" : "Switch to map view"}
        style={{
          position: "absolute",
          top: 14,
          zIndex: 30,
          height: 30,
          padding: "0 12px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid var(--c-border-1)",
          borderRadius: 8,
          background: "rgba(4,4,4,.72)",
          backdropFilter: "blur(10px)",
          color: "var(--c-t2)",
          fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: ".18em",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        {view === "map" ? <Globe2 size={13} /> : <MapIcon size={13} />}
        {view === "map" ? "GLOBE VIEW" : "MAP VIEW"}
      </button>
    </div>
  );
}
