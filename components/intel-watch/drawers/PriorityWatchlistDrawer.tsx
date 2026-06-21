"use client";

import { useMemo, useState } from "react";
import { watchlistEntries } from "@/data/intel-watch/watchlist";
import type { PriorityLevel } from "@/types/intel-watch";
import { IntelWatchDrawer } from "../IntelWatchDrawer";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PRIORITY_FILTERS: PriorityLevel[] = ["HIGH", "MEDIUM", "LOW"];

const REGION_FILTERS = [
  "North America",
  "Europe",
  "MENA",
  "Eurasia",
  "Asia Pacific",
  "Africa",
  "Latin America",
] as const;

const PRIORITY_STYLE: Record<
  PriorityLevel,
  { color: string; bg: string; border: string }
> = {
  HIGH: {
    color: "rgba(251, 146, 60, 0.95)",
    bg: "rgba(124, 45, 18, 0.18)",
    border: "rgba(251, 146, 60, 0.25)",
  },
  MEDIUM: {
    color: "rgba(250, 204, 21, 0.9)",
    bg: "rgba(113, 63, 18, 0.18)",
    border: "rgba(250, 204, 21, 0.2)",
  },
  LOW: {
    color: "var(--c-elev)",
    bg: "var(--c-elev-bg)",
    border: "var(--c-elev-border)",
  },
};

const GRID_COLUMNS = "minmax(0, 1fr) 72px 96px 70px";

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: "3px 8px",
        borderRadius: 4,
        border: active
          ? "1px solid var(--accent-blue-border)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        background: active
          ? "var(--accent-blue-bg)"
          : "rgba(255, 255, 255, 0.04)",
        color: active
          ? "var(--accent-blue-text)"
          : "var(--c-t5)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function regionMatches(entryRegion: string, selectedRegion: string) {
  if (entryRegion === selectedRegion) return true;
  if (selectedRegion === "MENA" && entryRegion === "Middle East") return true;
  return false;
}

export function PriorityWatchlistDrawer({ open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [activePriorities, setActivePriorities] = useState<Set<PriorityLevel>>(
    new Set()
  );
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set());

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return watchlistEntries.filter((entry) => {
      const matchesSearch =
        query.length === 0 ||
        entry.region.toLowerCase().includes(query) ||
        entry.topic.toLowerCase().includes(query) ||
        entry.priority.toLowerCase().includes(query);

      const matchesRegion =
        activeRegions.size === 0 ||
        Array.from(activeRegions).some((region) =>
          regionMatches(entry.region, region)
        );

      return (
        matchesSearch &&
        matchesRegion &&
        (activePriorities.size === 0 ||
          activePriorities.has(entry.priority))
      );
    });
  }, [activePriorities, activeRegions, search]);

  function togglePriority(priority: PriorityLevel) {
    setActivePriorities((current) => {
      const next = new Set(current);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  }

  function toggleRegion(region: string) {
    setActiveRegions((current) => {
      const next = new Set(current);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  return (
    <IntelWatchDrawer
      open={open}
      onClose={onClose}
      title="PRIORITY WATCHLIST"
      subtitle="10 active items"
    >
      <div style={{ display: "flex", minHeight: "100%", flexDirection: "column" }}>
        <div
          style={{
            position: "sticky",
            top: -16,
            zIndex: 2,
            margin: "-16px -20px 0",
            padding: "14px 20px 12px",
            background: "var(--bg-panel)",
            borderBottom: "1px solid var(--c-border-2)",
          }}
        >
          <input
            type="search"
            placeholder="Search watchlist..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              width: "100%",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 4,
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--c-t2)",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {PRIORITY_FILTERS.map((priority) => (
              <FilterPill
                key={priority}
                label={priority}
                active={activePriorities.has(priority)}
                onClick={() => togglePriority(priority)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {REGION_FILTERS.map((region) => (
              <FilterPill
                key={region}
                label={region}
                active={activeRegions.has(region)}
                onClick={() => toggleRegion(region)}
              />
            ))}
          </div>
        </div>

        <div style={{ margin: "0 -20px", paddingTop: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gap: 8,
              padding: "0 20px 6px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            {["REGION/TOPIC", "PRIORITY", "CONF.", "UPDATED"].map((label) => (
              <span
                key={label}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "var(--c-t5)",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {filteredEntries.length === 0 ? (
            <span
              style={{
                display: "block",
                padding: "24px 20px",
                textAlign: "center",
                fontSize: 11,
                color: "var(--c-t5)",
              }}
            >
              No watchlist entries match the current filters.
            </span>
          ) : (
            filteredEntries.map((entry) => {
              const priorityStyle = PRIORITY_STYLE[entry.priority];

              return (
                <div
                  key={entry.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLUMNS,
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 20px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.045)",
                  }}
                >
                  <div style={{ display: "flex", minWidth: 0, flexDirection: "column" }}>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--c-t2)",
                      }}
                    >
                      {entry.region}
                    </span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 10.5,
                        color: "var(--c-t4)",
                      }}
                    >
                      {entry.topic}
                    </span>
                  </div>

                  <span
                    style={{
                      justifySelf: "start",
                      minWidth: 52,
                      border: `1px solid ${priorityStyle.border}`,
                      borderRadius: 4,
                      padding: "2px 8px",
                      textAlign: "center",
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: priorityStyle.color,
                      background: priorityStyle.bg,
                    }}
                  >
                    {entry.priority}
                  </span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: "var(--c-t4)",
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "var(--font-mono), ui-monospace, monospace",
                      }}
                    >
                      {entry.confidence}%
                    </span>
                    <div
                      style={{
                        width: "100%",
                        height: 2,
                        borderRadius: 1,
                        background: "rgba(255, 255, 255, 0.07)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${entry.confidence}%`,
                          height: "100%",
                          borderRadius: 1,
                          background: "var(--accent-grad)",
                        }}
                      />
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--c-t4)",
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {entry.lastUpdate.replace(" UTC", "")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </IntelWatchDrawer>
  );
}
