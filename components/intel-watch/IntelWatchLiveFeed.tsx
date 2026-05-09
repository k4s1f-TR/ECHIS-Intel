"use client";

import { liveFeedEvents } from "@/data/intel-watch/events";
import type { FeedCategory } from "@/types/intel-watch";

const CATEGORY_STYLE: Record<FeedCategory, { label: string; color: string; bg: string }> = {
  diplomatic: { label: "Diplomatic", color: "rgba(96,165,250,0.9)", bg: "rgba(29,78,216,0.12)" },
  security: { label: "Security", color: "rgba(251,146,60,0.9)", bg: "rgba(124,45,18,0.15)" },
  sanctions: { label: "Sanctions", color: "rgba(248,113,113,0.9)", bg: "rgba(127,29,29,0.15)" },
  influence: { label: "Influence", color: "rgba(167,139,250,0.9)", bg: "rgba(76,29,149,0.15)" },
  border: { label: "Border", color: "rgba(250,204,21,0.9)", bg: "rgba(113,63,18,0.15)" },
  policy: { label: "Policy", color: "rgba(148,163,184,0.85)", bg: "rgba(255,255,255,0.06)" },
};

export function IntelWatchLiveFeed() {
  return (
    <div
      className="flex flex-col min-h-0 overflow-hidden flex-shrink-0"
      style={{
        width: "330px",
        background: "rgba(8,10,16,0.98)",
        borderLeft: "1px solid rgba(255,255,255,0.065)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "rgba(155,170,190,0.9)",
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
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.9)",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
            <span
              style={{
                fontSize: "8px",
                fontWeight: 700,
                color: "rgba(239,68,68,0.9)",
                letterSpacing: "0.08em",
              }}
            >
              LIVE
            </span>
          </span>
        </div>
        <button
          style={{
            fontSize: "9.5px",
            fontWeight: 500,
            color: "rgba(110,125,145,0.8)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "4px",
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          Filter
        </button>
      </div>

      {/* Feed cards */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ padding: "6px 0" }}>
        {liveFeedEvents.map((event) => {
          const cs = CATEGORY_STYLE[event.category];
          return (
            <div
              key={event.id}
              className="flex gap-2.5 px-3.5 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              {/* Agency circle */}
              <div
                className="flex items-center justify-center flex-shrink-0 rounded-full"
                style={{
                  width: 28,
                  height: 28,
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "7.5px",
                  fontWeight: 700,
                  color: "rgba(180,195,215,0.85)",
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
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "rgba(210,220,235,0.93)",
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
                    fontSize: "10px",
                    color: "rgba(125,140,160,0.8)",
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
                  {/* Category tag */}
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
                  {/* Source */}
                  <span
                    style={{ fontSize: "9px", color: "rgba(100,115,135,0.7)" }}
                  >
                    {event.source}
                  </span>
                  {/* Timestamp */}
                  <span
                    style={{
                      fontSize: "9px",
                      color: "rgba(85,100,120,0.65)",
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
        style={{ borderTop: "1px solid rgba(255,255,255,0.055)" }}
      >
        <button
          style={{
            fontSize: "10px",
            color: "rgba(74,222,128,0.8)",
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
