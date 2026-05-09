"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const AGENCY_TYPES = [
  { label: "Intelligence", count: 32 },
  { label: "Diplomatic", count: 15 },
  { label: "Supranational", count: 3 },
] as const;

const AGENCY_REGIONS = [
  "North America",
  "Western & Central Europe",
  "Eastern Europe",
  "Eurasia & Russia",
  "MENA",
  "South & East Asia",
  "Southeast Asia & Oceania",
  "Latin America & Africa",
] as const;

const FILTER_REGIONS = [
  "North America",
  "Europe",
  "MENA",
  "Eurasia",
  "Asia Pacific",
  "Africa",
  "Latin America",
] as const;

const SOURCES = ["Reuters", "BBC", "Al Jazeera", "Bloomberg", "Le Monde", "TASS", "DW"] as const;

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between px-3 py-1.5"
      style={{ background: "none", border: "none", cursor: "pointer" }}
      onClick={onToggle}
    >
      <span
        style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "rgba(110,125,145,0.85)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {open ? (
        <ChevronDown size={10} style={{ color: "rgba(110,125,145,0.6)" }} />
      ) : (
        <ChevronRight size={10} style={{ color: "rgba(110,125,145,0.6)" }} />
      )}
    </button>
  );
}

function Checkbox({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className="flex items-center gap-2 px-3 py-0.5 cursor-pointer"
      style={{
        fontSize: "10.5px",
        color: checked ? "rgba(200,215,235,0.92)" : "rgba(130,145,165,0.8)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ width: 11, height: 11, accentColor: "rgba(96,165,250,0.9)", flexShrink: 0 }}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontSize: "9px",
            color: "rgba(90,105,125,0.65)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
      )}
    </label>
  );
}

export function IntelWatchSidebar() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    agencies: true,
    regions: false,
    sources: false,
    time: false,
    tools: false,
  });

  const [typeFilter, setTypeFilter] = useState<Record<string, boolean>>({
    Intelligence: true,
    Diplomatic: true,
    Supranational: true,
  });

  const [regionFilter, setRegionFilter] = useState<Record<string, boolean>>(
    Object.fromEntries(AGENCY_REGIONS.map((r) => [r, false]))
  );

  const [filterRegions, setFilterRegions] = useState<Record<string, boolean>>(
    Object.fromEntries(FILTER_REGIONS.map((r) => [r, false]))
  );

  const [sources, setSources] = useState<Record<string, boolean>>(
    Object.fromEntries(SOURCES.map((s) => [s, false]))
  );

  const [timeRange, setTimeRange] = useState("Last 24h");
  const [search, setSearch] = useState("");

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const activeFilterCount =
    Object.values(typeFilter).filter(Boolean).length +
    Object.values(filterRegions).filter(Boolean).length +
    Object.values(sources).filter(Boolean).length;

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-y-auto overflow-x-hidden"
      style={{
        width: "210px",
        background: "rgba(7,9,14,0.98)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "rgba(155,170,195,0.9)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Intel Watch
        </span>
        {activeFilterCount > 0 && (
          <span
            style={{
              fontSize: "8.5px",
              fontWeight: 600,
              color: "rgba(96,165,250,0.85)",
              background: "rgba(29,78,216,0.15)",
              border: "1px solid rgba(96,165,250,0.2)",
              borderRadius: "10px",
              padding: "1px 6px",
            }}
          >
            {activeFilterCount}
          </span>
        )}
      </div>

      {/* AGENCIES section */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader label="Agencies" open={openSections.agencies} onToggle={() => toggleSection("agencies")} />
        {openSections.agencies && (
          <div className="pb-1.5">
            {/* Search */}
            <div className="px-3 pb-1.5">
              <input
                type="text"
                placeholder="Search agencies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "5px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  color: "rgba(180,195,215,0.9)",
                  outline: "none",
                }}
              />
            </div>

            {/* TYPE sub-section */}
            <div
              className="px-3 pb-0.5"
              style={{
                fontSize: "8.5px",
                fontWeight: 600,
                color: "rgba(80,95,115,0.7)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Type
            </div>
            {AGENCY_TYPES.map((t) => (
              <Checkbox
                key={t.label}
                label={t.label}
                count={t.count}
                checked={typeFilter[t.label]}
                onChange={() =>
                  setTypeFilter((prev) => ({ ...prev, [t.label]: !prev[t.label] }))
                }
              />
            ))}

            {/* REGION sub-section */}
            <div
              className="px-3 pt-2 pb-0.5"
              style={{
                fontSize: "8.5px",
                fontWeight: 600,
                color: "rgba(80,95,115,0.7)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Region
            </div>
            {AGENCY_REGIONS.map((r) => (
              <Checkbox
                key={r}
                label={r}
                checked={regionFilter[r]}
                onChange={() =>
                  setRegionFilter((prev) => ({ ...prev, [r]: !prev[r] }))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* REGIONS section */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader label="Regions" open={openSections.regions} onToggle={() => toggleSection("regions")} />
        {openSections.regions && (
          <div className="pb-1.5">
            {FILTER_REGIONS.map((r) => (
              <Checkbox
                key={r}
                label={r}
                checked={filterRegions[r]}
                onChange={() =>
                  setFilterRegions((prev) => ({ ...prev, [r]: !prev[r] }))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* SOURCES section */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader label="Sources" open={openSections.sources} onToggle={() => toggleSection("sources")} />
        {openSections.sources && (
          <div className="pb-1.5">
            {SOURCES.map((s) => (
              <Checkbox
                key={s}
                label={s}
                checked={sources[s]}
                onChange={() =>
                  setSources((prev) => ({ ...prev, [s]: !prev[s] }))
                }
              />
            ))}
            <div className="px-3 pt-0.5">
              <span style={{ fontSize: "9.5px", color: "rgba(74,222,128,0.75)", cursor: "pointer" }}>
                + More
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TIME RANGE section */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader label="Time Range" open={openSections.time} onToggle={() => toggleSection("time")} />
        {openSections.time && (
          <div className="px-3 pb-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "5px",
                padding: "5px 8px",
                fontSize: "10.5px",
                color: "rgba(180,195,215,0.9)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {["Last 24h", "Last 7 days", "Last 30 days", "Custom"].map((o) => (
                <option key={o} value={o} style={{ background: "#0d1117" }}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ANALYST TOOLS section */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader label="Analyst Tools" open={openSections.tools} onToggle={() => toggleSection("tools")} />
        {openSections.tools && (
          <div className="flex flex-col gap-1.5 px-3 pb-2.5">
            {["Open Watchlist", "Compare Regions", "Export Intelligence"].map((label) => (
              <button
                key={label}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "5px",
                  padding: "5px 10px",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "rgba(160,175,200,0.85)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* GLOBAL SUMMARY ribbon */}
      <div
        className="flex-shrink-0 px-3 py-2.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          style={{
            fontSize: "8.5px",
            fontWeight: 600,
            color: "rgba(80,95,115,0.75)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          Global Summary
        </div>
        {[
          "47 agencies tracked across 8 regions",
          "Diplomatic activity elevated in MENA",
          "Influence ops signals rising in Eurasia",
        ].map((line) => (
          <div
            key={line}
            className="flex items-start gap-1.5 mb-1"
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "rgba(120,135,155,0.5)",
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            <span
              style={{
                fontSize: "9.5px",
                color: "rgba(115,130,150,0.8)",
                lineHeight: 1.45,
              }}
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
