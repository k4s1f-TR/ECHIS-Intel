"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileText, Radio, X } from "lucide-react";
import type { IntelligenceEventCandidate } from "@/data/source-intelligence/sourceIntelligenceTypes";
import { useSourceIntelligenceItems } from "./useSourceIntelligenceItems";

const LEFT_RAIL_W = 68;
const HEADER_H = 52;
const MODAL_ANIMATION_MS = 260;

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
        color: accent ? "rgba(205,225,255,0.9)" : "rgba(148,163,184,0.72)",
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
          background: "#070b0f",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 32px 90px rgba(0,0,0,0.55)",
          color: "rgba(232,238,244,0.94)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div style={{ height: 3, background: "#60a5fa", opacity: 0.95 }} />
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
                    background: "#60a5fa",
                    boxShadow: "0 0 10px rgba(96,165,250,0.42)",
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
                  border: "1px solid rgba(96,165,250,0.34)",
                  background: "rgba(96,165,250,0.1)",
                  color: "rgba(205,225,255,0.95)",
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
                  color: "rgba(96,165,250,0.8)",
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
    ? "rgba(96,165,250,0.38)"
    : isOpen
      ? "rgba(96,165,250,0.22)"
      : "rgba(255,255,255,0.055)";
  const activeBg = isSelected
    ? "rgba(59,130,246,0.08)"
    : isOpen
      ? "rgba(59,130,246,0.04)"
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
            color: "rgba(120,140,170,0.9)",
          }}
        >
          {index}
        </span>
        <p
          className="line-clamp-2 flex-1 pr-1 font-medium leading-snug"
          style={{
            fontSize: "12.5px",
            color: "rgba(190,208,230,0.85)",
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
            color: isOpen ? "rgba(96,165,250,0.9)" : "rgba(70,90,120,0.65)",
            background: isOpen ? "rgba(59,130,246,0.15)" : "transparent",
            border: isOpen ? "1px solid rgba(96,165,250,0.25)" : "1px solid transparent",
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
              color: "rgba(70,90,120,0.65)",
              background: "transparent",
            }}
          >
            <ExternalLink size={10} />
          </button>
        )}
      </div>

      <div className="mb-1.5 flex flex-wrap items-center gap-1.5" style={{ fontSize: "10.5px" }}>
        <span style={{ color: "rgba(130,150,170,0.8)", fontWeight: 500 }}>
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
          style={{ fontSize: "11.5px", color: "rgba(105,105,105,0.9)" }}
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

function LoadingSkeleton() {
  return (
    <div
      className="min-h-0 flex-1 overflow-hidden"
      style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg"
          style={{
            height: "80px",
            border: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(255,255,255,0.012)",
            opacity: 1 - i * 0.25,
          }}
        />
      ))}
    </div>
  );
}

export function SourceGlobalFeedPanel({
  selectedItemId,
  onItemSelect,
}: {
  selectedItemId?: string | null;
  onItemSelect?: (id: string) => void;
}) {
  const { items, loadState } = useSourceIntelligenceItems();
  const [selectedItem, setSelectedItem] =
    useState<IntelligenceEventCandidate | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedItemId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-source-item-id="${selectedItemId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedItemId]);

  return (
    <>
      <div
        className="flex h-full max-h-full min-h-0 flex-shrink-0 flex-col overflow-hidden rounded-[10px]"
        style={{
          width: "100%",
          background: "rgba(12,12,12,0.97)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="flex flex-shrink-0 items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2">
            <Radio size={10} style={{ color: "rgba(96,165,250,0.45)" }} />
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
                color: "rgba(96,165,250,0.65)",
                background: "rgba(59,130,246,0.07)",
                border: "1px solid rgba(59,130,246,0.14)",
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
              scrollbarColor: "rgba(59,130,246,0.18) transparent",
            }}
          >
            {items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <span style={{ fontSize: "11px", color: "rgba(70,70,70,0.9)" }}>
                  No source intelligence items available.
                </span>
              </div>
            ) : (
              items.map((item, i) => (
                <SourceFeedCard
                  key={item.id}
                  item={item}
                  index={i + 1}
                  isOpen={selectedItem?.id === item.id}
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
              {items.length} items
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

      {selectedItem !== null && (
        <SourceItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
