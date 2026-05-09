"use client";

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { agencies } from "@/data/intel-watch/agencies";
import type { AgencyType } from "@/types/intel-watch";

const ANCHOR_IDS = new Set([
  "cia", "mi6", "bnd", "fsb", "mit", "mossad", "mss", "raw", "asis", "abin", "eu-intcen",
]);

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

function countryFill(id: string): string {
  if (HIGH_HEAT.has(id)) return "rgba(180,83,9,0.28)";
  if (MED_HEAT.has(id)) return "rgba(180,83,9,0.18)";
  return "#0F172A";
}

const MARKER_COLOR: Record<AgencyType, string> = {
  Intelligence: "rgba(217,119,6,0.9)",
  Diplomatic: "rgba(59,130,246,0.9)",
  Supranational: "rgba(167,139,250,0.9)",
};

const RING_COLOR: Record<AgencyType, string> = {
  Intelligence: "rgba(217,119,6,0.45)",
  Diplomatic: "rgba(59,130,246,0.45)",
  Supranational: "rgba(167,139,250,0.45)",
};

export function IntelWatchMap() {
  return (
    <div
      className="relative"
      style={{
        width: "100%",
        height: "100%",
        background: "#08101A",
        borderRadius: "8px",
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
        scale=163 fills the container width with ~2% side padding.
        center=[0,12] shifts 12°N to the SVG center, pulling Antarctica's
        empty band below the visible area while keeping Arctic content visible.
        Antarctica features are also filtered out in the render loop.
      */}
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 163, center: [0, 12] }}
        width={800}
        height={390}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <Geographies geography="/countries-110m.json">
          {({ geographies }) =>
            geographies
              .filter((geo) => geo.properties.name !== "Antarctica")
              .map((geo) => {
                const fill = countryFill(geo.id as string);
                const hoverFill = fill === "#0F172A" ? "#1E293B" : fill;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="rgba(51,65,85,0.85)"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: hoverFill, outline: "none", cursor: "default", transition: "fill 150ms" },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
          }
        </Geographies>

        {agencies.map((agency) => {
          const showLabel = ANCHOR_IDS.has(agency.id);
          const fill = MARKER_COLOR[agency.type];
          const ring = RING_COLOR[agency.type];
          return (
            <Marker key={agency.id} coordinates={[agency.lng, agency.lat]}>
              <circle r={6} fill="none" stroke={ring} strokeWidth={1} />
              <circle r={3} fill={fill} stroke="rgba(0,0,0,0.45)" strokeWidth={0.6} />
              {showLabel && (
                <text
                  x={8}
                  y={3.5}
                  style={{
                    fontSize: "6px",
                    fontWeight: 500,
                    fill: "#E2E8F0",
                    stroke: "#0F172A",
                    strokeWidth: "2",
                    paintOrder: "stroke fill",
                    pointerEvents: "none",
                    userSelect: "none",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    letterSpacing: "0.02em",
                  } as React.CSSProperties}
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
        <div className="flex items-center gap-1">
          <span style={{ fontSize: "8px", color: "rgba(80,95,115,0.65)" }}>Low</span>
          <div
            style={{
              width: 100,
              height: 5,
              borderRadius: "3px",
              background: "linear-gradient(to right, rgba(15,23,42,1), rgba(180,83,9,0.65))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <span style={{ fontSize: "8px", color: "rgba(80,95,115,0.65)" }}>High</span>
        </div>
      </div>

      {/* Combined KPI + legend overlay — bottom-right */}
      <div
        className="absolute flex flex-col"
        style={{
          bottom: 12,
          right: 12,
          zIndex: 10,
          background: "rgba(15,23,42,0.78)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(51,65,85,0.5)",
          borderRadius: "6px",
          padding: "12px 14px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          minWidth: 180,
        }}
      >
        {/* KPI section */}
        <div className="flex flex-col" style={{ gap: 8 }}>
          {[
            { label: "New Mentions Today", value: "1,246", delta: "+18%" },
            { label: "Total Reports", value: "18,657", delta: "+9%" },
          ].map((kpi) => (
            <div key={kpi.label} className="flex flex-col" style={{ gap: 2 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#94A3B8",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {kpi.label}
              </span>
              <div className="flex items-baseline" style={{ gap: 8 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#E2E8F0",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {kpi.value}
                </span>
                <span style={{ fontSize: 10.5, color: "rgba(74,222,128,0.85)" }}>
                  ▲ {kpi.delta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(51,65,85,0.5)", margin: "10px 0 8px" }} />

        {/* Legend section */}
        <div className="flex flex-col" style={{ gap: 6 }}>
          {(["Intelligence", "Diplomatic", "Supranational"] as AgencyType[]).map((t) => (
            <div key={t} className="flex items-center" style={{ gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: MARKER_COLOR[t],
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
