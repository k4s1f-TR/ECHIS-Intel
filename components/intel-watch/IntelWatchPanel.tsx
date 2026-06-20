"use client";

import { Radar } from "lucide-react";
import { AgencyActivity } from "./AgencyActivity";
import { PriorityWatchlist } from "./PriorityWatchlist";
import { IntelWatchWorldMap } from "./IntelWatchWorldMap";

export function IntelWatchPanel() {
  return (
    <main
      className="flex flex-1 min-h-0 overflow-hidden gap-2.5 p-2.5"
      style={{ background: "var(--c-bg-base)" }}
    >
      {/* LEFT — Map */}
      <div
        className="flex flex-col flex-1 min-h-0 min-w-0"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--c-border-1)",
          borderRadius: "10px",
          boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center gap-2 flex-shrink-0 px-3.5 py-2"
          style={{ borderBottom: "1px solid var(--c-border-2)" }}
        >
          <Radar size={12} style={{ color: "var(--c-silver-dim)" }} />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--c-t4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Intel Watch Map
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <IntelWatchWorldMap />
        </div>
      </div>

      {/* RIGHT — Stacked side column */}
      <div
        className="flex flex-col gap-2.5 flex-shrink-0 min-h-0"
        style={{ width: 268 }}
      >
        <div className="min-h-0" style={{ flex: "1 1 0%" }}>
          <AgencyActivity />
        </div>
        <div className="min-h-0" style={{ flex: "1 1 0%" }}>
          <PriorityWatchlist />
        </div>
      </div>
    </main>
  );
}
