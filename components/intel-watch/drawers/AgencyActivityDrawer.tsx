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
    color: "rgba(96, 165, 250, 0.9)",
    bg: "rgba(29, 78, 216, 0.12)",
  },
  Diplomatic: {
    color: "rgba(167, 139, 250, 0.9)",
    bg: "rgba(76, 29, 149, 0.15)",
  },
  Supranational: {
    color: "rgba(52, 211, 153, 0.9)",
    bg: "rgba(5, 150, 105, 0.12)",
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
          ? "1px solid rgba(96, 165, 250, 0.35)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        background: active
          ? "rgba(96, 165, 250, 0.12)"
          : "rgba(255, 255, 255, 0.04)",
        color: active
          ? "rgba(180, 205, 235, 0.92)"
          : "rgba(110, 125, 145, 0.8)",
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
            borderBottom: "1px solid rgba(51, 65, 85, 0.25)",
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
              color: "rgba(195, 208, 225, 0.9)",
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
                color: "rgba(100, 115, 135, 0.6)",
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
                            color: "rgba(195, 208, 225, 0.92)",
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
                            color: "rgba(110, 125, 145, 0.7)",
                          }}
                        >
                          {agency.fullName}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 9.5,
                          color: "rgba(90, 105, 125, 0.65)",
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
                        color: "rgba(140, 155, 175, 0.75)",
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "ui-monospace, monospace",
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
                          background: "rgba(96, 165, 250, 0.55)",
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
