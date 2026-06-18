"use client";
import { useMemo } from "react";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import { cyberRegionMentions, type CyberRegionMention } from "@/data/cyberMockData";

function RegionRow({ item, maxCount }: { item: CyberRegionMention; maxCount: number }) {
  const pct = (item.count / maxCount) * 100;
  const positive = item.change >= 0;
  return (
    <div className="flex items-center gap-2 py-[5px]" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="flex-shrink-0" style={{ width: 14, fontSize: "var(--fs-xs)", color: "var(--text-dim)", fontWeight: 600, textAlign: "right" }}>
        {item.rank}
      </span>
      <span className="flex-shrink-0" style={{ width: 90, fontSize: "var(--fs-sm)", color: "var(--text-body)", fontWeight: 500 }}>
        {item.region}
      </span>
      <div className="flex-1 h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, rgba(150,158,170,0.35), var(--silver))", transition: "width 300ms ease" }} />
      </div>
      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-body)", fontVariantNumeric: "tabular-nums", width: 36, textAlign: "right" }}>
        {item.count.toLocaleString()}
      </span>
      <div className="flex items-center gap-0.5 flex-shrink-0" style={{ width: 50 }}>
        {positive ? <TrendingUp size={9} style={{ color: "var(--silver)" }} /> : <TrendingDown size={9} style={{ color: "var(--sev-critical-text)" }} />}
        <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: positive ? "var(--silver)" : "var(--sev-critical-text)" }}>
          {positive ? "+" : ""}{item.change}%
        </span>
      </div>
    </div>
  );
}

export function MostMentionedRegionsPanel() {
  const maxCount = useMemo(() => Math.max(...cyberRegionMentions.map(r => r.count)), []);
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px rgba(0,0,0,0.35)" }}>
      <div className="flex items-center gap-2 flex-shrink-0 px-3 py-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Globe size={11} style={{ color: "var(--silver-dim)" }} />
        <span style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Most Mentioned Regions</span>
      </div>
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-2.5 py-1 cyber-scrollbar">
        {cyberRegionMentions.map(r => <RegionRow key={r.region} item={r} maxCount={maxCount} />)}
      </div>
    </div>
  );
}
