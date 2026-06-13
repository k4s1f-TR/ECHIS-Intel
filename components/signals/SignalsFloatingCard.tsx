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

const LABEL_STYLE = {
  fontSize: "var(--fs-2xs)",
  color: "var(--text-muted)",
  fontWeight: 600,
} as const;

const THRESHOLD_OPTIONS: { label: string; value: number }[] = [
  { label: "All", value: 0 },
  { label: "Low", value: 20 },
  { label: "Med.", value: 40 },
  { label: "High", value: 70 },
];

const DROPDOWN_STYLE = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-hover)",
  backdropFilter: "blur(14px)",
  boxShadow: "var(--shadow-md)",
} as const;

const TYPE_COLORS: Record<SocmintReportType, string> = {
  "local-report": "rgba(96,165,250,0.85)",
  "social-claim": "rgba(251,191,36,0.85)",
  "osint-account": "rgba(74,222,128,0.85)",
  "local-media": "rgba(196,181,253,0.9)",
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
    color: active ? "var(--icon-active)" : "var(--text-secondary)",
    background: active ? "var(--accent-blue-bg)" : "transparent",
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
        className="absolute top-4 left-4 rounded-xl z-10 flex items-center gap-2"
        onClick={() => setCollapsed(false)}
        style={{
          padding: "10px 12px",
          background: "var(--bg-overlay)",
          border: "1px solid var(--border-primary)",
          backdropFilter: "blur(14px)",
          boxShadow: "var(--shadow-lg), var(--shadow-inset-highlight)",
        }}
      >
        <Radio size={10} style={{ color: "var(--accent-blue-text)" }} />
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-body)", letterSpacing: "0.1em" }}>
          SOCMINT
        </span>
        <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
      </button>
    );
  }

  return (
    <div
      ref={cardRef}
      className="absolute top-4 left-4 rounded-xl z-10"
      style={{
        padding: "14px 16px",
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-primary)",
        backdropFilter: "blur(14px)",
        width: "214px",
        minWidth: "214px",
        boxShadow: "var(--shadow-lg), var(--shadow-inset-highlight)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Radio size={9} style={{ color: "var(--accent-blue-text)" }} />
            <span className="tracking-widest uppercase font-semibold" style={LABEL_STYLE}>
              SOCMINT Watch
            </span>
          </div>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
            Public social source monitoring
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse SOCMINT card"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      <div className="mb-3" style={{ position: "relative" }}>
        <span className="tracking-widest uppercase block mb-1" style={LABEL_STYLE}>
          Coverage
        </span>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setRegionOpen((v) => !v)}
        >
          <span
            className="font-semibold"
            style={{ fontSize: "var(--fs-lg)", color: "var(--text-primary)" }}
          >
            {regionLabel}
          </span>
          <ChevronDown
            size={12}
            style={{
              color: "var(--text-muted)",
              transform: regionOpen ? "rotate(180deg)" : undefined,
              transition: "transform 150ms",
            }}
          />
        </button>
        <span
          className="block mt-0.5"
          style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}
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
                        "var(--bg-surface-hover)";
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
            <div style={{ borderTop: "1px solid var(--border-dim)" }} />
            <button
              style={itemStyle(isGlobal)}
              onMouseEnter={(e) => {
                if (!isGlobal)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--bg-surface-hover)";
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

      <div
        className="mb-3"
        style={{
          borderTop: "1px solid var(--border-dim)",
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
                  fontSize: "var(--fs-xs)",
                  fontWeight: 600,
                  padding: "4px 7px",
                  borderRadius: "6px",
                  whiteSpace: "nowrap",
                  color: active ? "var(--icon-active)" : "var(--text-muted)",
                  background: active ? "var(--accent-blue-bg-strong)" : "var(--bg-surface)",
                  border: active
                    ? "1px solid var(--accent-blue-border)"
                    : "1px solid var(--border-dim)",
                  transition: "all 150ms",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border-dim)",
          paddingTop: "11px",
          maxHeight: "168px",
          overflowY: "auto",
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
                <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                  {SOCMINT_TYPE_LABELS[type]}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: TYPE_COLORS[type],
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
          <div
            style={{
              borderTop: "1px solid var(--border-dim)",
              paddingTop: "6px",
              marginTop: "2px",
            }}
            className="flex items-center justify-between"
          >
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              Total Reports
            </span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {filtered.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
