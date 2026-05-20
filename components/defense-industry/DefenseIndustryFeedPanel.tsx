"use client";
import { useState } from "react";
import { Factory } from "lucide-react";
import { defenseFeedItems, type DefenseFeedItem } from "@/data/defenseIndustryMockData";

const PRIORITY: Record<string, { text: string; bg: string; border: string }> = {
  elevated: { text: "rgba(249,115,22,0.9)", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)" },
  high: { text: "rgba(234,179,8,0.9)", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.3)" },
  medium: { text: "rgba(140,165,190,0.85)", bg: "rgba(100,120,140,0.08)", border: "rgba(100,120,140,0.25)" },
  low: { text: "rgba(140,140,140,0.85)", bg: "rgba(100,100,100,0.06)", border: "rgba(100,100,100,0.22)" },
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
          ? "rgba(255,255,255,0.05)"
          : hovered
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.015)",
        border: isSelected
          ? "1px solid rgba(165,180,195,0.32)"
          : hovered
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(255,255,255,0.04)",
        borderRadius: "7px",
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
          fontSize: "11.5px",
          fontWeight: 600,
          color: hovered ? "rgba(220,235,245,0.97)" : "rgba(195,210,220,0.88)",
        }}
      >
        {item.headline}
      </p>
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ fontSize: "9.5px", color: "rgba(110,125,140,0.8)", fontWeight: 500 }}>{item.source}</span>
        <span style={{ fontSize: "9px", color: "rgba(80,90,100,0.5)" }}>•</span>
        <span style={{ fontSize: "9.5px", color: "rgba(100,115,130,0.7)" }}>{item.timeAgo}</span>
      </div>
      <p
        className="mb-2.5 leading-relaxed"
        style={{ fontSize: "10.5px", color: "rgba(145,160,175,0.75)", lineHeight: 1.55 }}
      >
        {item.summary}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            fontSize: "8px",
            fontWeight: 600,
            color: "rgba(180,195,210,0.85)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {item.activityType}
        </span>
        <span
          className="px-1.5 py-0.5 rounded uppercase"
          style={{
            fontSize: "8px",
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
        background: "rgba(7,8,11,0.985)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <div className="flex items-center gap-2">
          <Factory size={12} style={{ color: "rgba(165,180,195,0.4)" }} />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "rgba(155,170,180,0.88)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Defense Industry Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(160,180,200,0.5)" }} />
          <span style={{ fontSize: "9px", color: "rgba(165,180,195,0.55)", fontWeight: 600 }}>OSINT</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 cyber-scrollbar">
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
