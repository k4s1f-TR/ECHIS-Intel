"use client";

import { IntelWatchSidebar } from "./IntelWatchSidebar";
import { IntelWatchKpiCards } from "./IntelWatchKpiCards";
import { IntelWatchMap } from "./IntelWatchMap";
import { IntelWatchLiveFeed } from "./IntelWatchLiveFeed";
import { PriorityWatchlist } from "./PriorityWatchlist";
import { RegionalSignals } from "./RegionalSignals";
import { AgencyActivity } from "./AgencyActivity";

export function IntelWatchPanel() {
  return (
    <main
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ background: "rgba(5,7,12,0.99)" }}
    >
      {/* Left filter rail */}
      <IntelWatchSidebar />

      {/* Center: KPIs + Map + Bottom panels */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ minHeight: 0 }}>
        <IntelWatchKpiCards />
        <IntelWatchMap />

        {/* Bottom 3-panel row */}
        <div
          className="flex gap-2 flex-shrink-0"
          style={{ padding: "8px 12px 10px", height: "210px" }}
        >
          <PriorityWatchlist />
          <RegionalSignals />
          <AgencyActivity />
        </div>
      </div>

      {/* Right live feed */}
      <IntelWatchLiveFeed />
    </main>
  );
}
