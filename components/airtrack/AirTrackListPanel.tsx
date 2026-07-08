"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AirTrackContact } from "@/types/airtrack";

// Left-side contact list — search + click-to-focus.  Follows the floating
// panel visual language used across the map screens (dark glass surface,
// mono data text).

const PANEL_WIDTH = 252;
const ROW_LIMIT = 250;

function contactSortKey(c: AirTrackContact): number {
  if (c.emergency) return 0;
  if (c.watchlist?.priority) return 1;
  if (c.watchlist) return 2;
  if (c.military) return 3;
  return 4;
}

function matchesQuery(c: AirTrackContact, q: string): boolean {
  return (
    (c.callsign?.toLowerCase().includes(q) ?? false) ||
    c.icao24.includes(q) ||
    (c.registration?.toLowerCase().includes(q) ?? false) ||
    (c.typeCode?.toLowerCase().includes(q) ?? false) ||
    (c.typeName?.toLowerCase().includes(q) ?? false) ||
    (c.operator?.toLowerCase().includes(q) ?? false)
  );
}

export function AirTrackListPanel({
  contacts,
  selectedId,
  onSelect,
}: {
  contacts: AirTrackContact[];
  selectedId: string | null;
  onSelect: (contact: AirTrackContact) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? contacts.filter((c) => matchesQuery(c, q)) : contacts;
    return [...filtered]
      .sort((a, b) => {
        const byKind = contactSortKey(a) - contactSortKey(b);
        if (byKind !== 0) return byKind;
        return (a.callsign ?? a.icao24).localeCompare(b.callsign ?? b.icao24);
      })
      .slice(0, ROW_LIMIT);
  }, [contacts, query]);

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Expand contact list"
        onClick={() => setCollapsed(false)}
        className="absolute flex items-center gap-1.5 rounded-lg px-2.5 py-2"
        style={{
          top: "74px",
          left: "16px",
          zIndex: 15,
          background: "rgba(7,8,10,0.72)",
          border: "1px solid var(--accent-blue-border)",
          backdropFilter: "blur(14px)",
          color: "var(--c-t4)",
          fontSize: "9.5px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <ChevronRight size={11} />
        Contacts ({contacts.length})
      </button>
    );
  }

  return (
    <div
      className="absolute flex flex-col rounded-lg"
      style={{
        top: "74px",
        left: "16px",
        bottom: "56px",
        width: `${PANEL_WIDTH}px`,
        zIndex: 15,
        background: "rgba(7,8,10,0.78)",
        border: "1px solid var(--accent-blue-border)",
        boxShadow: "0 14px 36px rgba(0,0,0,0.42)",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
      }}
    >
      {/* Header + search */}
      <div
        className="flex items-center gap-2 px-3 pt-2.5 pb-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span
          className="flex-1 uppercase"
          style={{
            fontSize: "9.5px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "var(--c-t3)",
          }}
        >
          Contacts · {rows.length}
          {query.trim() ? ` / ${contacts.length}` : ""}
        </span>
        <button
          type="button"
          aria-label="Collapse contact list"
          onClick={() => setCollapsed(true)}
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ color: "var(--c-t5)", cursor: "pointer" }}
        >
          <ChevronLeft size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={11} style={{ color: "var(--c-t5)", flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Callsign, hex, type, operator…"
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: "11px",
            color: "var(--c-t2)",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
          }}
        />
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {rows.map((c) => {
          const active = c.icao24 === selectedId;
          const dotColor = c.emergency
            ? "#ff2b3d"
            : c.watchlist?.priority
              ? "#a8c6de"
              : c.watchlist
                ? "#e8c268"
                : c.military
                  ? "#f0a75a"
                  : "#93a1ad";
          return (
            <button
              key={c.icao24}
              type="button"
              onClick={() => onSelect(c)}
              className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left"
              style={{
                background: active ? "var(--bg-surface-hover)" : "transparent",
                border: active
                  ? "1px solid var(--accent-blue-border)"
                  : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: dotColor }}
                />
                <span
                  className="flex-1 truncate"
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--c-t2)",
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                  }}
                >
                  {c.callsign ?? c.icao24.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: "9.5px",
                    color: "var(--c-t5)",
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                  }}
                >
                  {c.typeCode ?? "—"}
                </span>
              </span>
              <span
                className="truncate"
                style={{ fontSize: "9px", color: "var(--c-t5)" }}
              >
                {c.emergency
                  ? `⚠ SQUAWK ${c.squawk ?? "EMERG"}`
                  : (c.operator ?? c.typeName ?? c.registration ?? "—")}
              </span>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div
            className="px-2 py-3 text-center"
            style={{ fontSize: "10px", color: "var(--c-t5)" }}
          >
            No contacts match.
          </div>
        )}
      </div>
    </div>
  );
}
