"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ExternalLink, FileText, Radio, X } from "lucide-react";
import type { IntelligenceEventCandidate } from "@/data/source-intelligence/sourceIntelligenceTypes";
import { useSourceIntelligenceItems } from "./useSourceIntelligenceItems";

const LEFT_RAIL_W = 68;
const HEADER_H = 52;
const MODAL_ANIMATION_MS = 260;
export const ALL_SOURCES_FILTER = "__all_sources__";

function formatAge(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatPublishedFull(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toUTCString().replace(/ GMT$/, " UTC");
}

function labelFor(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ProvenanceChip({
  children,
  dimmed = false,
}: {
  children: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <span
      className="rounded px-1.5 py-0.5 uppercase"
      style={{
        fontSize: "7.5px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: dimmed ? "rgba(100,115,135,0.6)" : "rgba(148,163,184,0.78)",
        background: dimmed ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${dimmed ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {children}
    </span>
  );
}

function DetailGrid({ items }: { items: Array<[string, string | undefined]> }) {
  const visible = items.filter(([, value]) => Boolean(value));
  if (visible.length === 0) return null;

  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "12px 14px",
        marginTop: 12,
      }}
    >
      {visible.map(([label, value]) => (
        <div key={`${label}-${value}`} className="min-w-0">
          <dt
            className="uppercase"
            style={{
              color: "rgba(148,163,184,0.62)",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.11em",
              lineHeight: 1,
            }}
          >
            {label}
          </dt>
          <dd
            className="mt-1.5 truncate"
            title={value}
            style={{
              color: "rgba(220,228,238,0.9)",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionLabel({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="uppercase"
      style={{
        color: accent ? "var(--accent-blue-text)" : "rgba(148,163,184,0.72)",
        fontSize: 10,
        fontWeight: 850,
        letterSpacing: "0.12em",
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function SourceItemDetailModal({
  item,
  onClose,
}: {
  item: IntelligenceEventCandidate;
  onClose: () => void;
}) {
  const closeTimerRef = useRef<number | null>(null);
  const [animationState, setAnimationState] =
    useState<"opening" | "open" | "closing">("opening");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimationState("open"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  function requestClose() {
    if (animationState === "closing") return;
    window.requestAnimationFrame(() => setAnimationState("closing"));
    closeTimerRef.current = window.setTimeout(onClose, MODAL_ANIMATION_MS);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const modalVisible = animationState === "open";
  const modalTransform = modalVisible ? "scale(1)" : "scale(0.98)";
  const metaItems: Array<[string, string | undefined]> = [
    ["Source", item.sourceName],
    ["Source ID", item.sourceId],
    ["Domain", labelFor(item.primaryDomain)],
    ["Published", formatAge(item.publishedAt)],
    ["Date (UTC)", formatPublishedFull(item.publishedAt)],
    ["Collection", labelFor(item.collectionMethod)],
    ["Source Basis", labelFor(item.sourceBasis)],
    ["Verification", labelFor(item.verificationStatus)],
    ["Marker", labelFor(item.markerEligibility)],
    ["Geo Basis", item.geoBasis?.label],
    ["Geo Method", item.geoBasis?.resolutionMethod ? labelFor(item.geoBasis.resolutionMethod) : undefined],
    ["Geo Evidence", item.geoBasis?.evidence?.join("; ")],
  ];

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: HEADER_H,
        left: LEFT_RAIL_W,
        right: 0,
        bottom: 0,
        zIndex: 9000,
        pointerEvents: "none",
        display: "grid",
        gridTemplateColumns: "220px minmax(0, 1fr) 400px",
        alignItems: "center",
        justifyItems: "center",
        padding: 24,
      }}
    >
      <div
        aria-modal="true"
        role="dialog"
        style={{
          gridColumn: 2,
          width: "min(540px, 100%)",
          height: "min(560px, calc(100% - 48px))",
          maxHeight: "min(560px, calc(100% - 48px))",
          opacity: modalVisible ? 1 : 0,
          transform: modalTransform,
          transformOrigin: "50% 50%",
          transition: `opacity ${MODAL_ANIMATION_MS}ms ease, transform ${MODAL_ANIMATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
          overflow: "hidden",
          borderRadius: 18,
          background: "var(--bg-panel)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "var(--shadow-inset-highlight), 0 32px 90px rgba(0,0,0,0.55)",
          color: "rgba(232,238,244,0.94)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div style={{ height: 3, background: "var(--accent-blue-text)", opacity: 0.95 }} />
        <div
          style={{
            height: "calc(100% - 3px)",
            maxHeight: "calc(min(560px, calc(100vh - 48px)) - 3px)",
            overflowY: "auto",
            padding: "18px 20px 20px",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--accent-blue-text)",
                    boxShadow: "0 0 10px var(--accent-blue-glow)",
                    flex: "0 0 auto",
                  }}
                />
                <span
                  className="uppercase"
                  style={{
                    color: "rgba(148,163,184,0.78)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                  }}
                >
                  Source Item Detail
                </span>
              </div>
              <h2
                className="leading-tight"
                style={{
                  color: "rgba(248,250,252,0.96)",
                  fontSize: 18,
                  fontWeight: 850,
                }}
              >
                  {item.title}
              </h2>
              <div
                className="mt-2"
                style={{
                  color: "rgba(177,190,205,0.86)",
                  fontSize: 13,
                  fontWeight: 650,
                  lineHeight: 1.25,
                }}
              >
                {item.geoBasis?.label ?? item.sourceName}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span
                className="uppercase"
                style={{
                  borderRadius: 4,
                  border: "1px solid var(--accent-blue-border)",
                  background: "var(--accent-blue-bg)",
                  color: "var(--accent-blue-text)",
                  padding: "5px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                }}
              >
                {labelFor(item.sourceBasis)}
              </span>
              <button
                aria-label="Close source item detail"
                type="button"
                onClick={requestClose}
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  minWidth: 28,
                  height: 28,
                  padding: 0,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(190,205,220,0.82)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <section
            style={{
              marginTop: 18,
              padding: "12px 0",
              borderTop: "1px solid rgba(255,255,255,0.09)",
              borderBottom: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <SectionLabel>Metadata</SectionLabel>
            <DetailGrid items={metaItems} />
          </section>

          {item.summary && (
            <section className="mt-5">
              <SectionLabel accent>Source Summary</SectionLabel>
              <p
                style={{
                  marginTop: 10,
                  color: "rgba(203,213,225,0.9)",
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.65,
                }}
              >
                {item.summary}
              </p>
            </section>
          )}

          <section
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <ProvenanceChip>{labelFor(item.primaryDomain)}</ProvenanceChip>
            <ProvenanceChip>{labelFor(item.extractionMethod)}</ProvenanceChip>
            <ProvenanceChip dimmed>{labelFor(item.collectionMethod)}</ProvenanceChip>
            {item.tags.map((tag) => (
              <ProvenanceChip key={tag} dimmed>
                {tag}
              </ProvenanceChip>
            ))}
          </section>

          <section
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--accent-blue-text)",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={12} />
                Open original source article
              </a>
            ) : (
              <span style={{ fontSize: 11, color: "rgba(70,70,70,0.9)" }}>
                No source URL available.
              </span>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SourceFeedCard({
  item,
  index,
  isOpen,
  isSelected,
  onToggle,
  onCardClick,
}: {
  item: IntelligenceEventCandidate;
  index: number;
  isOpen: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onCardClick: () => void;
}) {
  const activeBorder = isSelected
    ? "var(--accent-blue-border)"
    : isOpen
      ? "rgba(240,64,76,0.22)"
      : "rgba(255,255,255,0.055)";
  const activeBg = isSelected
    ? "linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))"
    : isOpen
      ? "rgba(236,47,59,0.04)"
      : "rgba(255,255,255,0.018)";

  return (
    <div
      data-source-item-id={item.id}
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      className="relative cursor-pointer rounded-lg transition-all duration-150"
      style={{
        padding: "10px 11px",
        border: `1px solid ${activeBorder}`,
        background: activeBg,
      }}
    >
      <div className="mb-1.5 flex items-start gap-2">
        <span
          className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
          style={{
            fontSize: "9px",
            fontWeight: 700,
            background: "rgba(255,255,255,0.07)",
            color: "var(--c-t5)",
          }}
        >
          {index}
        </span>
        <p
          className="line-clamp-2 flex-1 pr-1 font-medium leading-snug"
          style={{
            fontSize: "12.5px",
            color: "var(--c-t3)",
          }}
        >
          {item.title}
        </p>
        <button
          type="button"
          aria-label={isOpen ? "Close details" : "Open details"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex flex-shrink-0 items-center justify-center rounded transition-colors duration-150"
          style={{
            marginTop: 2,
            width: 18,
            height: 18,
            color: isOpen ? "var(--accent-blue-text)" : "var(--c-t6)",
            background: isOpen ? "var(--accent-blue-bg-strong)" : "transparent",
            border: isOpen ? "1px solid var(--accent-blue-border)" : "1px solid transparent",
          }}
        >
          <FileText size={10} />
        </button>
        {item.url && (
          <button
            type="button"
            aria-label="Open source in new tab"
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.url, "_blank", "noopener,noreferrer");
            }}
            className="flex flex-shrink-0 items-center justify-center rounded"
            style={{
              marginTop: 2,
              width: 18,
              height: 18,
              color: "var(--c-t6)",
              background: "transparent",
            }}
          >
            <ExternalLink size={10} />
          </button>
        )}
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-1.5" style={{ fontSize: "10.5px" }}>
        <span style={{ color: "var(--c-silver-dim)", fontWeight: 500 }}>
          {item.sourceName}
        </span>
        {item.publishedAt && (
          <>
            <span style={{ color: "rgba(55,55,55,0.9)" }}>-</span>
            <span style={{ color: "rgba(95,95,95,0.9)" }}>{formatAge(item.publishedAt)}</span>
          </>
        )}
      </div>

      {item.summary && (
        <p
          className="line-clamp-2 leading-relaxed"
          style={{ fontSize: "11.5px", color: "var(--c-t5)" }}
        >
          {item.summary}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ProvenanceChip>{labelFor(item.primaryDomain)}</ProvenanceChip>
        <ProvenanceChip dimmed>{labelFor(item.sourceBasis)}</ProvenanceChip>
        <ProvenanceChip dimmed>{labelFor(item.collectionMethod)}</ProvenanceChip>
      </div>
    </div>
  );
}

export type SourceFilterOption = {
  id: string;
  name: string;
  count: number;
};

export function buildSourceFilterOptions(
  items: IntelligenceEventCandidate[],
): SourceFilterOption[] {
  const bySource = new Map<string, SourceFilterOption>();
  for (const item of items) {
    const existing = bySource.get(item.sourceId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    bySource.set(item.sourceId, {
      id: item.sourceId,
      name: item.sourceName,
      count: 1,
    });
  }
  return [...bySource.values()].sort((a, b) => {
    const countDelta = b.count - a.count;
    if (countDelta !== 0) return countDelta;
    return a.name.localeCompare(b.name);
  });
}

export function SourceFilterList({
  options,
  totalCount,
  selectedSourceId,
  onSelectSource,
  standalone = false,
  collapsed = false,
  onCollapsedChange,
}: {
  options: SourceFilterOption[];
  totalCount: number;
  selectedSourceId: string;
  onSelectSource: (sourceId: string) => void;
  standalone?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const allSelected = selectedSourceId === ALL_SOURCES_FILTER;

  if (standalone && collapsed) {
    return (
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl"
        onClick={() => onCollapsedChange?.(false)}
        style={{
          padding: "10px 12px",
          background: "var(--bg-panel)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(14px)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <Radio size={10} style={{ color: "rgba(100,100,100,0.74)" }} />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "rgba(185,195,210,0.9)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Sources
        </span>
        <ChevronRight size={12} style={{ color: "rgba(100,100,100,0.78)" }} />
      </button>
    );
  }

  return (
    <div
      className="flex flex-shrink-0 flex-col"
      style={{
        border: standalone
          ? "1px solid rgba(255,255,255,0.07)"
          : undefined,
        borderBottom: standalone
          ? undefined
          : "1px solid rgba(255,255,255,0.045)",
        borderRadius: standalone ? 10 : undefined,
        background: standalone ? "var(--bg-panel)" : "var(--c-card-bg)",
        backdropFilter: standalone ? "blur(14px)" : undefined,
        boxShadow: standalone
          ? "0 8px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.035) inset"
          : undefined,
        padding: "7px 10px 8px",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className="uppercase"
          style={{
            color: "rgba(125,140,160,0.78)",
            fontSize: 8.5,
            fontWeight: 800,
            letterSpacing: "0.11em",
          }}
        >
          Sources
        </span>
        <div className="flex items-center gap-2">
          <span
            style={{
              color: "rgba(80,95,115,0.8)",
              fontSize: 9,
              fontWeight: 650,
            }}
          >
            {options.length} sources
          </span>
          {standalone && (
            <button
              type="button"
              aria-label="Collapse sources filter"
              onClick={() => onCollapsedChange?.(true)}
              style={{ color: "rgba(100,100,100,0.8)" }}
            >
              <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
        </div>
      </div>

      <div
        className="source-filter-scrollbar"
        style={{
          maxHeight: 214,
          overflowY: "auto",
          paddingRight: 2,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(236,47,59,0.16) transparent",
        }}
      >
        <button
          type="button"
          onClick={() => onSelectSource(ALL_SOURCES_FILTER)}
          className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors duration-150"
          style={{
            background: allSelected ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.026)",
            border: `1px solid ${allSelected ? "var(--accent-blue-border)" : "rgba(255,255,255,0.055)"}`,
            color: allSelected ? "var(--accent-blue-text)" : "var(--c-silver-dim)",
          }}
        >
          <span
            className="truncate"
            style={{ fontSize: 10.5, fontWeight: allSelected ? 750 : 650 }}
          >
            All Sources
          </span>
          <span
            style={{
              flexShrink: 0,
              borderRadius: 4,
              padding: "2px 5px",
              background: "rgba(255,255,255,0.045)",
              color: "var(--c-t4)",
              fontSize: 9,
              fontWeight: 750,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalCount}
          </span>
        </button>

        {options.map((source) => {
          const selected = source.id === selectedSourceId;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onSelectSource(source.id)}
              className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
              style={{
                background: selected ? "var(--accent-blue-bg)" : "transparent",
                border: `1px solid ${selected ? "var(--accent-blue-border)" : "rgba(255,255,255,0.035)"}`,
                color: selected ? "var(--accent-blue-text)" : "var(--c-t4)",
              }}
            >
              <span
                className="truncate"
                title={source.name}
                style={{ fontSize: 10.5, fontWeight: selected ? 720 : 590 }}
              >
                {source.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  minWidth: 24,
                  borderRadius: 4,
                  padding: "2px 5px",
                  textAlign: "center",
                  background: selected ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.035)",
                  color: selected ? "var(--accent-blue-text)" : "var(--c-t5)",
                  fontSize: 9,
                  fontWeight: 760,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {source.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  const shimmer =
    "linear-gradient(90deg, transparent, rgba(148,163,184,0.11), transparent)";

  const shimmerSpan = (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        transform: "translateX(-100%)",
        background: shimmer,
        animation: "source-panel-shimmer 1.6s infinite",
      }}
    />
  );

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden"
      style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px" }}
    >
      <style>{`
        @keyframes source-panel-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-lg"
          style={{
            minHeight: 96,
            border: "1px solid rgba(255,255,255,0.055)",
            background: "rgba(255,255,255,0.018)",
            padding: "11px 12px",
            opacity: 1 - i * 0.08,
          }}
        >
          {[0, 1, 2].map((line) => (
            <div
              key={line}
              style={{
                position: "relative",
                overflow: "hidden",
                height: line === 0 ? 10 : 8,
                width: line === 0 ? "68%" : line === 1 ? "92%" : "76%",
                marginBottom: line === 2 ? 0 : 8,
                borderRadius: 999,
                background: "rgba(148,163,184,0.095)",
              }}
            >
              {shimmerSpan}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {[0, 1, 2].map((chip) => (
              <div
                key={chip}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  height: 18,
                  width: chip === 0 ? 54 : chip === 1 ? 70 : 46,
                  borderRadius: 4,
                  background: "rgba(236,47,59,0.055)",
                  border: "1px solid rgba(236,47,59,0.08)",
                }}
              >
                {shimmerSpan}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SourceGlobalFeedPanel({
  selectedItemId,
  onItemSelect,
  items: filteredItems,
  selectedSourceId: controlledSelectedSourceId,
}: {
  selectedItemId?: string | null;
  onItemSelect?: (id: string) => void;
  items?: IntelligenceEventCandidate[];
  selectedSourceId?: string;
}) {
  const { items: allItems, loadState } = useSourceIntelligenceItems();
  const items = filteredItems ?? allItems;
  const [selectedItem, setSelectedItem] =
    useState<IntelligenceEventCandidate | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedSourceId = controlledSelectedSourceId ?? ALL_SOURCES_FILTER;
  const sourceOptions = useMemo<SourceFilterOption[]>(
    () => buildSourceFilterOptions(items),
    [items],
  );
  const effectiveSelectedSourceId = useMemo(() => {
    if (selectedSourceId === ALL_SOURCES_FILTER) return ALL_SOURCES_FILTER;
    return sourceOptions.some((source) => source.id === selectedSourceId)
      ? selectedSourceId
      : ALL_SOURCES_FILTER;
  }, [selectedSourceId, sourceOptions]);
  const visibleItems = useMemo(
    () =>
      effectiveSelectedSourceId === ALL_SOURCES_FILTER
        ? items
        : items.filter((item) => item.sourceId === effectiveSelectedSourceId),
    [items, effectiveSelectedSourceId],
  );
  const visibleSelectedItem =
    selectedItem && visibleItems.some((item) => item.id === selectedItem.id)
      ? selectedItem
      : null;

  useEffect(() => {
    if (!selectedItemId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-source-item-id="${selectedItemId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedItemId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [effectiveSelectedSourceId]);

  return (
    <>
      <div
        className="flex h-full max-h-full min-h-0 flex-shrink-0 flex-col overflow-hidden rounded-[10px]"
        style={{
          width: "100%",
          background: "var(--bg-panel)",
          border: "1px solid var(--c-border-1)",
          boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          className="flex flex-shrink-0 items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2">
            <Radio size={10} style={{ color: "rgba(250,86,96,0.45)" }} />
            <span
              className="font-semibold uppercase tracking-widest"
              style={{ fontSize: "10px", color: "rgba(170,170,170,0.8)" }}
            >
              Source Intelligence
            </span>
          </div>
          <div className="flex items-center gap-2">
            {loadState === "partial" && (
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  color: "rgba(251,191,36,0.75)",
                  letterSpacing: "0.04em",
                }}
              >
                PARTIAL
              </span>
            )}
            <span
              className="rounded px-1.5 py-0.5 uppercase tracking-wide"
              style={{
                fontSize: "7.5px",
                fontWeight: 700,
                letterSpacing: "0.07em",
                color: "rgba(250,86,96,0.65)",
                background: "rgba(236,47,59,0.07)",
                border: "1px solid rgba(236,47,59,0.14)",
              }}
            >
              Multi-source
            </span>
          </div>
        </div>

        {loadState === "loading" && <LoadingSkeleton />}

        {loadState === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
            <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(110,110,110,0.85)" }}>
              Source feed unavailable.
            </span>
            <span style={{ fontSize: "10.5px", color: "rgba(70,70,70,0.9)" }}>
              No source intelligence items available.
            </span>
          </div>
        )}

        {(loadState === "loaded" || loadState === "partial") && (
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto"
            style={{
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(236,47,59,0.18) transparent",
            }}
          >
            {visibleItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <span style={{ fontSize: "11px", color: "rgba(70,70,70,0.9)" }}>
                  No source intelligence items for this source.
                </span>
              </div>
            ) : (
              visibleItems.map((item, i) => (
                <SourceFeedCard
                  key={item.id}
                  item={item}
                  index={i + 1}
                  isOpen={visibleSelectedItem?.id === item.id}
                  isSelected={selectedItemId === item.id}
                  onToggle={() =>
                    setSelectedItem((prev) => (prev?.id === item.id ? null : item))
                  }
                  onCardClick={() => onItemSelect?.(item.id)}
                />
              ))
            )}
          </div>
        )}

        {(loadState === "loaded" || loadState === "partial") && items.length > 0 && (
          <div
            className="flex flex-shrink-0 items-center justify-between px-4 py-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <span style={{ fontSize: "9.5px", color: "rgba(60,60,60,0.85)" }}>
              {visibleItems.length} / {items.length} items
            </span>
            <span
              style={{
                fontSize: "8.5px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "rgba(55,55,55,0.9)",
                textTransform: "uppercase",
              }}
            >
              Source Pipeline
            </span>
          </div>
        )}
      </div>

      {visibleSelectedItem !== null && (
        <SourceItemDetailModal
          item={visibleSelectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
