"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { geoEquirectangular } from "d3-geo";
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import {
  intelWatchMapItems,
  type IntelWatchCategory,
} from "@/data/intel-watch/intelWatchMapItems";
import { IntelWatchMarkerPopup } from "./IntelWatchMarkerPopup";

// Muted semantic palette — restrained, analyst-oriented, non-neon.
const CATEGORY_COLOR: Record<IntelWatchCategory, { fill: string; ring: string }> = {
  Diplomatic:  { fill: "rgba(96,140,200,0.85)",  ring: "rgba(96,140,200,0.32)" },
  Security:    { fill: "rgba(210,110,90,0.85)",  ring: "rgba(210,110,90,0.32)" },
  Policy:      { fill: "rgba(180,165,110,0.85)", ring: "rgba(180,165,110,0.32)" },
  Sanctions:   { fill: "rgba(200,120,140,0.85)", ring: "rgba(200,120,140,0.32)" },
  Border:      { fill: "rgba(220,150,90,0.85)",  ring: "rgba(220,150,90,0.32)" },
  Influence:   { fill: "rgba(170,140,200,0.85)", ring: "rgba(170,140,200,0.32)" },
  Cooperation: { fill: "rgba(120,180,150,0.85)", ring: "rgba(120,180,150,0.32)" },
  Maritime:    { fill: "rgba(110,170,190,0.85)", ring: "rgba(110,170,190,0.32)" },
};

const VIEW_W = 760;
const VIEW_H = 442;
const PAD = 20;

// Optical horizontal correction applied to the shared map content frame
// (SVG + marker + popup layers). A small negative shift compensates for the
// Eurasia-heavy landmass distribution that visually pulls the composition
// rightward despite the geometric bounding box being centered.
const MAP_OPTICAL_SHIFT_X = "-1.1%";

// Scale applied to the shared map content frame. Split into horizontal and
// vertical components so vertical presence can be tuned independently while
// the horizontal fit stays locked. All layers (artwork + markers + popups)
// scale together so alignment is preserved.
const MAP_CONTENT_SCALE_X = 1.155;
const MAP_CONTENT_SCALE_Y = 1.46;

const topology = countriesAtlas as unknown as TopoJSON.Topology;
const allFeatures = feature(
  topology,
  topology.objects.countries as TopoJSON.GeometryCollection,
);

function gn(o: { properties?: unknown } | null | undefined) {
  return ((o?.properties as { name?: string } | undefined)?.name ?? "").toLowerCase();
}

const filteredCollection: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: allFeatures.features.filter((f) => {
    const n = gn(f);
    return n !== "antarctica" && n !== "fr. s. antarctic lands";
  }) as GeoJSON.Feature[],
};

// Flat rectangular projection — equirectangular gives a clean, wider,
// operational world view with no high-latitude compression. fitExtent
// auto-centers the visible geography in a padded viewBox.
const fittedProjection = geoEquirectangular().fitExtent(
  [
    [PAD, PAD],
    [VIEW_W - PAD, VIEW_H - PAD],
  ],
  filteredCollection,
);

export function IntelWatchMap() {
  // openIds is ordered: last item is rendered on top.
  const [openIds, setOpenIds] = useState<string[]>([]);

  function toggleOrFocus(id: string) {
    setOpenIds((prev) => {
      if (prev.includes(id)) return [...prev.filter((x) => x !== id), id];
      return [...prev, id];
    });
  }
  function focus(id: string) {
    setOpenIds((prev) => {
      if (!prev.includes(id)) return prev;
      if (prev[prev.length - 1] === id) return prev;
      return [...prev.filter((x) => x !== id), id];
    });
  }
  function closeOne(id: string) {
    setOpenIds((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      style={{
        background: "#08101A",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}
    >
      {/*
        Shared map content frame: aspect-locked viewport that contains the SVG,
        marker layer, and popup layer. The optical shift is applied here so all
        layers move together and stay aligned.
      */}
      <div
        className="relative max-w-full max-h-full"
        style={{
          width: "100%",
          aspectRatio: `${VIEW_W} / ${VIEW_H}`,
          transform: `translateX(${MAP_OPTICAL_SHIFT_X}) scaleX(${MAP_CONTENT_SCALE_X}) scaleY(${MAP_CONTENT_SCALE_Y})`,
          transformOrigin: "center center",
        }}
      >
        <ComposableMap
          projection={fittedProjection}
          width={VIEW_W}
          height={VIEW_H}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <Geographies geography={filteredCollection}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0F172A"
                  stroke="rgba(51,65,85,0.7)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#0F172A", outline: "none", cursor: "default" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {intelWatchMapItems.map((item) => {
            const c = CATEGORY_COLOR[item.category];
            const isOpen = openIds.includes(item.id);
            return (
              <Marker key={item.id} coordinates={[item.lng, item.lat]}>
                {isOpen && (
                  <circle
                    r={6.5}
                    fill="none"
                    stroke={c.fill}
                    strokeOpacity={0.55}
                    strokeWidth={0.6}
                  />
                )}
                <circle r={4.5} fill="none" stroke={c.ring} strokeWidth={0.8} />
                <circle r={2.1} fill={c.fill} stroke="rgba(8,16,26,0.65)" strokeWidth={0.5} />
                {/* Larger transparent hit area for easier clicking */}
                <circle
                  r={9}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOrFocus(item.id);
                  }}
                />
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Popup layer — absolute, positioned via projection % coords */}
        <div className="absolute inset-0 pointer-events-none">
          {openIds.map((id, idx) => {
            const item = intelWatchMapItems.find((m) => m.id === id);
            if (!item) return null;
            const projected = fittedProjection([item.lng, item.lat]);
            if (!projected) return null;
            const [vx, vy] = projected;
            const leftPct = (vx / VIEW_W) * 100;
            const topPct = (vy / VIEW_H) * 100;
            const flipX = leftPct > 60;
            const flipY = topPct > 65;
            const c = CATEGORY_COLOR[item.category];
            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: `translate(${flipX ? "calc(-100% - 10px)" : "10px"}, ${
                    flipY ? "calc(-100% - 8px)" : "8px"
                  })`,
                  zIndex: 10 + idx,
                  pointerEvents: "none",
                }}
              >
                <IntelWatchMarkerPopup
                  item={item}
                  categoryColor={c}
                  onClose={() => closeOne(id)}
                  onFocus={() => focus(id)}
                  zIndex={10 + idx}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
