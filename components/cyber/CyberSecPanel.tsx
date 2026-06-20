"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import { CyberMap } from "./CyberMap";
import { CyberNewsPanel } from "./CyberNewsPanel";
import { ThreatContextPanel } from "./ThreatContextPanel";
import { MostMentionedRegionsPanel } from "./MostMentionedRegionsPanel";
import { AffectedSectorsPanel } from "./AffectedSectorsPanel";
import { cyberNewsItems, cyberHotspots, cyberAttackIndicators } from "@/data/cyberMockData";

/* Severity → heat-ramp dot color (matches map markers/comets) */
const SEV_DOT: Record<string, { col: string; glow: string }> = {
  critical: { col: "#ff3b42", glow: "rgba(255,59,66,0.9)" },
  high: { col: "#ff7a2f", glow: "rgba(255,122,47,0.8)" },
  medium: { col: "#f1c24f", glow: "rgba(241,194,79,0.7)" },
  low: { col: "#9aa3b2", glow: "rgba(154,163,178,0.5)" },
};

/* ─── Header threat meter (THREAT LVL equalizer) ─────────── */
const THREAT_BARS = [6, 9, 13, 8, 11];
function ThreatMeter() {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{ gap: 9, padding: "0 12px", height: "100%", borderLeft: "1px solid var(--c-border-2)" }}
    >
      <span style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-accent-text)" }}>
        Threat Lvl
      </span>
      <span className="flex items-end" style={{ gap: 2, height: 13 }}>
        {THREAT_BARS.map((h, i) => (
          <i key={i} style={{ width: 3, height: h, borderRadius: 1, background: "var(--c-accent)", opacity: 0.55 + (h / 13) * 0.45, display: "block" }} />
        ))}
      </span>
    </div>
  );
}

/* ─── Ticker ─────────────────────────────────────────────── */
function Ticker() {
  // Duplicate the list so translateX(-50%) loops seamlessly.
  const items = [...cyberNewsItems, ...cyberNewsItems];
  return (
    <div className="cyber-ticker">
      <div className="cyber-ticker-tag">
        <span className="dot" />
        Live Feed
      </div>
      <div className="cyber-ticker-viewport">
        <div className="cyber-ticker-track">
          {items.map((n, i) => {
            const sev = SEV_DOT[n.severityLevel] ?? SEV_DOT.low;
            return (
              <span key={`${n.id}-${i}`} className="inline-flex items-center gap-2" style={{ fontSize: "var(--c-fs-sm)", color: "var(--c-t4)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sev.col, boxShadow: `0 0 6px ${sev.glow}`, flexShrink: 0 }} />
                <b style={{ color: "var(--c-t2)", fontWeight: 600 }}>{n.source}</b>
                <span>{n.summary}</span>
                <span className="c-mono" style={{ color: "var(--c-t6)", fontSize: "var(--c-fs-2xs)" }}>{n.timeAgo}</span>
                <span style={{ color: "var(--c-t6)", marginLeft: 4 }}>•</span>
              </span>
            );
          })}
        </div>
      </div>
      <ThreatMeter />
    </div>
  );
}

/* ─── Map info strip (bottom of map panel) ───────────────── */
function MapInfoStrip() {
  return (
    <div
      className="flex items-center gap-[10px] flex-shrink-0 flex-wrap"
      style={{ padding: "9px 15px", borderTop: "1px solid var(--c-border-2)", background: "rgba(4,3,5,0.65)" }}
    >
      <div className="flex items-center gap-[6px]">
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-accent)", boxShadow: "0 0 7px var(--c-accent-glow)" }} />
        <span style={{ fontSize: "var(--c-fs-xs)", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-t5)" }}>Session IP</span>
        <span className="c-mono" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 500, color: "var(--c-t3)" }}>185.234.219.102</span>
      </div>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>Istanbul, Türkiye</span>
      <span
        className="c-disp"
        style={{ padding: "2.5px 7px", borderRadius: "var(--c-radius-xs)", fontSize: "var(--c-fs-2xs)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-elev)", background: "var(--c-elev-bg)", border: "1px solid var(--c-elev-border)" }}
      >
        ISP
      </span>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>Türk Telekom</span>
      <div className="flex-1" />
      <div className="flex items-center gap-[6px]">
        <span style={{ fontSize: "var(--c-fs-xs)", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-t5)" }}>Active Arcs</span>
        <span className="c-mono" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 500, color: "var(--c-accent-text)" }}>{cyberAttackIndicators.length}</span>
      </div>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>·</span>
      <div className="flex items-center gap-[6px]">
        <span style={{ fontSize: "var(--c-fs-xs)", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-t5)" }}>Hotspots</span>
        <span className="c-mono" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 500, color: "var(--c-t3)" }}>{cyberHotspots.length}</span>
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────── */
export function CyberSecPanel() {
  const [selectedNewsId, setSelectedNewsId] = useState(cyberNewsItems[0].id);

  return (
    <div className="cyber-premium flex flex-1 min-h-0 flex-col overflow-hidden">
      <Ticker />

      <main className="flex flex-1 min-h-0 overflow-hidden" style={{ gap: 10, padding: 10 }}>
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col min-h-0 min-w-0" style={{ flex: "2 1 0%", gap: 10 }}>
          {/* Global Threat Map */}
          <div className="cyber-panel flex-1">
            <div className="cyber-panel-head">
              <div className="flex items-center gap-[9px]">
                <Shield size={15} style={{ color: "var(--c-silver-dim)" }} />
                <span className="cyber-panel-title">Global Threat Map</span>
              </div>
              <div className="cyber-live-pill">
                <span className="dot" />
                Live
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <CyberMap />
            </div>
            <MapInfoStrip />
          </div>

          {/* Bottom row: Regions (fixed) + Sectors (flex) */}
          <div className="flex flex-shrink-0 min-w-0" style={{ height: 264, gap: 10 }}>
            <div className="min-w-0" style={{ flex: "0 0 304px" }}>
              <MostMentionedRegionsPanel />
            </div>
            <div className="flex-1 min-w-0">
              <AffectedSectorsPanel />
            </div>
          </div>
        </div>

        {/* ── CENTER COLUMN ── */}
        <div className="min-h-0 min-w-0" style={{ flex: "1.15 1 0%" }}>
          <CyberNewsPanel selectedNewsId={selectedNewsId} onSelectNews={setSelectedNewsId} />
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="min-h-0 min-w-0" style={{ flex: "1 1 0%" }}>
          <ThreatContextPanel selectedNewsId={selectedNewsId} />
        </div>
      </main>
    </div>
  );
}
