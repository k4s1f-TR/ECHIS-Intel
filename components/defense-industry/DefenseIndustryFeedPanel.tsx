"use client";
import { useState } from "react";
import { Factory } from "lucide-react";
import { defenseFeedItems, type DefenseFeedItem } from "@/data/defenseIndustryMockData";

const PRIORITY: Record<string, { text: string; bg: string; border: string }> = {
  elevated: { text: "rgba(249,115,22,0.9)", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)" },
  high: { text: "rgba(234,179,8,0.9)", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.3)" },
  medium: { text: "var(--text-secondary)", bg: "rgba(100,120,140,0.08)", border: "rgba(100,120,140,0.25)" },
  low: { text: "var(--text-muted)", bg: "rgba(100,100,100,0.06)", border: "rgba(100,100,100,0.22)" },
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
          ? "var(--bg-surface-active)"
          : hovered
          ? "var(--bg-surface-hover)"
          : "var(--bg-surface)",
        border: isSelected
          ? "1px solid rgba(165,180,195,0.32)"
          : hovered
          ? "1px solid var(--border-hover)"
          : "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px 10px 14px",
        marginBottom: "6px",
        transition: "all 120ms ease",
      }}
    >
      {isSelected && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px]"
          style={{ background: "rgba(180,195,210,0.75)", borderRadius: "7px 0 0 7px" }}
        />
      )}
      <p
        className="line-clamp-2 leading-snug mb-1.5"
        style={{
          fontSize: "var(--fs-base)",
          fontWeight: 600,
          color: hovered ? "var(--text-heading)" : "var(--text-body)",
        }}
      >
        {item.headline}
      </p>
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>{item.source}</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>•</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)" }}>{item.timeAgo}</span>
      </div>
      <p
        className="mb-2.5 leading-relaxed"
        style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}
      >
        {item.summary}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            fontSize: "var(--fs-2xs)",
            fontWeight: 600,
            color: "var(--text-body)",
            background: "var(--border-subtle)",
            border: "1px solid var(--border-primary)",
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
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        <div className="flex items-center gap-2">
          <Factory size={12} style={{ color: "var(--icon-default)" }} />
          <span
            style={{
              fontSize: "var(--fs-sm)",
              fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Defense Industry Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(160,180,200,0.5)" }} />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)", fontWeight: 600 }}>OSINT</span>
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
