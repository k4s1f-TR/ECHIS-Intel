"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Radio } from "lucide-react";
import { BookmarkToggleButton } from "@/components/events/BookmarkToggleButton";
import { ProvenanceChip } from "@/components/source-intelligence/SourceGlobalFeedPanel";
import type {
  SocmintConfidence,
  SocmintReport,
  SocmintReportType,
  SocmintStatus,
} from "@/types/socmint";
import {
  SOCMINT_PLATFORM_LABELS,
  SOCMINT_STATUS_LABELS,
  SOCMINT_TYPE_BADGE_LABELS,
  SOCMINT_TYPE_OPTIONS,
  socmintMatchesConfidenceFilter,
} from "@/types/socmint";

// Same confidence color ladder as the Global View feed cards.
const CONFIDENCE_COLOR: Record<SocmintConfidence, string> = {
  high: "var(--c-accent-text)",
  medium: "var(--c-silver)",
  low: "var(--c-t5)",
};

const CONFIDENCE_LABELS: Record<SocmintConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_COLORS: Record<SocmintStatus, string> = {
  unverified: "rgba(248,113,113,0.9)",
  reported: "rgba(251,191,36,0.9)",
  corroborated: "var(--c-elev)",
  "needs-review": "rgba(150,170,196,0.9)",
};

function SignalFeedCard({
  report,
  index,
  isSelected,
  onCardClick,
  onOpenDetail,
  bookmarked,
  onToggleBookmark,
}: {
  report: SocmintReport;
  index: number;
  isSelected: boolean;
  onCardClick: () => void;
  onOpenDetail: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <div
      data-signal-id={report.id}
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
        border: `1px solid ${
          isSelected ? "var(--c-accent-border)" : "rgba(255,255,255,0.055)"
        }`,
        background: isSelected
          ? "linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))"
          : "rgba(255,255,255,0.018)",
        boxShadow: isSelected
          ? "0 0 0 1px var(--c-accent-bg-soft), 0 10px 28px rgba(0,0,0,0.35)"
          : "none",
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
            fontFamily: "var(--font-disp)",
            fontSize: "var(--c-fs-md)",
            color: "var(--c-t1)",
          }}
        >
          {report.title}
        </p>
        <button
          type="button"
          aria-label="Open report details"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          className="flex flex-shrink-0 items-center justify-center rounded transition-colors duration-150"
          style={{
            marginTop: 2,
            width: 18,
            height: 18,
            color: "var(--c-t6)",
            background: "transparent",
          }}
        >
          <FileText size={10} />
        </button>
        <span className="mt-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <BookmarkToggleButton
            bookmarked={bookmarked}
            onToggle={onToggleBookmark}
            size={11}
          />
        </span>
      </div>

      <div
        className="mb-1.5 flex flex-wrap items-center gap-1.5"
        style={{ fontSize: "10.5px" }}
      >
        <span style={{ color: "var(--c-silver-dim)", fontWeight: 500 }}>
          {report.sourceName}
        </span>
        <span style={{ color: "var(--c-t6)" }}>-</span>
        <span style={{ color: "var(--c-t5)" }}>{report.timestamp}</span>
        <span style={{ color: "var(--c-t6)" }}>-</span>
        <span
          className="truncate"
          title={report.locationName}
          style={{ maxWidth: 120, color: "var(--c-silver)", fontWeight: 600 }}
        >
          {report.locationName}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1"
          title={`Reported confidence: ${CONFIDENCE_LABELS[report.confidence]}`}
          style={{ color: CONFIDENCE_COLOR[report.confidence], fontWeight: 700 }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: CONFIDENCE_COLOR[report.confidence],
              boxShadow:
                report.confidence === "high"
                  ? "0 0 6px var(--accent-blue-glow)"
                  : "none",
            }}
          />
          <span
            style={{
              fontSize: "8.5px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {CONFIDENCE_LABELS[report.confidence]}
          </span>
        </span>
      </div>

      <p
        className="line-clamp-2 leading-relaxed"
        style={{ fontSize: "11.5px", color: "var(--c-t4)" }}
      >
        {report.summary}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ProvenanceChip>{SOCMINT_PLATFORM_LABELS[report.platform]}</ProvenanceChip>
        <ProvenanceChip dimmed>{SOCMINT_TYPE_BADGE_LABELS[report.type]}</ProvenanceChip>
        <span
          className="rounded px-1.5 py-0.5 uppercase"
          style={{
            fontSize: "7.5px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: STATUS_COLORS[report.status],
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.045)",
          }}
        >
          {SOCMINT_STATUS_LABELS[report.status]}
        </span>
        {report.relatedEventId && (
          <span
            className="rounded px-1.5 py-0.5 uppercase"
            style={{
              fontSize: "7.5px",
              fontWeight: 800,
              letterSpacing: "0.07em",
              color: "var(--c-accent-text)",
              background: "var(--c-accent-bg-soft)",
              border: "1px solid var(--c-accent-border)",
            }}
          >
            Event #{report.relatedEventId}
          </span>
        )}
      </div>
    </div>
  );
}

export function SignalsPanel({
  signals,
  confidenceMin,
  selectedId,
  onSelect,
  onOpenDetail,
  isBookmarked,
  onToggleBookmark,
}: {
  signals: SocmintReport[];
  confidenceMin: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
}) {
  const [activeType, setActiveType] = useState<SocmintReportType | "all">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll the selected report into view when it changes externally
  // (e.g. from a globe marker click).
  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-signal-id="${selectedId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const filtered = signals.filter((report) =>
    socmintMatchesConfidenceFilter(report, confidenceMin),
  );
  const displayed = filtered.filter(
    (report) => activeType === "all" || report.type === activeType,
  );

  return (
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
            style={{ fontSize: "10px", color: "var(--c-silver)" }}
          >
            SOCMINT Feed
          </span>
        </div>
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
          Social sources
        </span>
      </div>

      <div
        className="flex flex-shrink-0 flex-wrap items-center gap-1 px-3 py-2"
        style={{ borderBottom: "1px solid var(--c-border-3)" }}
      >
        {SOCMINT_TYPE_OPTIONS.map((opt) => {
          const active = opt.key === activeType;
          return (
            <button
              key={opt.key}
              onClick={() => setActiveType(opt.key)}
              style={{
                fontSize: "9.5px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "3px 8px",
                borderRadius: "5px",
                color: active ? "var(--c-accent-text)" : "var(--c-t5)",
                background: active ? "var(--c-accent-grad-soft)" : "transparent",
                border: active
                  ? "1px solid var(--c-accent-border)"
                  : "1px solid transparent",
                transition: "all 150ms",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

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
        {displayed.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span style={{ fontSize: "11px", color: "var(--c-t6)" }}>
              No SOCMINT reports for this filter.
            </span>
          </div>
        ) : (
          displayed.map((report, i) => (
            <SignalFeedCard
              key={report.id}
              report={report}
              index={i + 1}
              isSelected={report.id === selectedId}
              onCardClick={() => onSelect(report.id)}
              onOpenDetail={() => onOpenDetail(report.id)}
              bookmarked={isBookmarked(report.id)}
              onToggleBookmark={() => onToggleBookmark(report.id)}
            />
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div
          className="flex flex-shrink-0 items-center justify-between gap-2 px-4 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div
            className="flex items-center gap-2"
            style={{ fontSize: "9.5px", color: "var(--c-t5)" }}
          >
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: "var(--c-t3)", fontWeight: 700 }}>
                {displayed.length}
              </span>{" "}
              reports
            </span>
            <span style={{ color: "var(--c-t6)" }}>·</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {displayed.length}/{filtered.length} items
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1"
            title="Reports placed on the globe"
            style={{
              fontSize: "9.5px",
              color: "var(--c-t5)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "var(--c-accent)",
              }}
            />
            <span style={{ color: "var(--c-t3)", fontWeight: 700 }}>
              {displayed.length}
            </span>{" "}
            on map
          </span>
        </div>
      )}
    </div>
  );
}
