"use client";

import { agencies } from "@/data/intel-watch/agencies";
import type { AgencyType } from "@/types/intel-watch";

const SORTED = [...agencies].sort((a, b) => b.activityLevel - a.activityLevel);
const MAX_VAL = SORTED[0].activityLevel;

const TYPE_ABBR: Record<AgencyType, string> = {
  Intelligence: "INTEL",
  Diplomatic: "DIPLO",
  Supranational: "SUPRA",
};

const TYPE_COLOR: Record<AgencyType, { color: string; bg: string }> = {
  Intelligence: { color: "var(--c-high)", bg: "var(--c-high-bg)" },
  Diplomatic: { color: "var(--c-elev)", bg: "var(--c-elev-bg)" },
  Supranational: { color: "var(--c-med)", bg: "var(--c-med-bg)" },
};

type Props = {
  onOpenDrawer?: () => void;
};

export function AgencyActivity({ onOpenDrawer }: Props) {
  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3 py-2"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 700,
              color: "var(--c-t4)",
              letterSpacing: "0.09em",
              textTransform: "uppercase",
            }}
          >
            Agency Activity
          </span>
          <span
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--c-t5)",
              cursor: "default",
            }}
            title="Top agencies by mention volume in the last 7 days"
          >
            (i)
          </span>
        </div>
        {onOpenDrawer && (
          <button
            onClick={onOpenDrawer}
            style={{
              fontSize: "var(--fs-xs)",
              color: "var(--accent-blue-text)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            View All
          </button>
        )}
      </div>

      {/* Subtitle */}
      <div className="px-3 pt-1 flex-shrink-0">
        <span
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--c-t6)",
            letterSpacing: "0.04em",
          }}
        >
          Activity Level (Last 7 Days)
        </span>
      </div>

      {/* Scrollable agency rows */}
      <div
        className="tm-scrollbar intel-watch-scrollbar flex-1 min-h-0 overflow-y-auto px-3 pt-1.5 pb-2"
        style={{ display: "flex", flexDirection: "column", gap: "7px" }}
      >
        {SORTED.map((agency) => {
          const pct = (agency.activityLevel / MAX_VAL) * 100;
          const tc = TYPE_COLOR[agency.type];
          return (
            <div key={agency.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    style={{
                      fontSize: "var(--fs-sm)",
                      fontWeight: 500,
                      color: "var(--c-t3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {agency.name}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 600,
                      color: tc.color,
                      background: tc.bg,
                      borderRadius: "3px",
                      padding: "1px 4px",
                      letterSpacing: "0.05em",
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ABBR[agency.type]}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "var(--fs-sm)",
                    color: "var(--c-t5)",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    flexShrink: 0,
                  }}
                >
                  {agency.activityLevel}
                </span>
              </div>
              <div
                style={{
                  height: "3px",
                  borderRadius: "2px",
                  background: "var(--c-border-2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: "2px",
                    background: "var(--accent-grad)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
