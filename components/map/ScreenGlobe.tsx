"use client";

import { forwardRef } from "react";
import {
  EchisGlobe,
  type EchisGlobeHandle,
  type GlobeMarker,
  type GlobeMarkerShape,
} from "@/components/map/EchisGlobe";

/**
 * ScreenGlobe — full-bleed, centered EchisGlobe for the data work views
 * (Global View · SOCMINT Watch · Intel Watch). Country + admin-1 (province)
 * borders are integrated into the sphere; markers are clickable.
 *
 * This is a three.js visual globe. It does NOT reproduce MapLibre's live
 * basemap (zoom-dependent city/label cartography). Country + admin-1 borders,
 * markers, hover-scale, selection highlight, and marker-click routing ARE
 * supported — feed it that screen's markers and wire onMarkerSelect.
 */

/** Screen-space insets of the free viewport area, in px — the region left
 *  clear by the floating cards on one side and the feed panel / map controls
 *  on the other. Mirrors MapLibre's GLOBE_SCREEN_FRAMING padding so the globe
 *  sits centered in the open space instead of behind a panel. */
export interface ScreenGlobeFraming {
  left: number;
  right: number;
}

export interface ScreenGlobeProps {
  framing?: ScreenGlobeFraming;
  markers?: GlobeMarker[];
  markerShape?: GlobeMarkerShape;
  selectedMarkerId?: string | null;
  onMarkerSelect?: (id: string) => void;
  showLabels?: boolean;
  showAdminBorders?: boolean;
  showPlaceLabels?: boolean;
  autoRotatePaused?: boolean;
  onAutoRotateStart?: () => void;
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
}

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";

export const ScreenGlobe = forwardRef<EchisGlobeHandle, ScreenGlobeProps>(
  function ScreenGlobe(
    {
      framing,
      markers = [],
      markerShape = "dot",
      selectedMarkerId = null,
      onMarkerSelect,
      showLabels = false,
      showAdminBorders = true,
      showPlaceLabels = true,
      autoRotatePaused = false,
      onAutoRotateStart,
      caption,
      className,
      style,
    },
    ref,
  ) {
    return (
      <div
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background:
            "radial-gradient(ellipse at 50% 54%,rgba(48,11,16,.28),transparent 46%),radial-gradient(ellipse at 50% 50%,#0b0c0f 0%,#08080b 52%,#040405 100%)",
          ...style,
        }}
      >
        <EchisGlobe
          ref={ref}
          size="hero"
          screenOffsetX={framing ? (framing.right - framing.left) / 2 : 0}
          markers={markers}
          markerShape={markerShape}
          selectedMarkerId={selectedMarkerId}
          onMarkerClick={onMarkerSelect}
          showLabels={showLabels}
          showAdminBorders={showAdminBorders}
          showPlaceLabels={showPlaceLabels}
          autoRotatePaused={autoRotatePaused}
          onAutoRotateStart={onAutoRotateStart}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 50% 54%,transparent 44%,rgba(3,2,3,.6) 100%)",
          }}
        />
        {caption && (
          <div
            style={{
              position: "absolute",
              bottom: 22,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
              fontFamily: MONO,
              fontSize: 8,
              letterSpacing: ".28em",
              color: "rgba(120,128,140,.5)",
              whiteSpace: "nowrap",
            }}
          >
            {caption}
          </div>
        )}
      </div>
    );
  },
);
