"use client";
import { useEffect, useMemo, useRef } from "react";
import { Globe } from "lucide-react";
import { cyberRegionMentions, type CyberRegionMention } from "@/data/cyberMockData";

function RegionRow({ item, index, maxCount }: { item: CyberRegionMention; index: number; maxCount: number }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const pct = (item.count / maxCount) * 100;
  const positive = item.change >= 0;

  // Count-up on load (~1s ease-out cubic). Base render already holds the final
  // value (SSR-correct); the effect only animates when motion is allowed.
  useEffect(() => {
    const node = valueRef.current;
    if (!node) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const target = item.count;
    const dur = 1000;
    const delay = 120 + index * 70;
    const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
    const startTimer = window.setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        node.textContent = fmt(target * e);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(startTimer);
      cancelAnimationFrame(raf);
      node.textContent = fmt(target);
    };
  }, [item.count, index]);

  return (
    <div
      className="grid items-center"
      style={{ gridTemplateColumns: "18px 1fr auto", gap: 10, padding: "4.5px 9px", borderRadius: "var(--c-radius-sm)" }}
    >
      <span className="c-mono" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 600, color: "var(--c-t6)", textAlign: "center" }}>
        {item.rank}
      </span>
      <div className="min-w-0">
        <div style={{ fontSize: "var(--c-fs-base)", fontWeight: 500, color: "var(--c-t2)", marginBottom: 3 }}>{item.region}</div>
        <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct.toFixed(1)}%`, borderRadius: 999, background: "linear-gradient(90deg, var(--c-accent-2), var(--c-accent))" }} />
        </div>
      </div>
      <div className="flex items-center gap-[9px]">
        <span ref={valueRef} className="c-mono" style={{ fontSize: "var(--c-fs-base)", fontWeight: 600, color: "var(--c-t2)" }}>
          {item.count.toLocaleString("en-US")}
        </span>
        <span className="c-mono" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 500, color: positive ? "var(--c-accent-text)" : "var(--c-silver-dim)" }}>
          {positive ? "+" : "−"}{Math.abs(item.change)}%
        </span>
      </div>
    </div>
  );
}

export function MostMentionedRegionsPanel() {
  const maxCount = useMemo(() => Math.max(...cyberRegionMentions.map((r) => r.count)), []);
  return (
    <div className="cyber-panel h-full">
      <div className="cyber-panel-head">
        <div className="flex items-center gap-[9px]">
          <Globe size={15} style={{ color: "var(--c-silver-dim)" }} />
          <span className="cyber-panel-title">Most Mentioned Regions</span>
        </div>
      </div>
      <div className="tm-scrollbar cyber-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ padding: "7px 6px" }}>
        {cyberRegionMentions.map((r, i) => (
          <RegionRow key={r.region} item={r} index={i} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}
