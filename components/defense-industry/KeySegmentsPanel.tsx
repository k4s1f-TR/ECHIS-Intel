"use client";
import { useMemo } from "react";
import { Layers } from "lucide-react";
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
        style={{ width: 14, fontFamily: "var(--font-num)", fontSize: "var(--fs-xs)", color: "var(--c-t6)", fontWeight: 600, textAlign: "right" }}
      >
        {item.rank}
      </span>
      <span
        className="flex-shrink-0"
        style={{ width: 110, fontSize: "var(--fs-base)", color: "var(--c-t2)", fontWeight: 500 }}
      >
        {item.segment}
      </span>
      <div className="flex-1 h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--c-accent-2), var(--c-accent))",
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-num)",
          fontSize: "var(--fs-base)",
          fontWeight: 600,
          color: "var(--c-t2)",
          fontVariantNumeric: "tabular-nums",
          width: 40,
          textAlign: "right",
        }}
      >
        {item.count.toLocaleString()}
      </span>
      <div className="flex items-center justify-end flex-shrink-0" style={{ width: 50 }}>
        <span
          style={{
            fontFamily: "var(--font-num)",
            fontSize: "var(--fs-xs)",
            fontWeight: 500,
            color: positive ? "var(--c-accent-text)" : "var(--c-silver-dim)",
          }}
        >
          {positive ? "+" : "−"}
          {Math.abs(item.change)}%
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
            fontFamily: "var(--font-disp)",
            fontSize: "var(--fs-sm)",
            fontWeight: 600,
            color: "var(--c-t4)",
            letterSpacing: "0.14em",
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
