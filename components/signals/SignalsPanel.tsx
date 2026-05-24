"use client";
import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { BookmarkToggleButton } from "@/components/events/BookmarkToggleButton";
import type { SocmintReport, SocmintReportType, SocmintStatus } from "@/types/socmint";
import {
  SOCMINT_PLATFORM_LABELS,
  SOCMINT_STATUS_LABELS,
  SOCMINT_TYPE_BADGE_LABELS,
  SOCMINT_TYPE_OPTIONS,
  socmintMatchesConfidenceFilter,
} from "@/types/socmint";

const TYPE_COLORS: Record<SocmintReportType, { badge: string; text: string }> = {
  "local-report": {
    badge: "rgba(96,165,250,0.12)",
    text: "rgba(96,165,250,0.9)",
  },
  "social-claim": {
    badge: "rgba(251,191,36,0.1)",
    text: "rgba(251,191,36,0.9)",
  },
  "osint-account": {
    badge: "rgba(74,222,128,0.1)",
    text: "rgba(74,222,128,0.9)",
  },
  "local-media": {
    badge: "rgba(168,85,247,0.11)",
    text: "rgba(196,181,253,0.9)",
  },
};

const STATUS_COLORS: Record<SocmintStatus, string> = {
  unverified: "rgba(248,113,113,0.9)",
  reported: "rgba(251,191,36,0.9)",
  corroborated: "rgba(74,222,128,0.9)",
  "needs-review": "rgba(147,197,253,0.9)",
};

export function SignalsPanel({
  signals,
  confidenceMin,
  selectedId,
  onSelect,
  isBookmarked,
  onToggleBookmark,
}: {
  signals: SocmintReport[];
  confidenceMin: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
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

  const displayed = signals
    .filter((report) => socmintMatchesConfidenceFilter(report, confidenceMin))
    .filter((report) => activeType === "all" || report.type === activeType);

  return (
    <div
      className="flex h-full max-h-full min-h-0 flex-shrink-0 flex-col overflow-hidden rounded-[10px]"
      style={{
        width: "100%",
        background: "rgba(12,12,12,0.97)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2">
          <Radio size={11} style={{ color: "rgba(96,165,250,0.7)" }} />
          <span
            className="font-semibold tracking-widest uppercase"
            style={{ fontSize: "10px", color: "rgba(170,170,170,0.8)" }}
          >
            SOCMINT Feed
          </span>
        </div>
        <span style={{ fontSize: "10.5px", color: "rgba(100,100,100,0.85)" }}>
          {displayed.length} Reports
        </span>
      </div>

      <div
        className="flex items-center gap-1 px-3 py-2 flex-shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
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
                color: active
                  ? "rgba(147,197,253,0.95)"
                  : "rgba(100,100,100,0.85)",
                background: active ? "rgba(59,130,246,0.12)" : "transparent",
                border: active
                  ? "1px solid rgba(59,130,246,0.2)"
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
        className="flex-1 overflow-y-auto"
        style={{
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {displayed.map((report) => {
          const colors = TYPE_COLORS[report.type];
          const isSelected = report.id === selectedId;
          return (
            <div
              key={report.id}
              data-signal-id={report.id}
              onClick={() => onSelect(report.id)}
              style={{
                background: isSelected ? "rgba(28,28,28,0.9)" : "rgba(18,18,18,0.7)",
                border: isSelected
                  ? "1px solid rgba(96,165,250,0.28)"
                  : "1px solid rgba(255,255,255,0.05)",
                borderRadius: "8px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  style={{
                    fontSize: "8.5px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: colors.badge,
                    color: colors.text,
                  }}
                >
                  {SOCMINT_PLATFORM_LABELS[report.platform]} / {SOCMINT_TYPE_BADGE_LABELS[report.type]}
                </span>
                <BookmarkToggleButton
                  bookmarked={isBookmarked(report.id)}
                  onToggle={() => onToggleBookmark(report.id)}
                  size={11}
                />
              </div>

              <div
                className="mb-1.5"
                style={{
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: "rgba(170,170,170,0.85)",
                }}
              >
                {report.locationName}
              </div>

              <p
                style={{
                  fontSize: "11px",
                  color: "rgba(130,130,130,0.85)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {report.summary}
              </p>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  style={{
                    fontSize: "8.5px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: STATUS_COLORS[report.status],
                  }}
                >
                  STATUS: {SOCMINT_STATUS_LABELS[report.status]}
                </span>
                <span
                  className="truncate"
                  style={{ fontSize: "9px", color: "rgba(122,122,122,0.9)" }}
                >
                  {report.sourceName}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span style={{ fontSize: "9.5px", color: "rgba(125,125,125,0.92)" }}>
                  {report.timestamp}
                </span>
                {report.relatedEventId && (
                  <span
                    style={{
                      fontSize: "8.5px",
                      color: "rgba(125,181,255,0.72)",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {"->"} Event #{report.relatedEventId}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
