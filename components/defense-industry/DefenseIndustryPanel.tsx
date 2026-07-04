"use client";
import { useState } from "react";
import { Factory } from "lucide-react";
import {
  DefenseIndustryMap,
  activeDefenseHighlightRoles,
  DEFENSE_ROLE_LABEL,
  DEFENSE_ROLE_SWATCH,
} from "./DefenseIndustryMap";
import { DefenseIndustryFeedPanel } from "./DefenseIndustryFeedPanel";
import { IndustryContextPanel } from "./IndustryContextPanel";
import { KeySegmentsPanel } from "./KeySegmentsPanel";
import { SupplyChainPressurePanel } from "./SupplyChainPressurePanel";
import { useDefenseIndustryFeed } from "./useDefenseIndustryFeed";
import type { DefenseFeedItemLive } from "@/lib/defense";

function MapLegend({ items }: { items: DefenseFeedItemLive[] }) {
  const legendRoles = activeDefenseHighlightRoles(items);
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0 flex-wrap"
      style={{ borderTop: "1px solid var(--c-border-2)", background: "rgba(4,3,5,0.65)" }}
    >
      {legendRoles.map((role) => (
        <div key={role} className="flex items-center gap-1.5">
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              background: DEFENSE_ROLE_SWATCH[role],
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-t4)" }}>
            {DEFENSE_ROLE_LABEL[role]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DefenseIndustryPanel() {
  const feed = useDefenseIndustryFeed();
  const hasError = Boolean(feed.error);

  const [requestedId, setRequestedId] = useState("");
  const selectedItemId = feed.items.some((i) => i.id === requestedId)
    ? requestedId
    : (feed.items[0]?.id ?? "");

  return (
    <main
      className="flex flex-1 min-h-0 overflow-hidden gap-2.5 p-2.5"
      style={{ background: "var(--c-bg-base)" }}
    >
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-2.5" style={{ flex: "2 1 0%" }}>
        {/* Map */}
        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--c-border-1)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <div
            className="flex items-center justify-between flex-shrink-0 px-3.5 py-2"
            style={{ borderBottom: "1px solid var(--c-border-2)" }}
          >
            <div className="flex items-center gap-2">
              <Factory size={12} style={{ color: "var(--c-silver-dim)" }} />
              <span
                style={{
                  fontFamily: "var(--font-disp)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: 600,
                  color: "var(--c-t4)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Defense Industry Map
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden" style={{ background: "var(--c-bg-deep)" }}>
            <DefenseIndustryMap items={feed.items} />
          </div>
          <MapLegend items={feed.items} />
        </div>

        {/* Bottom row */}
        <div className="flex gap-2.5 flex-shrink-0" style={{ height: "220px" }}>
          <div className="min-w-0" style={{ flex: "0 0 320px" }}>
            <KeySegmentsPanel segments={feed.segments} isLoading={feed.isLoading} />
          </div>
          <div className="flex-1 min-w-0">
            <SupplyChainPressurePanel rows={feed.supplyChain} isLoading={feed.isLoading} />
          </div>
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: "1.1 1 0%" }} className="min-h-0">
        <DefenseIndustryFeedPanel
          selectedItemId={selectedItemId}
          onSelectItem={setRequestedId}
          items={feed.items}
          isLoading={feed.isLoading}
          hasError={hasError}
        />
      </div>

      {/* RIGHT */}
      <div style={{ flex: "1 1 0%" }} className="min-h-0">
        <IndustryContextPanel selectedItemId={selectedItemId} items={feed.items} />
      </div>
    </main>
  );
}
