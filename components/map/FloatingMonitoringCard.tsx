"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Globe2 } from "lucide-react";
import type { ViewMode } from "@/components/layout/AppShell";
import type { RegionKey } from "@/types/event";
import { REGION_OPTIONS, CATEGORY_OPTIONS } from "@/types/event";

export type MonitorCategoryOption = {
  key: string;
  label: string;
};

interface Props {
  view: ViewMode;
  activeRegion: RegionKey;
  activeCategory: string;
  categoryOptions?: MonitorCategoryOption[];
  isPoliticsWatch?: boolean;
  eventCount: number;
  onViewChange: (view: ViewMode) => void;
  onRegionChange: (region: RegionKey) => void;
  onCategoryChange: (category: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const LABEL_STYLE = {
  fontSize: "8.5px",
  color: "var(--c-silver-dim)",
  fontWeight: 600,
} as const;

const DROPDOWN_STYLE = {
  background: "var(--bg-panel)",
  border: "1px solid var(--c-border-1)",
  backdropFilter: "blur(14px)",
  boxShadow: "var(--shadow-inset-highlight), 0 8px 24px rgba(0,0,0,0.6)",
} as const;

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

export function FloatingMonitoringCard({
  view,
  activeRegion,
  activeCategory,
  categoryOptions = CATEGORY_OPTIONS,
  isPoliticsWatch = false,
  eventCount,
  onViewChange,
  onRegionChange,
  onCategoryChange,
  onCollapsedChange,
}: Props) {
  const [regionOpen, setRegionOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isGlobal = view === "global";
  const regionLabel = REGION_OPTIONS.find((r) => r.key === activeRegion)?.label ?? "Middle East";
  const categoryLabel = categoryOptions.find((c) => c.key === activeCategory)?.label ?? "All Categories";
  const monitoringTitle = isPoliticsWatch ? "Policy Watch" : isGlobal ? "Global View" : regionLabel;
  const monitoringSubtitle = isPoliticsWatch
    ? "Regional Political Monitoring"
    : isGlobal
      ? "Middle East + Global Watch"
      : "Regional Situation Watch";

  // Close dropdowns on outside click
  useEffect(() => {
    if (!regionOpen && !categoryOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [regionOpen, categoryOpen]);

  if (collapsed) {
    return (
      <button
        className="absolute top-4 left-4 rounded-xl z-30 flex items-center gap-2"
        onClick={() => {
          setCollapsed(false);
          onCollapsedChange?.(false);
        }}
        style={{
          padding: "10px 12px",
          background: "var(--bg-panel)",
          border: "1px solid var(--c-border-1)",
          backdropFilter: "blur(14px)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <Globe2 size={10} style={{ color: "var(--c-silver-dim)" }} />
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--c-silver)", letterSpacing: "0.08em" }}>
          Monitor
        </span>
        <ChevronRight
          size={12}
          style={{ color: "var(--c-t5)" }}
        />
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
          <Globe2 size={9} style={{ color: "var(--c-t5)" }} />
          <span className="tracking-widest uppercase" style={LABEL_STYLE}>
            Monitor
          </span>
        </div>
        <button
          onClick={() => {
            setRegionOpen(false);
            setCategoryOpen(false);
            setCollapsed(true);
            onCollapsedChange?.(true);
          }}
          aria-label="Collapse monitoring card"
          style={{ color: "var(--c-t5)" }}
        >
          <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      {/* Monitoring Region */}
      <div className="mb-3" style={{ position: "relative" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="tracking-widest uppercase" style={LABEL_STYLE}>
            Monitoring Region
          </span>
        </div>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => {
            setRegionOpen((v) => !v);
            setCategoryOpen(false);
          }}
        >
          <span
            className="font-semibold"
            style={{ fontSize: "14px", color: "var(--c-silver)" }}
          >
            {monitoringTitle}
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
          {monitoringSubtitle}
        </span>

        {regionOpen && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden"
            style={{ top: "100%", zIndex: 200, ...DROPDOWN_STYLE }}
          >
            {REGION_OPTIONS.map((opt) => {
              const active = opt.key === activeRegion && !isGlobal;
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
                onViewChange("global");
                setRegionOpen(false);
              }}
            >
              Global View
            </button>
          </div>
        )}
      </div>

      {/* Quick Filter */}
      <div
        className="mb-3"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "11px",
          position: "relative",
        }}
      >
        <div className="mb-1">
          <span className="tracking-widest uppercase" style={LABEL_STYLE}>
            Quick Filter
          </span>
        </div>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => {
            setCategoryOpen((v) => !v);
            setRegionOpen(false);
          }}
        >
          <span style={{ fontSize: "12.5px", color: "var(--c-silver)" }}>
            {categoryLabel}
          </span>
          <ChevronDown
            size={12}
            style={{
              color: "var(--c-t5)",
              transform: categoryOpen ? "rotate(180deg)" : undefined,
              transition: "transform 150ms",
            }}
          />
        </button>

        {categoryOpen && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden"
            style={{ top: "100%", zIndex: 200, ...DROPDOWN_STYLE }}
          >
            {categoryOptions.map((opt) => {
              const active = opt.key === activeCategory;
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
                    onCategoryChange(opt.key);
                    setCategoryOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "11px",
        }}
      >
        <span
          className="block tracking-widest uppercase mb-1.5"
          style={LABEL_STYLE}
        >
          Total Active Results
        </span>
        <div className="flex items-end gap-2">
          <span
            className="font-bold leading-none"
            style={{ fontSize: "28px", color: "var(--c-t1)" }}
          >
            {eventCount}
          </span>
          <div className="flex flex-col pb-0.5">
            <span
              className="font-semibold leading-tight"
              style={{ fontSize: "11px", color: "var(--c-elev)" }}
            >
              ↑ 12%
            </span>
            <span
              className="leading-tight"
              style={{ fontSize: "9.5px", color: "var(--c-t5)" }}
            >
              vs last 24h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
