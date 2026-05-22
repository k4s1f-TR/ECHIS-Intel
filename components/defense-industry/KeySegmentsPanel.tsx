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
      style={{ borderBottom: "1px solid rgba(255,255,255,0.025)" }}
    >
      <span
        className="flex-shrink-0"
        style={{ width: 14, fontSize: "9px", color: "rgba(100,115,130,0.5)", fontWeight: 600, textAlign: "right" }}
      >
        {item.rank}
      </span>
      <span
        className="flex-shrink-0"
        style={{ width: 110, fontSize: "10px", color: "rgba(175,190,200,0.85)", fontWeight: 500 }}
      >
        {item.segment}
      </span>
      <div className="flex-1 h-[4px] rounded-full" style={{ background: "rgba(160,180,200,0.05)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(160,180,200,0.28), rgba(195,210,225,0.55))",
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          color: "rgba(195,210,220,0.85)",
          fontVariantNumeric: "tabular-nums",
          width: 40,
          textAlign: "right",
        }}
      >
        {item.count.toLocaleString()}
      </span>
      <div className="flex items-center gap-0.5 flex-shrink-0" style={{ width: 50 }}>
        {positive ? (
          <TrendingUp size={9} style={{ color: "rgba(160,200,180,0.85)" }} />
        ) : (
          <TrendingDown size={9} style={{ color: "rgba(220,140,120,0.8)" }} />
        )}
        <span
          style={{
            fontSize: "9px",
            fontWeight: 600,
            color: positive ? "rgba(160,200,180,0.85)" : "rgba(220,140,120,0.8)",
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
        background: "rgba(7,8,11,0.985)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 flex-shrink-0 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <Layers size={11} style={{ color: "rgba(165,180,195,0.4)" }} />
        <span
          style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "rgba(155,170,180,0.88)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Key Segments
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-1 defense-scrollbar">
        {defenseKeySegments.map((s) => (
          <SegmentRow key={s.segment} item={s} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}
