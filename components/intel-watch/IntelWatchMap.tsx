"use client";

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { agencies } from "@/data/intel-watch/agencies";
import type { AgencyType } from "@/types/intel-watch";

// Anchor agencies that always get a label (one per major region)
const ANCHOR_IDS = new Set([
  "cia", "mi6", "bnd", "fsb", "mit", "mossad", "mss", "raw", "asis", "abin", "eu-intcen",
]);

// ISO numeric codes — single amber heat, varying opacity
const HIGH_HEAT = new Set([
  // Europe
  "276", "250", "826", "380", "724", "642", "616", "804",
  "56", "528", "752", "208", "246", "372", "40", "756", "191",
  // MENA
  "792", "364", "376", "400", "682", "818", "784", "760", "368",
  "422", "434", "504", "788", "012",
  // Russia / Eurasia
  "643", "112", "398", "860", "417", "762", "795",
]);

const MED_HEAT = new Set([
  // S. & E. Asia
  "156", "356", "586", "410", "392",
  // SE Asia / Oceania
  "036", "554", "360", "608",
]);

// Single muted amber (#B45309) at very low opacity
function countryFill(id: string): string {
  if (HIGH_HEAT.has(id)) return "rgba(180,83,9,0.14)";
  if (MED_HEAT.has(id)) return "rgba(180,83,9,0.08)";
  return "#0F1419";
}

const MARKER_COLOR: Record<AgencyType, string> = {
  Intelligence: "rgba(217,119,6,0.9)",
  Diplomatic: "rgba(59,130,246,0.9)",
  Supranational: "rgba(167,139,250,0.9)",
};

const RING_COLOR: Record<AgencyType, string> = {
  Intelligence: "rgba(217,119,6,0.28)",
  Diplomatic: "rgba(59,130,246,0.28)",
  Supranational: "rgba(167,139,250,0.28)",
};

export function IntelWatchMap() {
  return (
    <div
      className="relative"
      style={{
        flex: "1 1 0",
        minHeight: "360px",
        background: "#08101A",
        borderRadius: "8px",
        margin: "8px 12px 0",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}
    >
      {/* Heat mode selector — top-right */}
      <div
        className="absolute flex items-center gap-1.5 z-10"
        style={{ top: 8, right: 10 }}
      >
        <span style={{ fontSize: "8.5px", color: "rgba(100,115,135,0.7)", letterSpacing: "0.06em" }}>
          Heat:
        </span>
        <select
          defaultValue="overall"
          style={{
            background: "rgba(10,14,22,0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px",
            padding: "2px 6px",
            fontSize: "9px",
            color: "rgba(160,175,200,0.85)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="overall" style={{ background: "#0d1117" }}>Overall Activity</option>
          <option value="diplomatic" style={{ background: "#0d1117" }}>Diplomatic</option>
          <option value="security" style={{ background: "#0d1117" }}>Security</option>
        </select>
      </div>

      {/*
        viewBox 800×390 closely matches geoEqualEarth's natural ~2.05:1 aspect ratio,
        so the world fills the SVG with minimal letterboxing. scale=147 gives ~5% padding
        on each side for the full world extent.
      */}
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 147 }}
        width={800}
        height={390}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Countries — heat fill sits below border stroke in natural SVG paint order */}
        <Geographies geography="/countries-110m.json">
          {({ geographies }) =>
            geographies.map((geo) => {
              const fill = countryFill(geo.id as string);
              const hoverFill = fill === "#0F1419" ? "#1A2028" : fill;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="rgba(31,41,55,0.5)"
                  strokeWidth={0.35}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: hoverFill, outline: "none", cursor: "default" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Agency markers — rendered after countries, so above them in SVG z-order */}
        {agencies.map((agency) => {
          const showLabel = ANCHOR_IDS.has(agency.id);
          const fill = MARKER_COLOR[agency.type];
          const ring = RING_COLOR[agency.type];
          return (
            <Marker key={agency.id} coordinates={[agency.lng, agency.lat]}>
              {/* Outer ring for separation against dark fill */}
              <circle r={6} fill="none" stroke={ring} strokeWidth={1} />
              {/* Core dot */}
              <circle r={3.5} fill={fill} stroke="rgba(0,0,0,0.45)" strokeWidth={0.6} />
              {/* Label — anchor agencies only */}
              {showLabel && (
                <text
                  x={8}
                  y={3.5}
                  style={{
                    fontSize: "5px",
                    fontWeight: 600,
                    fill: "rgba(185,200,220,0.72)",
                    pointerEvents: "none",
                    userSelect: "none",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    letterSpacing: "0.02em",
                  }}
                >
                  {agency.name}
                </text>
              )}
            </Marker>
          );
        })}
      </ComposableMap>

      {/* Activity intensity legend — bottom-left */}
      <div className="absolute flex flex-col gap-1" style={{ bottom: 10, left: 12, zIndex: 10 }}>
        <span
          style={{
            fontSize: "8px",
            fontWeight: 600,
            color: "rgba(90,105,125,0.7)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          Activity Intensity
        </span>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "8px", color: "rgba(80,95,115,0.65)" }}>Low</span>
          <div
            style={{
              width: 80,
              height: 5,
              borderRadius: "3px",
              background: "linear-gradient(to right, rgba(15,20,25,1), rgba(180,83,9,0.55))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <span style={{ fontSize: "8px", color: "rgba(80,95,115,0.65)" }}>High</span>
        </div>
      </div>

      {/* Marker type legend — bottom-right */}
      <div className="absolute flex items-center gap-3" style={{ bottom: 10, right: 12, zIndex: 10 }}>
        {(["Intelligence", "Diplomatic", "Supranational"] as AgencyType[]).map((t) => (
          <div key={t} className="flex items-center gap-1">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: MARKER_COLOR[t],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "8px", color: "rgba(110,125,145,0.75)" }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
