"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plane } from "lucide-react";
import { MapControls } from "@/components/map/MapControls";
import {
  AirTrackGlobe,
  type AirTrackGlobeHandle,
} from "@/components/airtrack/AirTrackGlobe";
import { AirTrackContactCard } from "@/components/airtrack/AirTrackContactCard";
import { AirTrackListPanel } from "@/components/airtrack/AirTrackListPanel";
import {
  useAirTrackFeed,
  type AirTrackRegion,
} from "@/components/airtrack/useAirTrackFeed";
import type { AirTrackContact } from "@/types/airtrack";

// The regional fast lane engages once the operator zooms past this level;
// the viewport center is sampled every 2 s and rounded to 0.5° so small
// camera drifts don't restart the poller (the server rounds the same way).
const REGION_MIN_ZOOM = 5;
const REGION_SAMPLE_MS = 2_000;

// ---------------------------------------------------------------------------
// AirTrackScreen — the ECHIS globe centered full-screen (Monitor Home
// framing) with the merged live air picture: military layer from adsb.lol
// plus the global civil background from OpenSky, with CIV / MIL / WL layer
// toggles in the HUD.  Clicking an aircraft opens the enriched contact card
// (registry data, route, photo, Send to Intel Watch).
// ---------------------------------------------------------------------------

const STATUS_META = {
  loading: { label: "CONNECTING", color: "var(--c-t5)" },
  live: { label: "LIVE", color: "#7ddc8f" },
  stale: { label: "STALE", color: "#e8c268" },
  error: { label: "OFFLINE", color: "var(--sev-critical-text, #ff2b3d)" },
} as const;

// Layer visibility — exclusive buckets: watchlist > military > civil.
// Emergency squawks stay visible regardless of toggles.
export type AirTrackLayerToggles = {
  civil: boolean;
  military: boolean;
  watchlist: boolean;
};

function contactBucket(c: AirTrackContact): keyof AirTrackLayerToggles {
  if (c.watchlist) return "watchlist";
  if (c.military) return "military";
  return "civil";
}

const LAYER_TOGGLE_META: Array<{
  key: keyof AirTrackLayerToggles;
  label: string;
}> = [
  { key: "civil", label: "CIV" },
  { key: "military", label: "MIL" },
  { key: "watchlist", label: "WL" },
];

function formatAgo(updatedAt: number | null, nowMs: number): string {
  if (!updatedAt) return "—";
  const sec = Math.max(0, Math.round((nowMs - updatedAt) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m`;
}

export function AirTrackScreen() {
  const globeRef = useRef<AirTrackGlobeHandle | null>(null);
  const [layers, setLayers] = useState<AirTrackLayerToggles>({
    civil: true,
    military: true,
    watchlist: true,
  });
  // Regional fast lane — while zoomed in, the viewport area refreshes every
  // 10 s from adsb.lol point queries on top of the slower global layers.
  const [region, setRegion] = useState<AirTrackRegion | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const view = globeRef.current?.getView();
      if (!view || view.zoom < REGION_MIN_ZOOM) {
        setRegion((current) => (current === null ? current : null));
        return;
      }
      const lat = Math.round(Math.max(-85, Math.min(85, view.lat)) * 2) / 2;
      const lon = Math.round((((view.lon + 540) % 360) - 180) * 2) / 2;
      setRegion((current) =>
        current && current.lat === lat && current.lon === lon
          ? current
          : { lat, lon },
      );
    }, REGION_SAMPLE_MS);
    return () => window.clearInterval(id);
  }, []);

  // Turning the civil layer off also stops the OpenSky polling entirely —
  // the shared credit budget is only spent while the layer is on screen.
  const { contacts, status, civilStatus, updatedAt } = useAirTrackFeed(
    layers.civil,
    region,
  );
  // What the globe and the list actually see, after the layer toggles.
  const visibleContacts = useMemo(
    () => contacts.filter((c) => c.emergency || layers[contactBucket(c)]),
    [contacts, layers],
  );
  // Selection is held as the aircraft hex; the card contact is derived from
  // the current frame so it always shows the freshest data and disappears
  // if the aircraft leaves the feed (or its layer is toggled off).
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      selectedHex
        ? (visibleContacts.find((c) => c.icao24 === selectedHex) ?? null)
        : null,
    [visibleContacts, selectedHex],
  );
  // Re-render the "updated Xs ago" HUD text once per second.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const statusMeta = STATUS_META[status];
  const counts = useMemo(() => {
    let military = 0;
    let civil = 0;
    let watchlist = 0;
    for (const c of contacts) {
      if (c.watchlist) watchlist += 1;
      if (c.military) military += 1;
      else civil += 1;
    }
    return { military, civil, watchlist };
  }, [contacts]);
  const emergencies = useMemo(
    () => contacts.filter((c) => c.emergency),
    [contacts],
  );

  function handlePanelSelect(contact: AirTrackContact) {
    setSelectedHex(contact.icao24);
    globeRef.current?.focusContact(contact.lon, contact.lat);
  }

  return (
    <div className="relative h-full w-full" style={{ background: "var(--c-bg-base)" }}>
      <AirTrackGlobe
        ref={globeRef}
        contacts={visibleContacts}
        selectedId={selected?.icao24 ?? null}
        onSelect={(contact) => setSelectedHex(contact?.icao24 ?? null)}
      />

      {/* HUD — one compact row: identity · counts · status · layer toggles.
          Full source attribution lives in the title tooltip. */}
      <div
        className="absolute flex items-center gap-2.5 rounded-lg"
        title={`Sources: adsb.lol (ODbL)${layers.civil ? " · OpenSky Network" : ""}`}
        style={{
          top: "16px",
          left: "16px",
          zIndex: 16,
          background: "rgba(7,8,10,0.72)",
          border: "1px solid var(--accent-blue-border)",
          boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
          backdropFilter: "blur(14px)",
          padding: "5px 10px",
        }}
      >
        <Plane size={12} strokeWidth={1.7} style={{ color: "#ffc46e" }} />
        <span
          className="uppercase"
          style={{
            fontSize: "9.5px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "var(--c-t2)",
          }}
        >
          Air Track
        </span>
        <span
          style={{
            fontSize: "8.5px",
            letterSpacing: "0.04em",
            color: "var(--c-t5)",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {counts.military} MIL · {counts.civil} CIV · {counts.watchlist} WL ·{" "}
          {formatAgo(updatedAt, nowMs)}
          {layers.civil && civilStatus === "error" ? " · OPENSKY OFFLINE" : ""}
        </span>
        <span
          className="flex items-center gap-1 uppercase"
          style={{
            fontSize: "8px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: statusMeta.color,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: statusMeta.color }}
          />
          {statusMeta.label}
        </span>
        {/* Layer toggles — CIV / MIL / WL, uniform silver */}
        <span
          className="flex items-center gap-1 pl-2"
          style={{ borderLeft: "1px solid var(--border-subtle)" }}
        >
          {LAYER_TOGGLE_META.map(({ key, label }) => {
            const active = layers[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-label={`Toggle ${key} layer`}
                onClick={() =>
                  setLayers((current) => ({ ...current, [key]: !current[key] }))
                }
                className="rounded px-1.5 py-0.5 uppercase"
                style={{
                  fontSize: "8px",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: active ? "var(--c-t3)" : "var(--c-t6)",
                  border: "1px solid var(--border-subtle)",
                  background: active
                    ? "var(--bg-surface-hover)"
                    : "transparent",
                  opacity: active ? 1 : 0.5,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </span>
      </div>

      {/* Emergency chip — quiet glass pill below the HUD; only the dot and
          the EMERGENCY word carry red so it reads as a signal, not an alarm. */}
      {emergencies.length > 0 && (
        <button
          type="button"
          onClick={() => handlePanelSelect(emergencies[0])}
          className="absolute flex items-center gap-1.5 rounded-lg uppercase"
          style={{
            top: "74px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 17,
            background: "rgba(7,8,10,0.72)",
            border: "1px solid var(--border-subtle)",
            backdropFilter: "blur(14px)",
            padding: "4px 10px",
            fontSize: "8.5px",
            fontWeight: 800,
            letterSpacing: "0.09em",
            cursor: "pointer",
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#ff2b3d" }}
          />
          <span style={{ color: "#ff8c96" }}>Emergency</span>
          <span
            style={{
              color: "var(--c-t4)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {emergencies[0].callsign ?? emergencies[0].icao24.toUpperCase()} ·
            SQK {emergencies[0].squawk ?? "—"}
            {emergencies.length > 1 ? ` +${emergencies.length - 1}` : ""}
          </span>
        </button>
      )}

      <AirTrackListPanel
        contacts={visibleContacts}
        selectedId={selected?.icao24 ?? null}
        onSelect={handlePanelSelect}
      />

      {selected && (
        <AirTrackContactCard
          contact={selected}
          onClose={() => setSelectedHex(null)}
        />
      )}

      <MapControls
        onCenterView={() => globeRef.current?.centerView()}
        onZoomIn={() => globeRef.current?.zoomIn()}
        onZoomOut={() => globeRef.current?.zoomOut()}
        panelOffset={0}
      />
    </div>
  );
}
