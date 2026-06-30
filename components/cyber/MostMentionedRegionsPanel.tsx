"use client";

import { Globe } from "lucide-react";
import type { GeoRole, RegionMetric } from "@/lib/cyber";

/** Role shown on the chip: "mixed" when an item set has both attacker + victim. */
function displayRole(metric: RegionMetric): GeoRole | "mixed" {
  const { origin, target } = metric.roleBreakdown;
  if (origin > 0 && target > 0) return "mixed";
  return metric.dominantRole;
}

const ROLE_STYLE: Record<GeoRole | "mixed", { label: string; color: string; bar: string }> = {
  target: { label: "Target", color: "var(--c-crit)", bar: "var(--c-crit)" },
  origin: { label: "Origin", color: "var(--c-silver)", bar: "var(--c-silver)" },
  mixed: { label: "Mixed", color: "var(--c-accent-text)", bar: "var(--c-accent)" },
  neutral: { label: "Mentioned", color: "var(--c-t5)", bar: "var(--c-t5)" },
};

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="c-mono flex flex-1 items-center justify-center px-4 text-center"
      style={{
        color: "var(--c-t4)",
        fontSize: "var(--c-fs-xs)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {message}
    </div>
  );
}

export function MostMentionedRegionsPanel({
  regions = [],
  isLoading = false,
  hasError = false,
}: {
  regions?: RegionMetric[];
  isLoading?: boolean;
  hasError?: boolean;
}) {
  const top = regions.slice(0, 6);
  const maxCount = top.reduce((m, r) => Math.max(m, r.itemCount), 0) || 1;

  return (
    <div className="cyber-panel h-full">
      <div className="cyber-panel-head">
        <div className="flex items-center gap-[9px]">
          <Globe size={15} style={{ color: "var(--c-silver-dim)" }} />
          <span className="cyber-panel-title">Most Mentioned Regions</span>
        </div>
        <span className="cyber-live-pill" style={{ color: "var(--c-silver-dim)" }}>
          Inferred
        </span>
      </div>

      {isLoading && top.length === 0 ? (
        <EmptyState message="Syncing region data…" />
      ) : hasError && top.length === 0 ? (
        <EmptyState message="Source unavailable." />
      ) : top.length === 0 ? (
        <EmptyState message="No live region data." />
      ) : (
        <div
          className="tm-scrollbar cyber-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col"
          style={{ padding: "10px 14px", gap: 9 }}
        >
          {top.map((region) => {
            const role = displayRole(region);
            const style = ROLE_STYLE[role];
            const width = `${Math.max(6, Math.round((region.itemCount / maxCount) * 100))}%`;
            return (
              <div key={region.regionId} className="flex flex-col" style={{ gap: 5 }}>
                <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                  <span
                    className="truncate"
                    style={{
                      fontSize: "var(--c-fs-sm)",
                      fontWeight: 600,
                      color: "var(--c-t2)",
                      letterSpacing: "0.01em",
                    }}
                    title={region.sampleCountries.join(", ")}
                  >
                    {region.label}
                  </span>
                  <div className="flex flex-shrink-0 items-center" style={{ gap: 7 }}>
                    <span
                      className="c-disp"
                      style={{
                        fontSize: "var(--c-fs-2xs)",
                        fontWeight: 700,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        color: style.color,
                      }}
                    >
                      {style.label}
                    </span>
                    <span
                      className="c-mono"
                      style={{ fontSize: "var(--c-fs-xs)", fontWeight: 500, color: "var(--c-t3)" }}
                    >
                      {region.itemCount}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width,
                      height: "100%",
                      borderRadius: 3,
                      background: style.bar,
                      opacity: role === "neutral" ? 0.4 : 0.85,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
