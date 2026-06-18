"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import { cyberNewsItems, type CyberNewsItem } from "@/data/cyberMockData";

const SEV: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "var(--sev-critical-text)", bg: "var(--sev-critical-bg)", border: "var(--sev-critical-border)" },
  high: { text: "var(--sev-high-text)", bg: "var(--sev-high-bg)", border: "var(--sev-high-border)" },
  medium: { text: "var(--sev-medium-text)", bg: "var(--sev-medium-bg)", border: "var(--sev-medium-border)" },
  low: { text: "var(--sev-low-text)", bg: "var(--sev-low-bg)", border: "var(--sev-low-border)" },
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
        background: isSelected ? "linear-gradient(180deg, rgba(225,40,52,0.08), rgba(225,40,52,0.02))" : hovered ? "var(--bg-surface-hover)" : "var(--bg-surface)",
        border: isSelected ? "1px solid var(--accent-blue-border)" : hovered ? "1px solid var(--border-hover)" : "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px 10px 14px",
        marginBottom: "6px",
        transition: "all 120ms ease",
      }}
    >
      {/* Active Selection Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: "var(--accent-blue-text)", borderRadius: "var(--radius-md) 0 0 var(--radius-md)" }} />
      )}
      {/* Headline */}
      <p className="line-clamp-2 leading-snug mb-1.5" style={{ fontSize: "var(--fs-base)", fontWeight: 600, color: hovered ? "var(--text-heading)" : "var(--text-body)" }}>
        {item.headline}
      </p>
      {/* Source / time */}
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>{item.source}</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>•</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-tertiary)" }}>{item.timeAgo}</span>
      </div>
      {/* Summary */}
      <p className="mb-2.5 leading-relaxed" style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
        {item.summary}
      </p>
      {/* Tags */}
      <div className="flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: "var(--fs-2xs)", fontWeight: 600, color: "var(--silver)", background: "var(--silver-bg)", border: "1px solid var(--silver-border)" }}>
          {item.categoryTag}
        </span>
        <span className="px-1.5 py-0.5 rounded uppercase" style={{ fontSize: "var(--fs-2xs)", fontWeight: 700, background: sev.bg, color: sev.text, border: `1px solid ${sev.border}` }}>
          {item.severityTag}
        </span>
      </div>
    </div>
  );
}

export function CyberNewsPanel({ selectedNewsId, onSelectNews }: { selectedNewsId: string; onSelectNews: (id: string) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px rgba(0,0,0,0.35)" }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <div className="flex items-center gap-2">
          <Shield size={12} style={{ color: "var(--silver-dim)" }} />
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Cyber Security News</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--sev-critical-text)", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--sev-critical-text)", fontWeight: 600 }}>LIVE</span>
        </div>
      </div>
      {/* Feed */}
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-2.5 py-2 cyber-scrollbar">
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
