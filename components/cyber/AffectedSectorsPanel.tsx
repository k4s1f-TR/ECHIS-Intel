"use client";

import { Activity } from "lucide-react";
import type { SectorMetric } from "@/lib/cyber";

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

export function AffectedSectorsPanel({
  sectors = [],
  isLoading = false,
  hasError = false,
}: {
  sectors?: SectorMetric[];
  isLoading?: boolean;
  hasError?: boolean;
}) {
  const top = sectors.slice(0, 7);
  const maxShare = top.reduce((m, s) => Math.max(m, s.share), 0) || 1;

  return (
    <div className="cyber-panel h-full">
      <div className="cyber-panel-head">
        <div className="flex items-center gap-[9px]">
          <Activity size={15} style={{ color: "var(--c-silver-dim)" }} />
          <span className="cyber-panel-title">Affected Sectors</span>
        </div>
        <span className="cyber-live-pill" style={{ color: "var(--c-silver-dim)" }}>
          Inferred
        </span>
      </div>

      {isLoading && top.length === 0 ? (
        <EmptyState message="Syncing sector data…" />
      ) : hasError && top.length === 0 ? (
        <EmptyState message="Source unavailable." />
      ) : top.length === 0 ? (
        <EmptyState message="No live sector data." />
      ) : (
        <div
          className="tm-scrollbar cyber-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col"
          style={{ padding: "10px 14px", gap: 9 }}
        >
          {top.map((sector) => {
            const pct = Math.round(sector.share * 100);
            const width = `${Math.max(6, Math.round((sector.share / maxShare) * 100))}%`;
            return (
              <div key={sector.sectorId} className="flex flex-col" style={{ gap: 5 }}>
                <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                  <span
                    className="truncate"
                    style={{
                      fontSize: "var(--c-fs-sm)",
                      fontWeight: 600,
                      color: "var(--c-t2)",
                      letterSpacing: "0.01em",
                    }}
                    title={sector.sampleTerms.join(", ")}
                  >
                    {sector.label}
                  </span>
                  <div className="flex flex-shrink-0 items-center" style={{ gap: 7 }}>
                    <span
                      className="c-mono"
                      style={{ fontSize: "var(--c-fs-xs)", fontWeight: 500, color: "var(--c-accent-text)" }}
                    >
                      {pct}%
                    </span>
                    <span
                      className="c-mono"
                      style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 500, color: "var(--c-t4)" }}
                    >
                      {sector.itemCount}
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
                      background: "var(--c-accent)",
                      opacity: 0.82,
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
