"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import { cyberNewsItems, type CyberNewsItem } from "@/data/cyberMockData";

const SEV: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "rgba(239,68,68,0.95)", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.35)" },
  high: { text: "rgba(249,115,22,0.95)", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.35)" },
  medium: { text: "rgba(234,179,8,0.95)", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.35)" },
  low: { text: "rgba(140,140,140,0.9)", bg: "rgba(100,100,100,0.08)", border: "rgba(100,100,100,0.25)" },
};

function NewsCard({ item, isSelected, onClick }: { item: CyberNewsItem; isSelected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const sev = SEV[item.severityLevel] ?? SEV.low;
  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isSelected ? "rgba(255,255,255,0.05)" : hovered ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        border: isSelected ? "1px solid rgba(74,222,128,0.35)" : hovered ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.04)",
        borderRadius: "7px",
        padding: "10px 12px 10px 14px",
        marginBottom: "6px",
        transition: "all 120ms ease",
      }}
    >
      {/* Active Selection Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: "rgba(74,222,128,0.8)", borderRadius: "7px 0 0 7px" }} />
      )}
      {/* Headline */}
      <p className="line-clamp-2 leading-snug mb-1.5" style={{ fontSize: "11.5px", fontWeight: 600, color: hovered ? "rgba(220,235,245,0.97)" : "rgba(195,210,220,0.88)" }}>
        {item.headline}
      </p>
      {/* Source / time */}
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ fontSize: "9.5px", color: "rgba(110,125,140,0.8)", fontWeight: 500 }}>{item.source}</span>
        <span style={{ fontSize: "9px", color: "rgba(80,90,100,0.5)" }}>•</span>
        <span style={{ fontSize: "9.5px", color: "rgba(100,115,130,0.7)" }}>{item.timeAgo}</span>
      </div>
      {/* Summary */}
      <p className="mb-2.5 leading-relaxed" style={{ fontSize: "10.5px", color: "rgba(145,160,175,0.75)", lineHeight: 1.55 }}>
        {item.summary}
      </p>
      {/* Tags */}
      <div className="flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "8px", fontWeight: 600, color: "rgba(74,222,128,0.9)", background: "rgba(20,83,45,0.22)", border: "1px solid rgba(34,197,94,0.25)" }}>
          {item.categoryTag}
        </span>
        <span className="px-1.5 py-0.5 rounded uppercase" style={{ fontSize: "8px", fontWeight: 700, background: sev.bg, color: sev.text, border: `1px solid ${sev.border}` }}>
          {item.severityTag}
        </span>
      </div>
    </div>
  );
}

export function CyberNewsPanel({ selectedNewsId, onSelectNews }: { selectedNewsId: string; onSelectNews: (id: string) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "rgba(7,8,11,0.985)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
        <div className="flex items-center gap-2">
          <Shield size={12} style={{ color: "rgba(74,222,128,0.28)" }} />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(155,170,180,0.88)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Cyber Security News</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(56,189,100,0.72)", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "9px", color: "rgba(74,222,128,0.5)", fontWeight: 600 }}>LIVE</span>
        </div>
      </div>
      {/* Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 cyber-scrollbar">
        {cyberNewsItems.map(item => (
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
