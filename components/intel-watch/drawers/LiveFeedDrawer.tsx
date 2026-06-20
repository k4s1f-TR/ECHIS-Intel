"use client";

import { useMemo, useState } from "react";
import { liveFeedEvents } from "@/data/intel-watch/events";
import type { FeedCategory } from "@/types/intel-watch";
import { IntelWatchDrawer } from "../IntelWatchDrawer";

type Props = {
  open: boolean;
  onClose: () => void;
};

type FeedCategoryFilter = FeedCategory | "intelligence" | "maritime";

const CATEGORY_STYLE: Record<
  FeedCategoryFilter,
  { label: string; color: string; bg: string }
> = {
  diplomatic: {
    label: "Diplomatic",
    color: "var(--c-elev)",
    bg: "var(--c-elev-bg)",
  },
  border: {
    label: "Border",
    color: "rgba(250, 204, 21, 0.9)",
    bg: "rgba(113, 63, 18, 0.15)",
  },
  sanctions: {
    label: "Sanctions",
    color: "rgba(248, 113, 113, 0.9)",
    bg: "rgba(127, 29, 29, 0.15)",
  },
  influence: {
    label: "Influence",
    color: "var(--c-med)",
    bg: "var(--c-med-bg)",
  },
  security: {
    label: "Security",
    color: "rgba(251, 146, 60, 0.9)",
    bg: "rgba(124, 45, 18, 0.15)",
  },
  policy: {
    label: "Policy",
    color: "var(--c-elev)",
    bg: "var(--c-elev-bg)",
  },
  intelligence: {
    label: "Intelligence",
    color: "rgba(217, 119, 6, 0.86)",
    bg: "rgba(217, 119, 6, 0.12)",
  },
  maritime: {
    label: "Maritime",
    color: "var(--c-silver-dim)",
    bg: "var(--c-silver-bg)",
  },
};

const CATEGORY_FILTERS: FeedCategoryFilter[] = [
  "diplomatic",
  "border",
  "sanctions",
  "influence",
  "security",
  "policy",
  "intelligence",
  "maritime",
];

const SOURCE_FILTERS = [
  "Reuters",
  "Al Jazeera",
  "DW",
  "TASS",
  "Treasury.gov",
  "UN News",
  "BBC",
  "Bloomberg",
] as const;

function FilterPill({
  label,
  active,
  onClick,
  activeColor = "var(--accent-blue-text)",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeColor?: string;
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
          ? `1px solid ${activeColor.replace("0.9", "0.35").replace("0.86", "0.35").replace("0.82", "0.35")}`
          : "1px solid rgba(255, 255, 255, 0.08)",
        background: active
          ? "var(--accent-blue-bg)"
          : "rgba(255, 255, 255, 0.04)",
        color: active ? activeColor : "var(--c-t5)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function LiveFeedDrawer({ open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<
    Set<FeedCategoryFilter>
  >(new Set());
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return liveFeedEvents.filter((event) => {
      const matchesSearch =
        query.length === 0 ||
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.source.toLowerCase().includes(query) ||
        event.agencyAbbr.toLowerCase().includes(query);

      return (
        matchesSearch &&
        (activeCategories.size === 0 || activeCategories.has(event.category)) &&
        (activeSources.size === 0 || activeSources.has(event.source))
      );
    });
  }, [activeCategories, activeSources, search]);

  function toggleCategory(category: FeedCategoryFilter) {
    setActiveCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function toggleSource(source: string) {
    setActiveSources((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  return (
    <IntelWatchDrawer
      open={open}
      onClose={onClose}
      title="LIVE FEED"
      subtitle="All updates"
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
            placeholder="Search feed..."
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
            {CATEGORY_FILTERS.map((category) => {
              const style = CATEGORY_STYLE[category];
              return (
                <FilterPill
                  key={category}
                  label={style.label}
                  active={activeCategories.has(category)}
                  onClick={() => toggleCategory(category)}
                  activeColor={style.color}
                />
              );
            })}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {SOURCE_FILTERS.map((source) => (
              <FilterPill
                key={source}
                label={source}
                active={activeSources.has(source)}
                onClick={() => toggleSource(source)}
              />
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 4, margin: "0 -20px" }}>
          {filteredEvents.length === 0 ? (
            <span
              style={{
                display: "block",
                padding: "24px 20px",
                textAlign: "center",
                fontSize: 11,
                color: "rgba(100, 115, 135, 0.6)",
              }}
            >
              No events match the current filters.
            </span>
          ) : (
            filteredEvents.map((event) => {
              const categoryStyle = CATEGORY_STYLE[event.category];

              return (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 20px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 1,
                      background: "rgba(255, 255, 255, 0.055)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      fontSize: 7.5,
                      fontWeight: 700,
                      color: "rgba(180, 195, 215, 0.85)",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {event.agencyAbbr}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      minWidth: 0,
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "rgba(210, 220, 235, 0.93)",
                        lineHeight: 1.35,
                      }}
                    >
                      {event.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(125, 140, 160, 0.8)",
                        lineHeight: 1.5,
                      }}
                    >
                      {event.description}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 600,
                          color: categoryStyle.color,
                          background: categoryStyle.bg,
                          borderRadius: 3,
                          padding: "1px 5px",
                        }}
                      >
                        {categoryStyle.label}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: "rgba(100, 115, 135, 0.7)",
                        }}
                      >
                        {event.source}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 9,
                          color: "rgba(85, 100, 120, 0.65)",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {event.timestamp}
                      </span>
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
