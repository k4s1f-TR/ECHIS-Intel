"use client";

import { useMemo, useState } from "react";
import { agencies } from "@/data/intel-watch/agencies";
import type { AgencyRegion, AgencyType } from "@/types/intel-watch";
import { IntelWatchDrawer } from "../IntelWatchDrawer";

type Props = {
  open: boolean;
  onClose: () => void;
};

const SORTED_AGENCIES = [...agencies].sort(
  (a, b) => b.activityLevel - a.activityLevel
);
const MAX_ACTIVITY = SORTED_AGENCIES[0]?.activityLevel ?? 1;

const TYPE_FILTERS: AgencyType[] = [
  "Intelligence",
  "Diplomatic",
  "Supranational",
];

const REGION_FILTERS: AgencyRegion[] = [
  "North America",
  "Western & Central Europe",
  "Eastern Europe",
  "Eurasia & Russia",
  "MENA",
  "South & East Asia",
  "Southeast Asia & Oceania",
  "Latin America & Africa",
];

const TYPE_STYLE: Record<AgencyType, { color: string; bg: string }> = {
  Intelligence: {
    color: "var(--c-high)",
    bg: "var(--c-high-bg)",
  },
  Diplomatic: {
    color: "var(--c-elev)",
    bg: "var(--c-elev-bg)",
  },
  Supranational: {
    color: "var(--c-med)",
    bg: "var(--c-med-bg)",
  },
};

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

export function AgencyActivityDrawer({ open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<AgencyType>>(new Set());
  const [activeRegions, setActiveRegions] = useState<Set<AgencyRegion>>(
    new Set()
  );

  const filteredAgencies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return SORTED_AGENCIES.filter((agency) => {
      const matchesSearch =
        query.length === 0 ||
        agency.name.toLowerCase().includes(query) ||
        agency.fullName.toLowerCase().includes(query) ||
        agency.country.toLowerCase().includes(query) ||
        agency.city.toLowerCase().includes(query);

      return (
        matchesSearch &&
        (activeTypes.size === 0 || activeTypes.has(agency.type)) &&
        (activeRegions.size === 0 || activeRegions.has(agency.region))
      );
    });
  }, [activeRegions, activeTypes, search]);

  function toggleType(type: AgencyType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleRegion(region: AgencyRegion) {
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
      title="ALL AGENCIES"
      subtitle="47 tracked"
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
            placeholder="Search agencies..."
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
            {TYPE_FILTERS.map((type) => (
              <FilterPill
                key={type}
                label={type}
                active={activeTypes.has(type)}
                onClick={() => toggleType(type)}
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingTop: 12,
          }}
        >
          {filteredAgencies.length === 0 ? (
            <span
              style={{
                display: "block",
                padding: "20px 0",
                textAlign: "center",
                fontSize: 11,
                color: "var(--c-t5)",
              }}
            >
              No agencies match the current filters.
            </span>
          ) : (
            filteredAgencies.map((agency) => {
              const typeStyle = TYPE_STYLE[agency.type];
              const activityWidth = `${(agency.activityLevel / MAX_ACTIVITY) * 100}%`;

              return (
                <div key={agency.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: typeStyle.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--c-t2)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {agency.name}
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 10,
                            color: "var(--c-t5)",
                          }}
                        >
                          {agency.fullName}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 9.5,
                          color: "var(--c-t5)",
                        }}
                      >
                        {agency.region} - {agency.country}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 600,
                        color: typeStyle.color,
                        background: typeStyle.bg,
                        borderRadius: 3,
                        padding: "1px 5px",
                        flexShrink: 0,
                      }}
                    >
                      {agency.type}
                    </span>
                    <span
                      style={{
                        minWidth: 34,
                        textAlign: "right",
                        fontSize: 10,
                        color: "var(--c-t4)",
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "var(--font-mono), ui-monospace, monospace",
                      }}
                    >
                      {agency.activityLevel}
                    </span>
                  </div>

                  <div style={{ paddingLeft: 14 }}>
                    <div
                      style={{
                        height: 3,
                        borderRadius: 2,
                        background: "rgba(255, 255, 255, 0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: activityWidth,
                          height: "100%",
                          borderRadius: 2,
                          background: "var(--accent-grad)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </IntelWatchDrawer>
  );
}
