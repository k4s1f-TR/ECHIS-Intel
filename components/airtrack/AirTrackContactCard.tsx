"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import {
  sendToIntelWatch,
  type SendToIntelWatchResult,
} from "@/components/intel-watch/workspaceStore";
import type {
  AirTrackContact,
  AirTrackLookupPayload,
} from "@/types/airtrack";

// Rich contact card — the live telemetry renders immediately from the feed
// frame; registry data, flight route and photo stream in from
// /api/airtrack/lookup/[hex] (adsbdb + planespotters + hexdb) and fill the
// card as they arrive.  Every enrichment field is optional by design.

const SEND_RESULT_LABEL: Record<SendToIntelWatchResult, string> = {
  added: "Added to Intel Watch",
  exists: "Already in Intel Watch",
  unavailable: "Could not save",
};

// The regional fast lane means civil traffic can come from adsb.lol too, so
// the role label derives from the contact, not the provider.
const SOURCE_NAME: Record<AirTrackContact["source"], string> = {
  adsblol: "adsb.lol",
  airplaneslive: "airplanes.live",
  opensky: "OpenSky Network",
};

function sourceFooter(contact: AirTrackContact): string {
  return `${contact.military ? "Military-flagged" : "Civil traffic"} · ${SOURCE_NAME[contact.source]}`;
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
        className="truncate"
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

function airportCode(airport: {
  iata: string | null;
  icao: string | null;
}): string {
  return airport.iata ?? airport.icao ?? "—";
}

function useContactLookup(
  icao24: string,
  callsign: string | null,
): AirTrackLookupPayload | null {
  const [lookup, setLookup] = useState<AirTrackLookupPayload | null>(null);
  // Drop the previous aircraft's enrichment the moment the card switches —
  // adjust-during-render pattern (no setState inside an effect).  A late
  // callsign on the same airframe keeps the current data while refetching.
  const [lookupKey, setLookupKey] = useState(icao24);
  if (lookupKey !== icao24) {
    setLookupKey(icao24);
    setLookup(null);
  }

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const query = callsign
      ? `?callsign=${encodeURIComponent(callsign.trim())}`
      : "";
    fetch(`/api/airtrack/lookup/${encodeURIComponent(icao24)}${query}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<AirTrackLookupPayload>) : null))
      .then((payload) => {
        if (!disposed && payload && typeof payload === "object") {
          setLookup(payload);
        }
      })
      .catch(() => {
        /* enrichment is optional — the base card already renders */
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [icao24, callsign]);

  return lookup;
}

export function AirTrackContactCard({
  contact,
  onClose,
}: {
  contact: AirTrackContact;
  onClose: () => void;
}) {
  const lookup = useContactLookup(contact.icao24, contact.callsign);
  const [sendResult, setSendResult] = useState<SendToIntelWatchResult | null>(
    null,
  );
  // Reset the "sent" feedback when the card switches to another aircraft —
  // adjust-during-render pattern (no setState inside an effect).
  const [sendResultKey, setSendResultKey] = useState(contact.icao24);
  if (sendResultKey !== contact.icao24) {
    setSendResultKey(contact.icao24);
    setSendResult(null);
  }

  const typeName = contact.typeName ?? lookup?.typeName ?? null;
  const operator = contact.operator ?? lookup?.operator ?? null;
  const route = lookup?.route ?? null;
  const photo = lookup?.photo ?? null;

  function handleSend(): SendToIntelWatchResult {
    const label = contact.callsign ?? contact.icao24.toUpperCase();
    const facts = [
      contact.military ? "Military contact" : "Civil contact",
      operator ?? undefined,
      typeName ?? undefined,
      contact.altitudeFt !== null
        ? `${contact.altitudeFt.toLocaleString("en-US")} ft`
        : undefined,
      contact.squawk ? `squawk ${contact.squawk}` : undefined,
    ].filter(Boolean);
    return sendToIntelWatch({
      itemId: `airtrack-${contact.icao24}`,
      lng: contact.lon,
      lat: contact.lat,
      title: typeName ? `${label} · ${typeName}` : label,
      source: "Air Track",
      updated:
        new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
      note: facts.join(" · "),
    });
  }

  return (
    <div
      className="absolute rounded-lg"
      style={{
        top: "64px",
        right: "14px",
        width: "236px",
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

      {photo && (
        <a
          href={photo.pageUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="relative mb-2 block overflow-hidden rounded"
          style={{ border: "1px solid var(--border-subtle)" }}
        >
          {/* Photo comes from planespotters' CDN; a plain img keeps the strict
              no-remote-config rule (next/image would need remotePatterns). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbnailUrl}
            alt={typeName ?? "Aircraft photo"}
            style={{
              display: "block",
              width: "100%",
              height: "112px",
              objectFit: "cover",
            }}
          />
          {photo.photographer && (
            <span
              className="absolute bottom-0 right-0 px-1.5 py-0.5"
              style={{
                fontSize: "7.5px",
                color: "rgba(255,255,255,0.75)",
                background: "rgba(7,8,10,0.65)",
                borderTopLeftRadius: 4,
              }}
            >
              © {photo.photographer}
            </span>
          )}
        </a>
      )}

      {(typeName || operator) && (
        <div className="mb-2 flex flex-col gap-0.5">
          {typeName && (
            <span style={{ fontSize: "10.5px", color: "var(--c-t3)" }}>
              {typeName}
            </span>
          )}
          {operator && (
            <span style={{ fontSize: "9.5px", color: "var(--c-t4)" }}>
              {operator}
            </span>
          )}
        </div>
      )}

      {contact.watchlist && (
        <div
          className="mb-2 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 uppercase"
          style={{
            fontSize: "8.5px",
            fontWeight: 800,
            letterSpacing: "0.09em",
            color: contact.watchlist.priority ? "#c7ddf0" : "#f0d9a8",
            border: `1px solid ${contact.watchlist.priority ? "rgba(168,198,222,0.4)" : "rgba(232,194,104,0.35)"}`,
            background: contact.watchlist.priority
              ? "rgba(168,198,222,0.08)"
              : "rgba(232,194,104,0.07)",
          }}
        >
          Watchlist · {contact.watchlist.category}
        </div>
      )}
      {contact.emergency && (
        <div
          className="mb-2 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 uppercase"
          style={{
            fontSize: "8.5px",
            fontWeight: 800,
            letterSpacing: "0.09em",
            color: "#ffb3ba",
            border: "1px solid rgba(255,43,61,0.5)",
            background: "rgba(255,43,61,0.1)",
          }}
        >
          ⚠ Emergency squawk {contact.squawk ?? ""}
        </div>
      )}

      {route && (
        <div
          className="mb-2 rounded px-2 py-1.5"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--c-t2)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
            }}
          >
            <span>{airportCode(route.origin)}</span>
            <span style={{ color: "var(--c-t5)" }}>→</span>
            <span>{airportCode(route.destination)}</span>
          </div>
          <div
            className="mt-0.5 flex items-center justify-between gap-2"
            style={{ fontSize: "8.5px", color: "var(--c-t5)" }}
          >
            <span className="truncate">
              {route.origin.municipality ?? route.origin.name ?? "—"}
            </span>
            <span className="truncate text-right">
              {route.destination.municipality ?? route.destination.name ?? "—"}
            </span>
          </div>
          {route.airline && (
            <div
              className="mt-0.5 truncate"
              style={{ fontSize: "8.5px", color: "var(--c-t5)" }}
            >
              {route.airline}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <ContactRow label="Hex" value={contact.icao24.toUpperCase()} />
        <ContactRow
          label="Reg"
          value={contact.registration ?? lookup?.registration ?? "—"}
        />
        <ContactRow
          label="Type"
          value={contact.typeCode ?? lookup?.typeCode ?? "—"}
        />
        {lookup?.countryName && (
          <ContactRow label="Country" value={lookup.countryName} />
        )}
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

      <button
        type="button"
        onClick={() => setSendResult(handleSend())}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 uppercase"
        style={{
          padding: "5px 8px",
          borderRadius: 6,
          fontSize: "8.5px",
          fontWeight: 800,
          letterSpacing: "0.09em",
          lineHeight: 1,
          color:
            sendResult === "added"
              ? "var(--accent-blue-text)"
              : "var(--c-t4)",
          border: "1px solid var(--border-subtle)",
          background: "rgba(255,255,255,0.02)",
          cursor: "pointer",
        }}
      >
        <MapPin size={10} />
        {sendResult ? SEND_RESULT_LABEL[sendResult] : "Send to Intel Watch"}
      </button>

      <div
        className="mt-2.5 pt-2 uppercase"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "8.5px",
          letterSpacing: "0.09em",
          color: "var(--c-t6)",
        }}
      >
        {sourceFooter(contact)}
      </div>
    </div>
  );
}
