"use client";
import { useState } from "react";
import { Newspaper } from "lucide-react";
import { cyberNewsItems, type CyberNewsItem } from "@/data/cyberMockData";

/* Severity → UI badge token map (red-dominant family; low folds into Elevated/silver) */
const SEV_BADGE: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "var(--c-crit)", bg: "var(--c-crit-bg)", border: "var(--c-crit-border)" },
  high: { text: "var(--c-high)", bg: "var(--c-high-bg)", border: "var(--c-high-border)" },
  medium: { text: "var(--c-med)", bg: "var(--c-med-bg)", border: "var(--c-med-border)" },
  low: { text: "var(--c-elev)", bg: "var(--c-elev-bg)", border: "var(--c-elev-border)" },
};

function NewsCard({ item, isSelected, onClick }: { item: CyberNewsItem; isSelected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const sev = SEV_BADGE[item.severityLevel] ?? SEV_BADGE.low;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer"
      style={{
        background: isSelected
          ? "linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))"
          : hovered
            ? "var(--c-card-bg-hover)"
            : "var(--c-card-bg)",
        border: isSelected
          ? "1px solid var(--c-accent-border)"
          : hovered
            ? "1px solid var(--c-border-1)"
            : "1px solid var(--c-border-3)",
        borderRadius: "var(--c-radius-sm)",
        padding: "13px 15px",
        boxShadow: isSelected ? "0 0 0 1px var(--c-accent-bg-soft), 0 10px 28px rgba(0,0,0,0.35)" : "none",
        transform: hovered && !isSelected ? "translateX(2px)" : "translateX(0)",
        transition: "background 150ms ease, border-color 150ms ease, transform 150ms ease",
      }}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <span
          className="absolute"
          style={{
            left: 0,
            top: 12,
            bottom: 12,
            width: "2.5px",
            background: "var(--c-accent)",
            borderRadius: "0 3px 3px 0",
            boxShadow: "0 0 9px var(--c-accent-glow)",
          }}
        />
      )}

      {/* Title */}
      <p
        className="c-disp"
        style={{ fontSize: "var(--c-fs-md)", fontWeight: 500, lineHeight: 1.36, color: "var(--c-t1)", marginBottom: 7 }}
      >
        {item.headline}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-[7px]" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: "var(--c-fs-xs)", fontWeight: 600, color: "var(--c-silver)" }}>{item.source}</span>
        <span style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "var(--c-t6)" }} />
        <span className="c-mono" style={{ fontSize: "var(--c-fs-xs)", color: "var(--c-t5)" }}>{item.timeAgo}</span>
      </div>

      {/* Summary */}
      <p style={{ fontSize: "var(--c-fs-base)", lineHeight: 1.5, color: "var(--c-t4)", marginBottom: 10 }}>
        {item.summary}
      </p>

      {/* Badges */}
      <div className="flex items-center gap-[6px]">
        <span
          className="c-disp"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2.5px 7px",
            borderRadius: "var(--c-radius-xs)",
            fontSize: "var(--c-fs-2xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--c-elev)",
            background: "var(--c-elev-bg)",
            border: "1px solid var(--c-elev-border)",
            whiteSpace: "nowrap",
          }}
        >
          {item.categoryTag}
        </span>
        <span
          className="c-disp"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2.5px 7px",
            borderRadius: "var(--c-radius-xs)",
            fontSize: "var(--c-fs-2xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: sev.text,
            background: sev.bg,
            border: `1px solid ${sev.border}`,
            whiteSpace: "nowrap",
          }}
        >
          {item.severityTag}
        </span>
      </div>
    </div>
  );
}

export function CyberNewsPanel({ selectedNewsId, onSelectNews }: { selectedNewsId: string; onSelectNews: (id: string) => void }) {
  return (
    <div className="cyber-panel h-full">
      {/* Header */}
      <div className="cyber-panel-head">
        <div className="flex items-center gap-[9px]">
          <Newspaper size={15} style={{ color: "var(--c-silver-dim)" }} />
          <span className="cyber-panel-title">Cyber Security News</span>
        </div>
        <div className="cyber-live-pill">
          <span className="dot" />
          Live
        </div>
      </div>

      {/* Feed */}
      <div className="tm-scrollbar cyber-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-2" style={{ padding: 9 }}>
        {cyberNewsItems.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            isSelected={item.id === selectedNewsId}
            onClick={() => onSelectNews(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
