"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import { CyberMap } from "./CyberMap";
import { CyberNewsPanel } from "./CyberNewsPanel";
import { ThreatContextPanel } from "./ThreatContextPanel";
import { MostMentionedRegionsPanel } from "./MostMentionedRegionsPanel";
import { AffectedSectorsPanel } from "./AffectedSectorsPanel";
import { cyberNewsItems } from "@/data/cyberMockData";

/* ─── Map Info Strip (bottom of map panel) ───────────────────── */
function MapInfoStrip() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0 flex-wrap"
      style={{ borderTop: "1px solid var(--border-dim)", background: "var(--bg-info-strip)" }}
    >
      {/* Session IP */}
      <div className="flex items-center gap-1.5">
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-green-dot)", flexShrink: 0 }} />
        <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>Session IP</span>
        <span style={{ fontSize: "var(--fs-xs)", fontWeight: 500, color: "var(--text-body)", fontVariantNumeric: "tabular-nums" }}>185.234.219.102</span>
      </div>
      {/* Location */}
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>Istanbul, Türkiye</span>
      {/* ISP badge */}
      <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "var(--fs-2xs)", fontWeight: 600, color: "var(--accent-green)", background: "var(--accent-green-bg)", border: "1px solid var(--accent-green-border)" }}>ISP</span>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>Türk Telekom</span>
    </div>
  );
}


/* ─── Main Export ─────────────────────────────────────────────── */
export function CyberSecPanel() {
  const [selectedNewsId, setSelectedNewsId] = useState(cyberNewsItems[0].id);

  return (
    <main className="flex flex-1 min-h-0 overflow-hidden gap-2.5 p-2.5" style={{ background: "var(--bg-base)" }}>
      {/* ── LEFT COLUMN ─────────────────────────── */}
      <div className="flex flex-col gap-2.5" style={{ flex: "2 1 0%" }}>
        {/* CYBER THREAT MAP */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {/* Map header */}
          <div className="flex items-center justify-between flex-shrink-0 px-3.5 py-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
            <div className="flex items-center gap-2">
              <Shield size={12} style={{ color: "var(--accent-green-dim)" }} />
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Cyber Threat Map</span>
            </div>
          </div>
          {/* Map canvas */}
          <div className="flex-1 min-h-0">
            <CyberMap />
          </div>
          {/* Info strip */}
          <MapInfoStrip />
        </div>

        {/* BOTTOM ROW: most mentioned regions (left) + empty panel (right) */}
        <div className="flex gap-2.5 flex-shrink-0" style={{ height: "220px" }}>
          {/* Most mentioned regions – narrower */}
          <div className="min-w-0" style={{ flex: "0 0 280px" }}>
            <MostMentionedRegionsPanel />
          </div>
          {/* Affected Sectors / Exposure panel – wider */}
          <div className="flex-1 min-w-0">
            <AffectedSectorsPanel />
          </div>
        </div>
      </div>

      {/* ── CENTER COLUMN ───────────────────────── */}
      <div style={{ flex: "1.1 1 0%" }} className="min-h-0">
        <CyberNewsPanel selectedNewsId={selectedNewsId} onSelectNews={setSelectedNewsId} />
      </div>

      {/* ── RIGHT COLUMN ────────────────────────── */}
      <div style={{ flex: "1 1 0%" }} className="min-h-0">
        <ThreatContextPanel selectedNewsId={selectedNewsId} />
      </div>
    </main>
  );
}
