"use client";

import { useState } from "react";
import { IntelWatchMap } from "./IntelWatchMap";
import { IntelWatchLiveFeed } from "./IntelWatchLiveFeed";
import { PriorityWatchlist } from "./PriorityWatchlist";
import { AgencyActivity } from "./AgencyActivity";
import { AgencyActivityDrawer } from "./drawers/AgencyActivityDrawer";
import { LiveFeedDrawer } from "./drawers/LiveFeedDrawer";
import { PriorityWatchlistDrawer } from "./drawers/PriorityWatchlistDrawer";

type DrawerKey = "agency" | "feed" | "watchlist";

export function IntelWatchPanel() {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);

  function openDrawer(key: DrawerKey) {
    setActiveDrawer(key);
  }

  function closeDrawer() {
    setActiveDrawer(null);
  }

  return (
    <main
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ background: "rgba(5,7,12,0.99)" }}
    >
      {/* Center column — map fills top, bottom 2-panel row sits below */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ overflow: "hidden", padding: "12px 0 12px 12px" }}
      >
        {/* Map + bottom panels */}
        <div
          className="flex flex-col"
          style={{
            flex: "1 1 0",
            minHeight: 0,
            paddingRight: "12px",
            gap: "12px",
            overflow: "hidden",
          }}
        >
          {/* Map — fills all remaining vertical space */}
          <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
            <IntelWatchMap />
          </div>

          {/* Bottom 2-panel row */}
          <div
            style={{
              flexShrink: 0,
              height: "248px",
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <PriorityWatchlist onOpenDrawer={() => openDrawer("watchlist")} />
            <AgencyActivity onOpenDrawer={() => openDrawer("agency")} />
          </div>
        </div>
      </div>

      {/* Right live feed — relative container is the drawer anchor */}
      <div style={{ padding: "12px 12px 12px 8px", flexShrink: 0, display: "flex" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <IntelWatchLiveFeed onOpenDrawer={() => openDrawer("feed")} />

          {/* All three drawers always mounted — open prop drives animation */}
          <AgencyActivityDrawer
            open={activeDrawer === "agency"}
            onClose={closeDrawer}
          />
          <LiveFeedDrawer
            open={activeDrawer === "feed"}
            onClose={closeDrawer}
          />
          <PriorityWatchlistDrawer
            open={activeDrawer === "watchlist"}
            onClose={closeDrawer}
          />
        </div>
      </div>
    </main>
  );
}
