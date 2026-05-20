"use client";

import { watchlistEntries } from "@/data/intel-watch/watchlist";
import type { PriorityLevel } from "@/types/intel-watch";

const PRIORITY_STYLE: Record<PriorityLevel, { color: string; bg: string; border: string }> = {
  HIGH: {
    color: "rgba(251,146,60,0.95)",
    bg: "rgba(124,45,18,0.18)",
    border: "rgba(251,146,60,0.25)",
  },
  MEDIUM: {
    color: "rgba(250,204,21,0.9)",
    bg: "rgba(113,63,18,0.18)",
    border: "rgba(250,204,21,0.2)",
  },
  LOW: {
    color: "rgba(148,163,184,0.8)",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
  },
};

type Props = {
  onOpenDrawer?: () => void;
};

export function PriorityWatchlist({ onOpenDrawer }: Props) {
  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{
        background: "rgba(10,12,18,0.97)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "8px",
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-3.5 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <span
          style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "rgba(140,155,175,0.9)",
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}
        >
          Priority Watchlist
        </span>
      </div>

      {/* Rows — scrollable, stacked for compact side-panel width */}
      <div
        className="intel-watch-scrollbar flex flex-col flex-1 min-h-0 divide-y"
        style={{ overflowY: "auto", overflowX: "hidden", borderColor: "rgba(255,255,255,0.045)" }}
      >
        {watchlistEntries.map((entry) => {
          const ps = PRIORITY_STYLE[entry.priority];
          return (
            <div key={entry.id} className="px-3 py-2 flex flex-col gap-1.5">
              {/* Line 1 — region/topic + priority */}
              <div className="flex items-start gap-2">
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 500,
                      color: "rgba(195,208,225,0.9)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.region}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(120,135,155,0.75)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.topic}
                  </span>
                </div>
                <span
                  className="flex-shrink-0"
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    color: ps.color,
                    background: ps.bg,
                    border: `1px solid ${ps.border}`,
                    borderRadius: "3px",
                    padding: "1px 6px",
                  }}
                >
                  {entry.priority}
                </span>
              </div>

              {/* Line 2 — confidence bar + updated */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 500,
                      color: "rgba(140,155,175,0.75)",
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "ui-monospace, monospace",
                      minWidth: 26,
                    }}
                  >
                    {entry.confidence}%
                  </span>
                  <div
                    className="flex-1 min-w-0"
                    style={{
                      height: "2px",
                      borderRadius: "1px",
                      background: "rgba(255,255,255,0.07)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${entry.confidence}%`,
                        height: "100%",
                        borderRadius: "1px",
                        background: "rgba(96,165,250,0.5)",
                      }}
                    />
                  </div>
                </div>
                <span
                  className="flex-shrink-0"
                  style={{
                    fontSize: "9.5px",
                    color: "rgba(120,135,155,0.7)",
                    fontFamily: "ui-monospace, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.lastUpdate}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {onOpenDrawer && (
        <div
          className="px-3.5 py-2 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.045)" }}
        >
          <button
            onClick={onOpenDrawer}
            style={{
              fontSize: "10px",
              color: "rgba(74,222,128,0.8)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Open Watchlist
          </button>
        </div>
      )}
    </div>
  );
}
