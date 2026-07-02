"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Radio } from "lucide-react";
import { socmintReports } from "@/data/socmintReports";
import { REGION_OPTIONS, type RegionKey } from "@/types/event";
import type { SocmintReportType } from "@/types/socmint";
import {
  SOCMINT_TYPE_LABELS,
  socmintMatchesConfidenceFilter,
} from "@/types/socmint";

type SignalCoverage = RegionKey | "global";

interface Props {
  activeRegion: SignalCoverage;
  confidenceMin: number;
  onRegionChange: (region: SignalCoverage) => void;
  onConfidenceChange: (min: number) => void;
}

// Same label / dropdown / item styling as FloatingMonitoringCard so both map
// modes share one floating-card standard.
const LABEL_STYLE = {
  fontSize: "8.5px",
  color: "var(--c-silver-dim)",
  fontWeight: 600,
} as const;

const THRESHOLD_OPTIONS: { label: string; value: number }[] = [
  { label: "All", value: 0 },
  { label: "Low", value: 20 },
  { label: "Med.", value: 40 },
  { label: "High", value: 70 },
];

const DROPDOWN_STYLE = {
  background: "var(--bg-panel)",
  border: "1px solid var(--c-border-1)",
  backdropFilter: "blur(14px)",
  boxShadow: "var(--shadow-inset-highlight), 0 8px 24px rgba(0,0,0,0.6)",
} as const;

const TYPE_COLORS: Record<SocmintReportType, string> = {
  "local-report": "rgba(150,170,196,0.85)",
  "social-claim": "rgba(251,191,36,0.85)",
  "osint-account": "var(--c-elev)",
  "local-media": "var(--c-high)",
};

const SOCMINT_TYPES: SocmintReportType[] = [
  "local-report",
  "social-claim",
  "osint-account",
  "local-media",
];

function itemStyle(active: boolean) {
  return {
    display: "block" as const,
    width: "100%",
    textAlign: "left" as const,
    padding: "7px 12px",
    fontSize: "12px",
    color: active ? "var(--c-accent-text)" : "var(--c-silver-dim)",
    background: active ? "var(--c-accent-grad-soft)" : "transparent",
    border: active
      ? "1px solid var(--c-accent-border)"
      : "1px solid transparent",
    cursor: "pointer",
  };
}

export function SignalsFloatingCard({
  activeRegion,
  confidenceMin,
  onRegionChange,
  onConfidenceChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const filtered = socmintReports
    .filter((report) => socmintMatchesConfidenceFilter(report, confidenceMin))
    .filter((report) => activeRegion === "global" || report.region === activeRegion);
  const isGlobal = activeRegion === "global";
  const regionLabel = isGlobal
    ? "All Regions"
    : REGION_OPTIONS.find((r) => r.key === activeRegion)?.label ?? "Middle East";
  const regionSubtitle = isGlobal
    ? "Global public social source coverage"
    : "Regional public social source coverage";

  useEffect(() => {
    if (!regionOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [regionOpen]);

  if (collapsed) {
    return (
      <button
        className="absolute top-4 left-4 rounded-xl z-30 flex items-center gap-2"
        onClick={() => setCollapsed(false)}
        style={{
          padding: "10px 12px",
          background: "var(--bg-panel)",
          border: "1px solid var(--c-border-1)",
          backdropFilter: "blur(14px)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <Radio size={10} style={{ color: "var(--c-silver-dim)" }} />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--c-silver)",
            letterSpacing: "0.08em",
          }}
        >
          SOCMINT
        </span>
        <ChevronRight size={12} style={{ color: "var(--c-t5)" }} />
      </button>
    );
  }

  return (
    <div
      ref={cardRef}
      className="absolute top-4 left-4 rounded-xl z-30"
      style={{
        padding: "14px 16px",
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        backdropFilter: "blur(14px)",
        minWidth: "206px",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Radio size={9} style={{ color: "var(--c-t5)" }} />
          <span className="tracking-widest uppercase" style={LABEL_STYLE}>
            SOCMINT Watch
          </span>
        </div>
        <button
          onClick={() => {
            setRegionOpen(false);
            setCollapsed(true);
          }}
          aria-label="Collapse SOCMINT card"
          style={{ color: "var(--c-t5)" }}
        >
          <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      {/* Coverage */}
      <div className="mb-3" style={{ position: "relative" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="tracking-widest uppercase" style={LABEL_STYLE}>
            Coverage
          </span>
        </div>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setRegionOpen((v) => !v)}
        >
          <span
            className="font-semibold"
            style={{ fontSize: "14px", color: "var(--c-silver)" }}
          >
            {regionLabel}
          </span>
          <ChevronDown
            size={12}
            style={{
              color: "var(--c-t5)",
              transform: regionOpen ? "rotate(180deg)" : undefined,
              transition: "transform 150ms",
            }}
          />
        </button>
        <span
          className="block mt-0.5"
          style={{ fontSize: "10.5px", color: "var(--c-silver-dim)" }}
        >
          {regionSubtitle}
        </span>

        {regionOpen && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden"
            style={{ top: "100%", zIndex: 200, ...DROPDOWN_STYLE }}
          >
            {REGION_OPTIONS.map((opt) => {
              const active = activeRegion === opt.key;
              return (
                <button
                  key={opt.key}
                  style={itemStyle(active)}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                  }}
                  onClick={() => {
                    onRegionChange(opt.key);
                    setRegionOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />
            <button
              style={itemStyle(isGlobal)}
              onMouseEnter={(e) => {
                if (!isGlobal)
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!isGlobal)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
              onClick={() => {
                onRegionChange("global");
                setRegionOpen(false);
              }}
            >
              All Regions
            </button>
          </div>
        )}
      </div>

      {/* Min Confidence */}
      <div
        className="mb-3"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "11px",
        }}
      >
        <span className="tracking-widest uppercase block mb-2" style={LABEL_STYLE}>
          Min Confidence
        </span>
        <div className="flex flex-nowrap items-center gap-1">
          {THRESHOLD_OPTIONS.map((opt) => {
            const active = opt.value === confidenceMin;
            return (
              <button
                key={opt.value}
                onClick={() => onConfidenceChange(opt.value)}
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  padding: "4px 7px",
                  borderRadius: "5px",
                  whiteSpace: "nowrap",
                  color: active ? "var(--c-accent-text)" : "var(--c-t5)",
                  background: active
                    ? "var(--c-accent-grad-soft)"
                    : "rgba(255,255,255,0.026)",
                  border: active
                    ? "1px solid var(--c-accent-border)"
                    : "1px solid rgba(255,255,255,0.055)",
                  transition: "all 150ms",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "11px",
        }}
      >
        <span className="tracking-widest uppercase block mb-2" style={LABEL_STYLE}>
          Active Reports
        </span>
        <div className="flex flex-col gap-1.5">
          {SOCMINT_TYPES.map((type) => {
            const count = filtered.filter((report) => report.type === type).length;
            return (
              <div key={type} className="flex items-center justify-between">
                <span style={{ fontSize: "10.5px", color: "var(--c-silver-dim)" }}>
                  {SOCMINT_TYPE_LABELS[type]}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: TYPE_COLORS[type],
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "8px",
            marginTop: "8px",
          }}
        >
          <span
            className="block tracking-widest uppercase mb-1.5"
            style={LABEL_STYLE}
          >
            Total Reports
          </span>
          <span
            className="font-bold leading-none"
            style={{ fontSize: "28px", color: "var(--c-t1)" }}
          >
            {filtered.length}
          </span>
        </div>
      </div>
    </div>
  );
}
