"use client";
import { Target } from "lucide-react";

export function AffectedSectorsPanel() {
  const sectors = [
    { name: "Energy", score: 92, status: "Critical", color: "rgba(239,68,68,0.85)", track: "rgba(239,68,68,0.15)" },
    { name: "Telecommunications", score: 84, status: "High", color: "rgba(249,115,22,0.85)", track: "rgba(249,115,22,0.15)" },
    { name: "Finance", score: 76, status: "High", color: "rgba(249,115,22,0.85)", track: "rgba(249,115,22,0.15)" },
    { name: "Government", score: 63, status: "Elevated", color: "rgba(190,196,206,0.85)", track: "rgba(190,196,206,0.12)" },
    { name: "Manufacturing", score: 58, status: "Elevated", color: "rgba(190,196,206,0.85)", track: "rgba(190,196,206,0.12)" },
    { name: "Healthcare", score: 41, status: "Elevated", color: "rgba(190,196,206,0.85)", track: "rgba(190,196,206,0.12)" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px rgba(0,0,0,0.35)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0 px-3.5 py-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Target size={12} style={{ color: "var(--silver-dim)" }} />
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Affected Sectors / Exposure</span>
      </div>
      
      {/* Content */}
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-3.5 cyber-scrollbar">
        {sectors.map((sec, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-end justify-between">
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-body)" }}>{sec.name}</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "var(--fs-2xs)", fontWeight: 600, color: sec.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{sec.status}</span>
                <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", minWidth: "24px", textAlign: "right" }}>{sec.score}%</span>
              </div>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: "3px", background: sec.track }}>
              <div className="h-full rounded-full" style={{ width: `${sec.score}%`, background: sec.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
