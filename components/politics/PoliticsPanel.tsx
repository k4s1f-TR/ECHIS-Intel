"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Building2,
  ChevronDown,
  Search,
  Bookmark,
  ArrowRight,
} from "lucide-react";
import type { OsintEvent, EventSeverity } from "@/types/event";
import { mockSources } from "@/data/mockSources";

type SeverityFilter = "all" | EventSeverity;

const SEVERITY_PILLS: { key: SeverityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const SEV: Record<EventSeverity, { text: string; border: string; bg: string; accent: string }> = {
  critical: { text: "var(--sev-critical-text)", border: "var(--sev-critical-border)", bg: "var(--sev-critical-bg)", accent: "#ef4444" },
  high:     { text: "var(--sev-high-text)", border: "var(--sev-high-border)", bg: "var(--sev-high-bg)", accent: "#f97316" },
  medium:   { text: "var(--sev-medium-text)", border: "var(--sev-medium-border)", bg: "var(--sev-medium-bg)", accent: "#eab308" },
  low:      { text: "var(--sev-low-text)", border: "var(--sev-low-border)", bg: "var(--sev-low-bg)", accent: "#555" },
};

const PILL_ACTIVE: Record<SeverityFilter, { text: string; border: string; bg: string }> = {
  all:      { text: "var(--accent-blue-text)", border: "var(--accent-blue-border)", bg: "var(--accent-blue-bg)" },
  critical: { text: "var(--sev-critical-text)", border: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.12)" },
  high:     { text: "var(--sev-high-text)", border: "rgba(249,115,22,0.5)", bg: "rgba(249,115,22,0.12)" },
  medium:   { text: "var(--sev-medium-text)", border: "rgba(234,179,8,0.5)", bg: "rgba(234,179,8,0.12)" },
  low:      { text: "rgba(160,160,160,0.95)", border: "rgba(100,100,100,0.4)", bg: "rgba(100,100,100,0.1)" },
};

function getSourceName(sourceId: string): string {
  return mockSources.find((s) => s.id === sourceId)?.name ?? sourceId;
}

type SourceDropdownOption = {
  id: string;
  label: string;
};

function SourceFilterDropdown({
  options,
  selectedId,
  onSelect,
}: {
  options: SourceDropdownOption[];
  selectedId: string;
  onSelect: (sourceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === selectedId),
  );
  const selectedLabel = options[selectedIndex]?.label ?? "All Sources";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function commitSelection(option: SourceDropdownOption) {
    onSelect(option.id);
    setOpen(false);
  }

  function openMenu() {
    setHighlightedIndex(selectedIndex);
    setOpen(true);
  }

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    openMenu();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        const option = options[highlightedIndex];
        if (option) {
          commitSelection(option);
        }
      } else {
        openMenu();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlightedIndex((current) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        return (current + direction + options.length) % options.length;
      });
    }
  }

  return (
    <div ref={rootRef} className="relative w-[184px]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleMenu}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-[32px] w-full items-center justify-between rounded-md px-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[#ec2f3b]/45"
        style={{
          fontSize: "var(--fs-sm)",
          color: "var(--text-secondary)",
          background: open ? "var(--border-dim)" : "var(--border-subtle)",
          border: open ? "1px solid var(--accent-blue-border)" : "1px solid var(--border-primary)",
          boxShadow: open ? "0 0 0 1px rgba(236,47,59,0.04)" : "none",
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={11}
          className={`ml-2 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--text-tertiary)" }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="tm-scrollbar politics-feed-scrollbar absolute right-0 top-[36px] z-50 max-h-[186px] w-[220px] overflow-y-auto rounded-md py-1"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-hover)",
            boxShadow: "var(--shadow-lg), var(--shadow-inset-highlight)",
          }}
        >
          {options.map((option, index) => {
            const selected = option.id === selectedId;
            const highlighted = index === highlightedIndex;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => commitSelection(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className="flex w-full items-center px-2.5 py-2 text-left transition-colors duration-150"
                style={{
                  background: selected
                    ? "var(--accent-blue-bg-strong)"
                    : highlighted
                      ? "var(--bg-surface-active)"
                      : "transparent",
                  color: selected ? "var(--accent-blue-text)" : "var(--text-secondary)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: selected ? 600 : 500,
                }}
              >
                <span className={selected ? "truncate accent-grad-text" : "truncate"}>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Side panel mock data ──────────────────────────────────────── */
type SignalRowData = {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
  detail?: {
    left: string;
    leftUp: boolean;
    right: string;
    rightUp: boolean;
  };
};

const GLOBAL_ECON_ROWS: SignalRowData[] = [
  { label: "USD/TRY",   value: "32.84", change: "+0.42%", up: true  },
  { label: "EUR/TRY",   value: "35.21", change: "-0.18%", up: false },
  { label: "GBP/TRY",   value: "41.15", change: "+0.61%", up: true  },
  { label: "Gold",      value: "2,385", change: "+0.89%", up: true  },
  { label: "Brent Oil", value: "84.20", change: "-0.33%", up: false },
];

const TR_BIST_ROWS: SignalRowData[] = [
  { label: "BIST 100",  value: "9,842",    change: "+1.24%", up: true },
  { label: "BIST 30",   value: "10,215",   change: "+1.38%", up: true },
  { label: "ASELS",     value: "128.60",   change: "+2.10%", up: true },
  { label: "Volume",    value: "42.3 Billion"                          },
  {
    label: "Advancers / Decliners",
    value: "",
    detail: { left: "312", leftUp: true, right: "187", rightUp: false },
  },
];

const CRYPTO_ROWS: SignalRowData[] = [
  { label: "BTC", value: "64,820", change: "+1.12%", up: true },
  { label: "ETH", value: "3,180", change: "+0.74%", up: true },
  { label: "BNB", value: "582.4", change: "-0.29%", up: false },
  { label: "SOL", value: "148.6", change: "+2.06%", up: true },
  { label: "XRP", value: "0.532", change: "-0.41%", up: false },
];

const REGIONAL_FOCUS_ITEMS = [
  "All Regions",
  "Turkey",
  "Europe",
  "Balkans",
  "Middle East",
  "North Africa",
  "Caucasus",
  "Asia-Pacific",
  "Americas",
];

const POLITICAL_MONITOR_ITEMS = [
  "All Policy",
  "Turkey Policy",
  "Turkey Foreign Policy",
  "Diplomacy",
  "Elections",
  "Government / Cabinet",
  "Parliament",
  "Protests",
  "Sanctions",
  "Regional Summits",
];

function eventSearchText(event: OsintEvent): string {
  return [
    event.title,
    event.summary,
    event.location,
    event.sourceType,
    event.verification,
    ...(event.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function isTurkeyRelated(event: OsintEvent, text = eventSearchText(event)) {
  return (
    event.markerVariant === "turkey-focus" ||
    includesAny(text, ["turkey", "türkiye", "ankara", "istanbul"])
  );
}

function matchesRegionalFocus(event: OsintEvent, focus: string) {
  if (focus === "All Regions") return true;

  const text = eventSearchText(event);
  switch (focus) {
    case "Turkey":
      return isTurkeyRelated(event, text);
    case "Europe":
      return event.region === "europe";
    case "Middle East":
      return event.region === "middle-east";
    case "Asia-Pacific":
      return event.region === "asia-pacific";
    case "Americas":
      return event.region === "americas";
    case "Balkans":
      return includesAny(text, [
        "balkans",
        "serbia",
        "belgrade",
        "bosnia",
        "sarajevo",
        "kosovo",
        "pristina",
        "north macedonia",
        "skopje",
        "albania",
        "tirana",
        "croatia",
        "zagreb",
        "bulgaria",
        "sofia",
        "greece",
        "athens",
      ]);
    case "North Africa":
      return includesAny(text, [
        "north africa",
        "morocco",
        "rabat",
        "algeria",
        "algiers",
        "tunisia",
        "tunis",
        "libya",
        "tripoli",
        "egypt",
        "cairo",
        "mauritania",
        "nouakchott",
      ]);
    case "Caucasus":
      return includesAny(text, [
        "caucasus",
        "georgia",
        "tbilisi",
        "armenia",
        "yerevan",
        "azerbaijan",
        "baku",
      ]);
    default:
      return true;
  }
}

function matchesPoliticalMonitor(event: OsintEvent, monitor: string) {
  if (monitor === "All Policy") return true;

  const text = eventSearchText(event);
  switch (monitor) {
    case "Turkey Policy":
      return isTurkeyRelated(event, text);
    case "Turkey Foreign Policy":
      return (
        isTurkeyRelated(event, text) &&
        includesAny(text, [
          "foreign policy",
          "diplomatic",
          "diplomacy",
          "border",
          "sanctions",
          "summit",
          "mediterranean",
          "consultation",
        ])
      );
    case "Diplomacy":
      return includesAny(text, [
        "diplomacy",
        "diplomatic",
        "foreign policy",
        "foreign ministry",
        "consultation",
        "dialogue",
        "mediation",
        "coordination",
      ]);
    case "Elections":
      return includesAny(text, ["election", "electoral", "vote", "ballot"]);
    case "Government / Cabinet":
      return includesAny(text, [
        "government",
        "cabinet",
        "ministry",
        "foreign ministry",
        "reshuffle",
        "coalition",
        "confidence",
      ]);
    case "Parliament":
      return includesAny(text, [
        "parliament",
        "parliamentary",
        "legislative",
        "committee",
        "caucus",
        "procedural",
      ]);
    case "Protests":
      return includesAny(text, ["protest", "rally", "unrest", "opposition"]);
    case "Sanctions":
      return includesAny(text, ["sanction", "sanctions"]);
    case "Regional Summits":
      return includesAny(text, ["summit", "regional summit", "preparatory"]);
    default:
      return true;
  }
}

/* ─── Side panel sub-components ────────────────────────────────── */
function SignalRow({ label, value, change, up, detail }: SignalRowData) {
  const changeColor =
    up === true  ? "var(--c-med)"
    : up === false ? "rgba(239,68,68,0.85)"
    : "var(--text-muted)";
  const detailUpColor = "var(--c-med)";
  const detailDownColor = "rgba(239,68,68,0.85)";
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "5px 0", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span
          style={{
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: "var(--text-body)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        {detail && (
          <div
            className="flex items-center gap-1"
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ color: "var(--text-body)" }}>{detail.left}</span>
            <span style={{ color: detail.leftUp ? detailUpColor : detailDownColor }}>
              {detail.leftUp ? "▲" : "▼"}
            </span>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <span style={{ color: "var(--text-body)" }}>{detail.right}</span>
            <span style={{ color: detail.rightUp ? detailUpColor : detailDownColor }}>
              {detail.rightUp ? "▲" : "▼"}
            </span>
          </div>
        )}
        {change !== undefined && (
          <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: changeColor }}>
            {up === true ? "▲" : up === false ? "▼" : ""}{change}
          </span>
        )}
      </div>
    </div>
  );
}

function CompactMarketPanel({
  title,
  rows,
}: {
  title: string;
  rows: SignalRowData[];
}) {
  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
      }}
    >
      <p
        style={{
          fontSize: "var(--fs-sm)",
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: "8px",
        }}
      >
        {title}
      </p>
      {rows.map((row) => (
        <SignalRow key={row.label} {...row} />
      ))}
    </div>
  );
}

function PoliticsSidePanel({
  title,
  items,
  selected,
  onSelect,
  fill = false,
}: {
  title: string;
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
  fill?: boolean;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        width: "100%",
        flex: fill ? 1 : "0 0 auto",
        minHeight: fill ? 0 : undefined,
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "10px 12px",
      }}
    >
      <p
        style={{
          fontSize: "var(--fs-sm)",
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: "7px",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </p>
      <div
        className="flex flex-col gap-0.5 overflow-y-auto pr-0.5"
        style={{
          flex: fill ? 1 : "0 0 auto",
          minHeight: fill ? 0 : undefined,
        }}
      >
        {items.map((item) => {
          const active = item === selected;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              className="flex items-center justify-between rounded-md px-2 py-1 transition-colors duration-150"
              style={{
                background: active ? "var(--accent-blue-bg)" : "transparent",
                border: active
                  ? "1px solid var(--accent-blue-border)"
                  : "1px solid transparent",
                color: active ? "var(--accent-blue-text)" : "var(--text-muted)",
                fontSize: "var(--fs-sm)",
                fontWeight: active ? 600 : 500,
                textAlign: "left",
                minHeight: "24px",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--bg-surface-hover)";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)";
                }
              }}
            >
              <span className={active ? "accent-grad-text" : undefined}>{item}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Event severity badge ──────────────────────────────────────── */
function SevBadge({ severity }: { severity: EventSeverity }) {
  const s = SEV[severity];
  return (
    <span
      className="px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ fontSize: "var(--fs-xs)", fontWeight: 700, background: s.bg, color: s.text, border: `1px solid ${s.border}`, flexShrink: 0 }}
    >
      {severity}
    </span>
  );
}


/* ─── Compact list card ─────────────────────────────────────────── */
function ListCard({
  event,
  selected,
  onSelect,
}: {
  event: OsintEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = SEV[event.severity];
  return (
    <div
      onClick={onSelect}
      className="relative cursor-pointer"
      style={{
        background: selected ? "var(--accent-blue-bg)" : "var(--bg-surface)",
        border: selected ? "1px solid var(--accent-blue-border)" : "1px solid var(--border-dim)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px 10px 16px",
        marginBottom: "5px",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)";
        }
      }}
    >
      {/* severity accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: s.accent, opacity: 0.6, borderRadius: "7px 0 0 7px" }}
      />

      {/* title row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p
          className="leading-snug line-clamp-2 flex-1"
          style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: selected ? "var(--text-heading)" : "var(--text-body)" }}
        >
          {event.title}
        </p>
        <button
          style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: "1px" }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--accent-blue-text)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-dim)")}
        >
          <Bookmark size={12} />
        </button>
      </div>

      {/* meta row */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)" }}>{event.time}</span>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{getSourceName(event.sourceId)}</span>
          <SevBadge severity={event.severity} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
export function PoliticsPanel({ events }: { events: OsintEvent[] }) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRegionFocus, setSelectedRegionFocus] = useState("All Regions");
  const [selectedPoliticalMonitor, setSelectedPoliticalMonitor] = useState("All Policy");
  const [selectedSourceId, setSelectedSourceId] = useState("all");

  const sourceOptions: SourceDropdownOption[] = [
    { id: "all", label: "All Sources" },
    ...Array.from(new Set(events.map((event) => event.sourceId))).map((sourceId) => ({
      id: sourceId,
      label: getSourceName(sourceId),
    })),
  ];

  const filtered = events.filter((e) => {
    if (!matchesRegionalFocus(e, selectedRegionFocus)) return false;
    if (!matchesPoliticalMonitor(e, selectedPoliticalMonitor)) return false;
    if (selectedSourceId !== "all" && e.sourceId !== selectedSourceId) return false;
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (
      search.trim() &&
      !e.title.toLowerCase().includes(search.toLowerCase()) &&
      !e.summary.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ background: "var(--bg-shell)" }}
    >
      {/* Left panel area */}
      <div
        className="flex flex-1 flex-col py-4 pl-4 pr-3"
        style={{ minWidth: 0 }}
      >
        <div className="ml-auto flex h-full w-full max-w-[268px] flex-col gap-3">
          <PoliticsSidePanel
            title="Regional Focus"
            items={REGIONAL_FOCUS_ITEMS}
            selected={selectedRegionFocus}
            onSelect={setSelectedRegionFocus}
          />
          <PoliticsSidePanel
            title="Policy Monitors"
            items={POLITICAL_MONITOR_ITEMS}
            selected={selectedPoliticalMonitor}
            onSelect={setSelectedPoliticalMonitor}
            fill
          />
        </div>
      </div>

      {/* ── Center column ───────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 py-4 gap-3"
        style={{ width: "920px" }}
      >
        {/* TOP: Controls panel */}
        <div
          className="flex-shrink-0 px-4 py-3"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-lg)",
                  }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Building2 size={13} style={{ color: "var(--icon-default)" }} />
              <span
                className="tracking-widest uppercase font-semibold"
                style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}
              >
                Policy Monitor
              </span>
            </div>
            <SourceFilterDropdown
              options={sourceOptions}
              selectedId={selectedSourceId}
              onSelect={setSelectedSourceId}
            />
          </div>

          {/* Severity pills */}
          <div className="flex items-center gap-1 mb-2.5">
            {SEVERITY_PILLS.map((pill) => {
              const active = severityFilter === pill.key;
              const pa = active ? PILL_ACTIVE[pill.key] : null;
              return (
                <button
                  key={pill.key}
                  onClick={() => setSeverityFilter(pill.key)}
                  className="px-2.5 py-1 rounded transition-all duration-150"
                  style={{
                    fontSize: "var(--fs-sm)",
                    fontWeight: active ? 600 : 400,
                    color: active ? pa!.text : "var(--text-dim)",
                    background: active ? pa!.bg : "transparent",
                    border: active ? `1px solid ${pa!.border}` : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className={active && pill.key === "all" ? "accent-grad-text" : undefined}>{pill.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded px-2.5 py-1.5"
            style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border-primary)" }}
          >
            <Search size={11} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search politics events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: "var(--fs-base)", color: "var(--text-secondary)" }}
            />
          </div>
        </div>

        {/* BOTTOM: Event list panel */}
        <div
          className="flex flex-col flex-1 min-h-0"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
                  }}
        >

        {/* Card list */}
        <div className="tm-scrollbar politics-feed-scrollbar flex-1 min-h-0 overflow-y-auto" style={{ padding: "8px 10px" }}>
          {filtered.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-1 text-center"
              style={{ fontSize: "var(--fs-base)", color: "var(--text-dim)" }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                No matching political events
              </span>
              <span>Try changing the monitor or regional focus.</span>
            </div>
          ) : (
            filtered.map((event) => (
              <ListCard
                key={event.id}
                event={event}
                selected={selectedId === event.id}
                onSelect={() => setSelectedId(event.id === selectedId ? null : event.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border-dim)" }}
        >
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)" }}>
            {filtered.length} of {events.length} results
          </span>
          <button
            className="flex items-center gap-1 transition-colors duration-150"
            style={{ fontSize: "var(--fs-sm)", color: "var(--accent-blue-text)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,86,96,1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--accent-blue-text)")}
          >
            <span className="accent-grad-text">View all</span> <ArrowRight size={10} />
          </button>
        </div>
        </div>{/* end bottom event list panel */}
      </div>

      {/* Right panel area */}
      <div
        className="flex flex-col flex-shrink-0 gap-3 py-4 pl-3 pr-4"
        style={{ width: "268px" }}
      >
        <CompactMarketPanel title="Global Economics" rows={GLOBAL_ECON_ROWS} />
        <CompactMarketPanel title="TR-BIST Economics" rows={TR_BIST_ROWS} />
        <CompactMarketPanel title="Crypto Assets" rows={CRYPTO_ROWS} />
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-lg)",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
                  }}
        >
          <span
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              textTransform: "uppercase",
            }}
          >
            Last Updated
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "var(--accent-green-dot)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "var(--fs-base)",
                fontWeight: 600,
                color: "var(--text-body)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              19:51 UTC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
