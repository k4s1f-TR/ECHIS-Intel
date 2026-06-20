"use client";

import { liveFeedEvents } from "@/data/intel-watch/events";
import type { FeedCategory } from "@/types/intel-watch";

const CATEGORY_STYLE: Record<FeedCategory, { label: string; color: string; bg: string }> = {
  diplomatic: { label: "Diplomatic", color: "var(--c-elev)", bg: "var(--c-elev-bg)" },
  security: { label: "Security", color: "rgba(251,146,60,0.9)", bg: "rgba(124,45,18,0.15)" },
  sanctions: { label: "Sanctions", color: "rgba(248,113,113,0.9)", bg: "rgba(127,29,29,0.15)" },
  influence: { label: "Influence", color: "var(--c-med)", bg: "var(--c-med-bg)" },
  border: { label: "Border", color: "rgba(250,204,21,0.9)", bg: "rgba(113,63,18,0.15)" },
  policy: { label: "Policy", color: "var(--c-elev)", bg: "var(--c-elev-bg)" },
};

type Props = {
  onOpenDrawer: () => void;
};

export function IntelWatchLiveFeed({ onOpenDrawer }: Props) {
  return (
    // flex-1 fills the flex-column relative wrapper in IntelWatchPanel
    <div
      className="flex flex-col min-h-0 overflow-hidden flex-1"
      style={{
        width: "330px",
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: "var(--fs-sm)",
              fontWeight: 700,
              color: "var(--c-t4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Live Feed
          </span>
          {/* Pulsing LIVE badge */}
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(127,29,29,0.25)",
              border: "1px solid var(--sev-critical-border)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--sev-critical-text)",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
            <span
              style={{
                fontSize: "var(--fs-2xs)",
                fontWeight: 700,
                color: "var(--sev-critical-text)",
                letterSpacing: "0.08em",
              }}
            >
              LIVE
            </span>
          </span>
        </div>
        <button
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 500,
            color: "var(--c-t5)",
            background: "var(--c-card-bg-hover)",
            border: "1px solid var(--c-border-1)",
            borderRadius: "var(--radius-sm)",
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          Filter
        </button>
      </div>

      {/* Feed cards */}
      <div className="tm-scrollbar intel-watch-scrollbar flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ padding: "4px 0" }}>
        {liveFeedEvents.map((event) => {
          const cs = CATEGORY_STYLE[event.category];
          return (
            <div
              key={event.id}
              className="flex gap-2.5 px-3.5 py-2"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              {/* Agency circle */}
              <div
                className="flex items-center justify-center flex-shrink-0 rounded-full"
                style={{
                  width: 28,
                  height: 28,
              background: "var(--c-border-2)",
              border: "1px solid var(--c-border-1)",
                  fontSize: "7.5px",
                  fontWeight: 700,
                  color: "var(--c-t3)",
                  letterSpacing: "0.03em",
                  marginTop: 1,
                }}
              >
                {event.agencyAbbr}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span
                  style={{
                    fontSize: "var(--fs-base)",
                    fontWeight: 600,
                    color: "var(--c-t3)",
                    lineHeight: 1.35,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {event.title}
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-sm)",
                    color: "var(--c-t5)",
                    lineHeight: 1.45,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {event.description}
                </span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    style={{
                      fontSize: "8.5px",
                      fontWeight: 600,
                      color: cs.color,
                      background: cs.bg,
                      borderRadius: "3px",
                      padding: "1px 5px",
                    }}
                  >
                    {cs.label}
                  </span>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-t5)" }}>
                    {event.source}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--c-t6)",
                      fontFamily: "ui-monospace, monospace",
                      marginLeft: "auto",
                    }}
                  >
                    {event.timestamp}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="flex-shrink-0 px-3.5 py-2"
        style={{ borderTop: "1px solid var(--c-border-2)" }}
      >
        <button
          onClick={onOpenDrawer}
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--accent-blue-text)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          View All Feed
        </button>
      </div>
    </div>
  );
}
