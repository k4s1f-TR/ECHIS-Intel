"use client";
import { useState } from "react";
import { Factory } from "lucide-react";
import { defenseFeedItems, type DefenseFeedItem } from "@/data/defenseIndustryMockData";

const PRIORITY: Record<string, { text: string; bg: string; border: string }> = {
  elevated: { text: "var(--c-high)", bg: "var(--c-high-bg)", border: "var(--c-high-border)" },
  high: { text: "var(--c-med)", bg: "var(--c-med-bg)", border: "var(--c-med-border)" },
  medium: { text: "var(--c-elev)", bg: "var(--c-elev-bg)", border: "var(--c-elev-border)" },
  low: { text: "var(--c-t5)", bg: "rgba(255,255,255,0.045)", border: "var(--c-border-1)" },
};

function FeedCard({
  item,
  isSelected,
  onClick,
}: {
  item: DefenseFeedItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pri = PRIORITY[item.priority] ?? PRIORITY.low;
  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        padding: "10px 12px 10px 14px",
        marginBottom: "6px",
        boxShadow: isSelected ? "0 0 0 1px var(--c-accent-bg-soft), 0 10px 28px rgba(0,0,0,0.35)" : "none",
        transform: hovered && !isSelected ? "translateX(2px)" : "translateX(0)",
        transition: "background 150ms ease, border-color 150ms ease, transform 150ms ease",
      }}
    >
      {isSelected && (
        <div
          className="absolute left-0 top-3 bottom-3 w-[2.5px]"
          style={{ background: "var(--c-accent)", borderRadius: "0 3px 3px 0", boxShadow: "0 0 9px var(--c-accent-glow)" }}
        />
      )}
      <p
        className="line-clamp-2 leading-snug mb-1.5"
        style={{
          fontSize: "var(--fs-base)",
          fontWeight: 600,
          color: isSelected || hovered ? "var(--c-t1)" : "var(--c-t3)",
        }}
      >
        {item.headline}
      </p>
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-silver)", fontWeight: 500 }}>{item.source}</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>•</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-t5)" }}>{item.timeAgo}</span>
      </div>
      <p
        className="mb-2.5 leading-relaxed"
        style={{ fontSize: "var(--fs-sm)", color: "var(--c-t4)", lineHeight: 1.55 }}
      >
        {item.summary}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            fontSize: "var(--fs-2xs)",
            fontWeight: 600,
            color: "var(--c-elev)",
            background: "var(--c-elev-bg)",
            border: "1px solid var(--c-elev-border)",
          }}
        >
          {item.activityType}
        </span>
        <span
          className="px-1.5 py-0.5 rounded uppercase"
          style={{
            fontSize: "var(--fs-2xs)",
            fontWeight: 700,
            background: pri.bg,
            color: pri.text,
            border: `1px solid ${pri.border}`,
          }}
        >
          {item.priority}
        </span>
      </div>
    </div>
  );
}

export function DefenseIndustryFeedPanel({
  selectedItemId,
  onSelectItem,
}: {
  selectedItemId: string;
  onSelectItem: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <div className="flex items-center gap-2">
          <Factory size={12} style={{ color: "var(--c-silver-dim)" }} />
          <span
            style={{
              fontSize: "var(--fs-sm)",
              fontWeight: 700,
              color: "var(--c-t4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Defense Industry Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-accent)", boxShadow: "0 0 7px var(--c-accent-glow)" }} />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-t5)", fontWeight: 600 }}>OSINT</span>
        </div>
      </div>
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-2.5 py-2 defense-scrollbar">
        {defenseFeedItems.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            isSelected={item.id === selectedItemId}
            onClick={() => onSelectItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
