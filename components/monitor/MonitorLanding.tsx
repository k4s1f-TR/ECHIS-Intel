"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUpRight, Globe2, Plane, Radio } from "lucide-react";
import {
  EchisGlobe,
  type EchisGlobeHandle,
  type GlobeMarker,
} from "@/components/map/EchisGlobe";

/**
 * MonitorLanding (design "2A" — Refined Theatre).
 *
 * Self-contained welcome screen: it hosts the hero globe itself and wires the
 * Priority-watch rows + "Open Globe View" button to the globe via an internal
 * ref. Drop it into a full-bleed container (position: relative; the component
 * fills it). All chrome is inline-styled so no globals.css additions are needed.
 */

export type MonitorLandingProps = {
  onGlobalView?: () => void;
  onSocmint?: () => void;
  onAirTrack?: () => void;
};

const WATCH_REGIONS: GlobeMarker[] = [
  { id: "eastern-europe", label: "Eastern Europe", detail: "ELEVATED · 12 SIGNALS", level: "high", lng: 31, lat: 49 },
  { id: "levant", label: "Levant", detail: "CRITICAL · 31 SIGNALS", level: "critical", lng: 35, lat: 32 },
  { id: "red-sea", label: "Red Sea", detail: "ELEVATED · 8 SIGNALS", level: "high", lng: 40, lat: 18 },
];

type SignalZone = {
  id: string;
  weight: number;
  jitter: [lng: number, lat: number];
  anchors: Array<[lng: number, lat: number]>;
};

const SIGNAL_BATCH_INTERVAL_MS = 6_800;
const SIGNAL_COUNT_MIN = 8;
const SIGNAL_COUNT_MAX = 13;

// Each batch starts with one signal per macro-region. Remaining signals follow
// these weights, keeping the ambient field globally spread without placing an
// equal (and visually misleading) number in every geography.
const SIGNAL_ZONES: SignalZone[] = [
  {
    id: "north-america",
    weight: 0.15,
    jitter: [7, 4],
    anchors: [[-123, 49], [-105, 39], [-87, 42], [-74, 41], [-99, 20]],
  },
  {
    id: "latin-america",
    weight: 0.11,
    jitter: [6, 4],
    anchors: [[-74, 5], [-77, -12], [-47, -23], [-70, -33], [-58, -34]],
  },
  {
    id: "europe",
    weight: 0.18,
    jitter: [5, 3],
    anchors: [[-3, 52], [10, 51], [20, 45], [30, 50], [18, 60]],
  },
  {
    id: "africa",
    weight: 0.17,
    jitter: [6, 4],
    anchors: [[-7, 31], [-1, 7], [20, 1], [36, 9], [28, -26]],
  },
  {
    id: "asia",
    weight: 0.33,
    jitter: [6, 4],
    anchors: [[43, 25], [67, 42], [78, 22], [105, 35], [121, 31], [106, 10], [139, 36]],
  },
  {
    id: "oceania",
    weight: 0.06,
    jitter: [6, 4],
    anchors: [[116, -32], [135, -25], [151, -33], [174, -41], [147, -7]],
  },
];

function createSignalBatch(batchIndex: number, startedAtMs: number): GlobeMarker[] {
  const count = SIGNAL_COUNT_MIN +
    Math.floor(Math.random() * (SIGNAL_COUNT_MAX - SIGNAL_COUNT_MIN + 1));
  const allocations = new Map(SIGNAL_ZONES.map((zone) => [zone.id, 1]));

  for (let index = SIGNAL_ZONES.length; index < count; index += 1) {
    const roll = Math.random();
    let cumulativeWeight = 0;
    const zone = SIGNAL_ZONES.find((candidate) => {
      cumulativeWeight += candidate.weight;
      return roll <= cumulativeWeight;
    }) ?? SIGNAL_ZONES[SIGNAL_ZONES.length - 1];
    allocations.set(zone.id, (allocations.get(zone.id) ?? 0) + 1);
  }

  const signals: GlobeMarker[] = [];
  SIGNAL_ZONES.forEach((zone) => {
    const zoneCount = allocations.get(zone.id) ?? 0;
    for (let index = 0; index < zoneCount; index += 1) {
      const anchor = zone.anchors[Math.floor(Math.random() * zone.anchors.length)];
      const lng = anchor[0] + (Math.random() * 2 - 1) * zone.jitter[0];
      const lat = anchor[1] + (Math.random() * 2 - 1) * zone.jitter[1];
      const levelRoll = Math.random();
      const level: GlobeMarker["level"] = levelRoll < 0.04
        ? "critical"
        : levelRoll < 0.18
          ? "high"
          : levelRoll < 0.55
            ? "medium"
            : "low";

      signals.push({
        id: `ambient-${batchIndex}-${zone.id}-${index}`,
        lng,
        lat: Math.max(-58, Math.min(72, lat)),
        level,
        pulseStartedAtMs: startedAtMs + 120 + Math.random() * 2_080,
        pulseDurationMs: 3_600 + Math.random() * 900,
        pulseScale: 0.7 + Math.random() * 0.16,
      });
    }
  });

  return signals;
}

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";
const DISPLAY = "var(--font-display, 'Space Grotesk', sans-serif)";
const BODY = "var(--font-ui, 'Hanken Grotesk', sans-serif)";

export const MonitorLanding = forwardRef<EchisGlobeHandle, MonitorLandingProps>(
  function MonitorLanding({ onGlobalView, onSocmint, onAirTrack }, ref) {
  const globeRef = useRef<EchisGlobeHandle>(null);
  const [ambientSignals, setAmbientSignals] = useState<GlobeMarker[]>([]);

  useEffect(() => {
    let batchIndex = 0;
    const refreshSignals = () => {
      setAmbientSignals(createSignalBatch(batchIndex, performance.now()));
      batchIndex += 1;
    };

    refreshSignals();
    const intervalId = window.setInterval(refreshSignals, SIGNAL_BATCH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  // Expose the internal globe handle so AppShell's homeGlobeRef keeps working.
  useImperativeHandle(ref, () => ({
    zoomIn: () => globeRef.current?.zoomIn(),
    zoomOut: () => globeRef.current?.zoomOut(),
    centerView: () => globeRef.current?.centerView(),
    focusMarker: (lng, lat) => globeRef.current?.focusMarker(lng, lat),
    projectMarker: (lng, lat) => globeRef.current?.projectMarker(lng, lat) ?? null,
    setAutoRotatePaused: (paused) => globeRef.current?.setAutoRotatePaused(paused),
  }), []);

  const bracket = (corner: "tl" | "tr" | "bl" | "br"): React.CSSProperties => {
    const v = corner[0] === "t" ? { top: 15 } : { bottom: 15 };
    const h = corner[1] === "l" ? { left: 15 } : { right: 15 };
    const c = "1px solid rgba(255,64,78,.4)";
    return {
      position: "absolute",
      width: 20,
      height: 20,
      zIndex: 5,
      ...v,
      ...h,
      borderTop: corner[0] === "t" ? c : undefined,
      borderBottom: corner[0] === "b" ? c : undefined,
      borderLeft: corner[1] === "l" ? c : undefined,
      borderRight: corner[1] === "r" ? c : undefined,
    };
  };

  const quietButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 9,
    fontFamily: BODY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".05em",
    whiteSpace: "nowrap",
    color: "rgba(199,204,213,.78)",
    background: "rgba(255,255,255,.025)",
    border: "1px solid rgba(255,255,255,.08)",
    cursor: "pointer",
  };

  return (
    <div
      aria-label="ECHIS monitor overview"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        fontFamily: BODY,
        background:
          "radial-gradient(ellipse at 50% 56%,rgba(48,11,16,.3),transparent 46%),radial-gradient(ellipse at 50% 50%,#0b0c0f 0%,#08080b 52%,#040405 100%)",
      }}
    >
      {/* Hero globe */}
      <EchisGlobe
        ref={globeRef}
        size="hero"
        markers={ambientSignals}
        showLabels={false}
        showMarkerCore={false}
      />

      {/* Depth vignette above globe, below chrome */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 54%,transparent 42%,rgba(3,2,3,.62) 100%),linear-gradient(180deg,rgba(5,4,6,.58),transparent 22%,transparent 76%,rgba(4,3,4,.74))",
        }}
      />

      {/* Corner brackets */}
      <span style={bracket("tl")} />
      <span style={bracket("tr")} />
      <span style={bracket("bl")} />
      <span style={bracket("br")} />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 34,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 13,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 15,
              height: 15,
              borderRadius: 4,
              background: "linear-gradient(135deg,#b3121f,#ff2b3d)",
              boxShadow: "0 0 14px rgba(236,47,59,.5),inset 0 1px 0 rgba(255,255,255,.3)",
            }}
          />
          <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, letterSpacing: ".14em", color: "rgba(238,240,244,.96)" }}>
            ECHIS
          </span>
          <span style={{ width: 1, height: 13, background: "rgba(255,255,255,.1)" }} />
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: ".22em", color: "rgba(132,142,156,.64)" }}>
            MONITOR
          </span>
        </div>
        <h1
          style={{
            margin: "2px 0 0",
            fontFamily: DISPLAY,
            fontSize: 38,
            fontWeight: 520,
            lineHeight: 1,
            letterSpacing: "-.04em",
            color: "rgba(239,241,244,.97)",
            textShadow: "0 2px 28px rgba(0,0,0,.9),0 0 60px rgba(0,0,0,.6)",
          }}
        >
          Global awareness, <span style={{ color: "rgba(143,149,159,.62)", fontWeight: 430 }}>distilled.</span>
        </h1>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            fontWeight: 600,
            letterSpacing: ".24em",
            textTransform: "uppercase",
            color: "rgba(150,158,170,.56)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textShadow: "0 1px 16px rgba(0,0,0,.9)",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#ef394a",
              boxShadow: "0 0 12px rgba(239,57,74,.5)",
            }}
          />
          Strategic intelligence environment · Global coverage
        </div>
      </div>

      {/* Priority watch — bottom left */}
      <div style={{ position: "absolute", left: 34, bottom: 34, zIndex: 6, display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 7.5,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: "rgba(119,127,139,.55)",
            marginBottom: 10,
            paddingLeft: 4,
          }}
        >
          Priority watch
        </div>
        {WATCH_REGIONS.map((region) => (
          <button
            type="button"
            key={region.id}
            onClick={() => globeRef.current?.focusMarker(region.lng, region.lat)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              width: 188,
              padding: "8px 6px",
              border: 0,
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              borderRadius: 7,
            }}
          >
            <span
              style={{
                width: 3,
                height: 22,
                borderRadius: 3,
                background: region.level === "critical" ? "#ef3d4f" : "#c8752e",
                boxShadow:
                  region.level === "critical" ? "0 0 10px rgba(239,61,79,.45)" : "0 0 8px rgba(242,115,28,.3)",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <strong style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: "rgba(214,218,224,.84)" }}>
                {region.label}
              </strong>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 7.5,
                  letterSpacing: ".12em",
                  color: region.level === "critical" ? "rgba(235,72,72,.85)" : "rgba(200,117,46,.82)",
                }}
              >
                {region.level === "critical" ? "CRITICAL" : "ELEVATED"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Side rails */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
          zIndex: 5,
          fontFamily: MONO,
          fontSize: 7.5,
          letterSpacing: ".28em",
          color: "rgba(96,104,115,.4)",
          whiteSpace: "nowrap",
        }}
      >
        GLOBE MODE · AUTO-ROTATE
      </div>
      <div
        style={{
          position: "absolute",
          right: 20,
          top: "50%",
          transform: "translateY(-50%) rotate(90deg)",
          zIndex: 5,
          fontFamily: MONO,
          fontSize: 7.5,
          letterSpacing: ".28em",
          color: "rgba(96,104,115,.4)",
          whiteSpace: "nowrap",
        }}
      >
        SECURE · GLOBAL COVERAGE
      </div>

      {/* Glass dock — bottom center */}
      <div
        style={{
          position: "absolute",
          bottom: 34,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 7,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "13px 15px",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 15,
          background: "linear-gradient(180deg,rgba(20,17,20,.72),rgba(8,7,9,.8))",
          backdropFilter: "blur(20px) saturate(120%)",
          boxShadow: "0 24px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            globeRef.current?.centerView();
            onGlobalView?.();
          }}
          style={{
            height: 40,
            minWidth: 172,
            whiteSpace: "nowrap",
            padding: "0 15px",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            borderRadius: 9,
            fontFamily: BODY,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".05em",
            color: "rgba(255,238,240,.98)",
            background: "linear-gradient(135deg,rgba(124,15,29,.98),rgba(214,34,51,.95))",
            border: "1px solid rgba(255,98,111,.34)",
            boxShadow: "0 10px 28px rgba(112,8,22,.34),inset 0 1px 0 rgba(255,255,255,.16)",
            cursor: "pointer",
          }}
        >
          <Globe2 size={15} />
          Open Globe View
          <ArrowUpRight size={14} style={{ marginLeft: "auto", opacity: 0.7 }} />
        </button>
        <button type="button" onClick={onSocmint} style={quietButton}>
          <Radio size={14} />
          SOCMINT
        </button>
        <button type="button" onClick={onAirTrack} style={quietButton}>
          <Plane size={14} />
          Air Track
        </button>
        <span style={{ width: 1, height: 26, background: "rgba(255,255,255,.1)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", color: "rgba(150,158,170,.62)" }}>
            07 REGIONS · 1,284 SIGNALS/24H · 63 SOURCES
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 7, letterSpacing: ".14em", color: "rgba(120,128,140,.55)" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#b0b8c4", boxShadow: "0 0 8px rgba(176,184,196,.5)" }} />
            SECURE SESSION
          </span>
        </div>
      </div>
    </div>
  );
});
