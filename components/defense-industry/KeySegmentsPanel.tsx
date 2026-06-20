"use client";
import { useMemo } from "react";
import { Layers, TrendingUp, TrendingDown } from "lucide-react";
import { defenseKeySegments, type DefenseSegmentMention } from "@/data/defenseIndustryMockData";

function SegmentRow({ item, maxCount }: { item: DefenseSegmentMention; maxCount: number }) {
  const pct = (item.count / maxCount) * 100;
  const positive = item.change >= 0;
  return (
    <div
      className="flex items-center gap-2 py-[5px]"
      style={{ borderBottom: "1px solid var(--c-border-3)" }}
    >
      <span
        className="flex-shrink-0"
        style={{ width: 14, fontSize: "var(--fs-xs)", color: "var(--c-t6)", fontWeight: 600, textAlign: "right" }}
      >
        {item.rank}
      </span>
      <span
        className="flex-shrink-0"
        style={{ width: 110, fontSize: "var(--fs-sm)", color: "var(--c-t3)", fontWeight: 500 }}
      >
        {item.segment}
      </span>
      <div className="flex-1 h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.045)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(255,43,61,0.72), rgba(255,122,47,0.62))",
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "var(--fs-sm)",
          fontWeight: 600,
          color: "var(--c-t3)",
          fontVariantNumeric: "tabular-nums",
          width: 40,
          textAlign: "right",
        }}
      >
        {item.count.toLocaleString()}
      </span>
      <div className="flex items-center gap-0.5 flex-shrink-0" style={{ width: 50 }}>
        {positive ? (
          <TrendingUp size={9} style={{ color: "var(--c-med)" }} />
        ) : (
          <TrendingDown size={9} style={{ color: "rgba(220,140,120,0.8)" }} />
        )}
        <span
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            color: positive ? "var(--c-med)" : "var(--c-high)",
          }}
        >
          {positive ? "+" : ""}
          {item.change}%
        </span>
      </div>
    </div>
  );
}

export function KeySegmentsPanel() {
  const maxCount = useMemo(() => Math.max(...defenseKeySegments.map((s) => s.count)), []);
  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 flex-shrink-0 px-3 py-2"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <Layers size={11} style={{ color: "var(--c-silver-dim)" }} />
        <span
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 700,
            color: "var(--c-t4)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Key Segments
        </span>
      </div>
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-2.5 py-1 defense-scrollbar">
        {defenseKeySegments.map((s) => (
          <SegmentRow key={s.segment} item={s} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}
