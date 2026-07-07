"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, X } from "lucide-react";
import { MapControls } from "@/components/map/MapControls";
import {
  AirTrackGlobe,
  type AirTrackGlobeHandle,
} from "@/components/airtrack/AirTrackGlobe";
import { useAirTrackFeed } from "@/components/airtrack/useAirTrackFeed";
import type { AirTrackContact } from "@/types/airtrack";

// ---------------------------------------------------------------------------
// AirTrackScreen — MVP: the ECHIS globe centered full-screen (Monitor Home
// framing) with the live military air-activity layer from adsb.lol.  A small
// HUD pill reports layer status; clicking an aircraft opens a compact
// contact card.  Civil global layer (OpenSky) and watchlists come in later
// phases per docs/AIR-TRACK-PROVIDERS.md.
// ---------------------------------------------------------------------------

const STATUS_META = {
  loading: { label: "CONNECTING", color: "var(--c-t5)" },
  live: { label: "LIVE", color: "#7ddc8f" },
  stale: { label: "STALE", color: "#e8c268" },
  error: { label: "OFFLINE", color: "var(--sev-critical-text, #ff2b3d)" },
} as const;

function formatAgo(updatedAt: number | null, nowMs: number): string {
  if (!updatedAt) return "—";
  const sec = Math.max(0, Math.round((nowMs - updatedAt) / 1000));
  return sec < 60 ? `${sec}s ago` : `${Math.floor(sec / 60)}m ago`;
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className="uppercase"
        style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--c-t5)" }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "11.5px",
          color: "var(--c-t2)",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ContactCard({
  contact,
  onClose,
}: {
  contact: AirTrackContact;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute rounded-lg"
      style={{
        top: "64px",
        right: "14px",
        width: "228px",
        zIndex: 16,
        background: "rgba(7,8,10,0.82)",
        border: "1px solid var(--accent-blue-border)",
        boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
        backdropFilter: "blur(14px)",
        padding: "12px 14px",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="uppercase"
          style={{
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "#ffd9ac",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
          }}
        >
          {contact.callsign ?? contact.icao24.toUpperCase()}
        </span>
        <button
          type="button"
          aria-label="Close contact card"
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ color: "var(--c-t5)", cursor: "pointer" }}
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <ContactRow label="Hex" value={contact.icao24.toUpperCase()} />
        <ContactRow label="Reg" value={contact.registration ?? "—"} />
        <ContactRow label="Type" value={contact.typeCode ?? "—"} />
        <ContactRow
          label="Altitude"
          value={
            contact.onGround
              ? "GROUND"
              : contact.altitudeFt !== null
                ? `${contact.altitudeFt.toLocaleString("en-US")} ft`
                : "—"
          }
        />
        <ContactRow
          label="Speed"
          value={
            contact.groundSpeedKt !== null ? `${contact.groundSpeedKt} kt` : "—"
          }
        />
        <ContactRow
          label="Track"
          value={contact.track !== null ? `${Math.round(contact.track)}°` : "—"}
        />
        <ContactRow label="Squawk" value={contact.squawk ?? "—"} />
      </div>
      <div
        className="mt-2.5 pt-2 uppercase"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "8.5px",
          letterSpacing: "0.09em",
          color: "var(--c-t6)",
        }}
      >
        Military-flagged · adsb.lol
      </div>
    </div>
  );
}

export function AirTrackScreen() {
  const globeRef = useRef<AirTrackGlobeHandle | null>(null);
  const { contacts, status, updatedAt } = useAirTrackFeed();
  // Selection is held as the aircraft hex; the card contact is derived from
  // the current frame so it always shows the freshest data and disappears
  // if the aircraft leaves the feed.
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      selectedHex
        ? (contacts.find((c) => c.icao24 === selectedHex) ?? null)
        : null,
    [contacts, selectedHex],
  );
  // Re-render the "updated Xs ago" HUD text once per second.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const statusMeta = STATUS_META[status];

  return (
    <div className="relative h-full w-full" style={{ background: "var(--c-bg-base)" }}>
      <AirTrackGlobe
        ref={globeRef}
        contacts={contacts}
        selectedId={selected?.icao24 ?? null}
        onSelect={(contact) => setSelectedHex(contact?.icao24 ?? null)}
      />

      {/* HUD — layer identity + live status */}
      <div
        className="absolute flex items-center gap-3 rounded-lg"
        style={{
          top: "16px",
          left: "16px",
          zIndex: 16,
          background: "rgba(7,8,10,0.72)",
          border: "1px solid var(--accent-blue-border)",
          boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
          backdropFilter: "blur(14px)",
          padding: "8px 12px",
        }}
      >
        <Plane size={13} strokeWidth={1.7} style={{ color: "#ffc46e" }} />
        <div className="flex flex-col">
          <span
            className="uppercase"
            style={{
              fontSize: "10.5px",
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "var(--c-t2)",
            }}
          >
            Air Track — Military Air Activity
          </span>
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.05em",
              color: "var(--c-t5)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {contacts.length} aircraft · updated {formatAgo(updatedAt, nowMs)} ·
            source adsb.lol (ODbL)
          </span>
        </div>
        <span
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 uppercase"
          style={{
            fontSize: "8.5px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: statusMeta.color,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: statusMeta.color }}
          />
          {statusMeta.label}
        </span>
      </div>

      {selected && (
        <ContactCard contact={selected} onClose={() => setSelectedHex(null)} />
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
