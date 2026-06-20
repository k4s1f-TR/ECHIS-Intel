"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { CyberMap } from "./CyberMap";
import { CyberNewsPanel } from "./CyberNewsPanel";
import { ThreatContextPanel } from "./ThreatContextPanel";
import { MostMentionedRegionsPanel } from "./MostMentionedRegionsPanel";
import { AffectedSectorsPanel } from "./AffectedSectorsPanel";
import {
  cyberAttackIndicators,
  cyberHotspots,
  cyberNewsItems,
} from "@/data/cyberMockData";

function MapInfoStrip() {
  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center gap-[10px]"
      style={{
        padding: "9px 15px",
        borderTop: "1px solid var(--c-border-2)",
        background: "rgba(4,3,5,0.65)",
      }}
    >
      <div className="flex items-center gap-[6px]">
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--c-accent)",
            boxShadow: "0 0 7px var(--c-accent-glow)",
          }}
        />
        <span
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--c-t5)",
          }}
        >
          Session IP
        </span>
        <span
          className="c-mono"
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 500,
            color: "var(--c-t3)",
          }}
        >
          185.234.219.102
        </span>
      </div>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>
        Istanbul, Turkiye
      </span>
      <span
        className="c-disp"
        style={{
          padding: "2.5px 7px",
          borderRadius: "var(--c-radius-xs)",
          fontSize: "var(--c-fs-2xs)",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--c-elev)",
          background: "var(--c-elev-bg)",
          border: "1px solid var(--c-elev-border)",
        }}
      >
        ISP
      </span>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>
        Turk Telekom
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-[6px]">
        <span
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--c-t5)",
          }}
        >
          Active Arcs
        </span>
        <span
          className="c-mono"
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 500,
            color: "var(--c-accent-text)",
          }}
        >
          {cyberAttackIndicators.length}
        </span>
      </div>
      <span style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t4)" }}>
        -
      </span>
      <div className="flex items-center gap-[6px]">
        <span
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--c-t5)",
          }}
        >
          Hotspots
        </span>
        <span
          className="c-mono"
          style={{
            fontSize: "var(--c-fs-xs)",
            fontWeight: 500,
            color: "var(--c-t3)",
          }}
        >
          {cyberHotspots.length}
        </span>
      </div>
    </div>
  );
}

export function CyberSecPanel() {
  const [selectedNewsId, setSelectedNewsId] = useState(cyberNewsItems[0].id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <main
        className="flex min-h-0 flex-1 overflow-hidden"
        style={{ gap: 10, padding: 10 }}
      >
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{ flex: "2 1 0%", gap: 10 }}
        >
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
            <div className="min-h-0 flex-1">
              <CyberMap />
            </div>
            <MapInfoStrip />
          </div>

          <div
            className="flex min-w-0 flex-shrink-0"
            style={{ height: 264, gap: 10 }}
          >
            <div className="min-w-0" style={{ flex: "0 0 304px" }}>
              <MostMentionedRegionsPanel />
            </div>
            <div className="min-w-0 flex-1">
              <AffectedSectorsPanel />
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0" style={{ flex: "1.15 1 0%" }}>
          <CyberNewsPanel
            selectedNewsId={selectedNewsId}
            onSelectNews={setSelectedNewsId}
          />
        </div>

        <div className="min-h-0 min-w-0" style={{ flex: "1 1 0%" }}>
          <ThreatContextPanel selectedNewsId={selectedNewsId} />
        </div>
      </main>
    </div>
  );
}
