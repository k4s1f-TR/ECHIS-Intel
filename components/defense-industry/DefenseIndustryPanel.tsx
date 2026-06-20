"use client";
import { useState } from "react";
import { Factory } from "lucide-react";
import { DefenseIndustryMap } from "./DefenseIndustryMap";
import { DefenseIndustryFeedPanel } from "./DefenseIndustryFeedPanel";
import { IndustryContextPanel } from "./IndustryContextPanel";
import { KeySegmentsPanel } from "./KeySegmentsPanel";
import { SupplyChainPressurePanel } from "./SupplyChainPressurePanel";
import { defenseFeedItems } from "@/data/defenseIndustryMockData";

function MapLegend() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0 flex-wrap"
      style={{ borderTop: "1px solid var(--c-border-2)", background: "rgba(4,3,5,0.65)" }}
    >
      <span
        style={{
          fontSize: "var(--fs-xs)",
          fontWeight: 600,
          color: "var(--c-t5)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Static View
      </span>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>•</span>
      <div className="flex items-center gap-1.5">
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "rgba(255,210,31,0.98)",
            boxShadow: "0 0 6px rgba(255,210,31,0.38)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-t4)" }}>Industry Hub</span>
      </div>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>•</span>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-t5)" }}>
        Public-source markers — no live tracking
      </span>
    </div>
  );
}

export function DefenseIndustryPanel() {
  const [selectedItemId, setSelectedItemId] = useState(defenseFeedItems[0].id);

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
                  fontSize: "var(--fs-sm)",
                  fontWeight: 700,
                  color: "var(--c-t4)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Defense Industry Map
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden" style={{ background: "var(--c-bg-deep)" }}>
            <DefenseIndustryMap />
          </div>
          <MapLegend />
        </div>

        {/* Bottom row */}
        <div className="flex gap-2.5 flex-shrink-0" style={{ height: "220px" }}>
          <div className="min-w-0" style={{ flex: "0 0 320px" }}>
            <KeySegmentsPanel />
          </div>
          <div className="flex-1 min-w-0">
            <SupplyChainPressurePanel />
          </div>
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: "1.1 1 0%" }} className="min-h-0">
        <DefenseIndustryFeedPanel selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
      </div>

      {/* RIGHT */}
      <div style={{ flex: "1 1 0%" }} className="min-h-0">
        <IndustryContextPanel selectedItemId={selectedItemId} />
      </div>
    </main>
  );
}
