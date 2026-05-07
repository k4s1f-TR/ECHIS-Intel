"use client";
import { Target } from "lucide-react";

export function AffectedSectorsPanel() {
  const sectors = [
    { name: "Energy", score: 92, status: "Critical", color: "rgba(239,68,68,0.85)", track: "rgba(239,68,68,0.15)" },
    { name: "Telecommunications", score: 84, status: "High", color: "rgba(249,115,22,0.85)", track: "rgba(249,115,22,0.15)" },
    { name: "Finance", score: 76, status: "High", color: "rgba(249,115,22,0.85)", track: "rgba(249,115,22,0.15)" },
    { name: "Government", score: 63, status: "Elevated", color: "rgba(74,222,128,0.85)", track: "rgba(74,222,128,0.15)" },
    { name: "Manufacturing", score: 58, status: "Elevated", color: "rgba(74,222,128,0.85)", track: "rgba(74,222,128,0.15)" },
    { name: "Healthcare", score: 41, status: "Elevated", color: "rgba(74,222,128,0.85)", track: "rgba(74,222,128,0.15)" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "rgba(7,8,11,0.985)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0 px-3.5 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
        <Target size={12} style={{ color: "rgba(74,222,128,0.28)" }} />
        <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(155,170,180,0.88)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Affected Sectors / Exposure</span>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-3.5 cyber-scrollbar">
        {sectors.map((sec, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-end justify-between">
              <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(195,210,220,0.85)" }}>{sec.name}</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "8px", fontWeight: 600, color: sec.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{sec.status}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.8)", fontVariantNumeric: "tabular-nums", minWidth: "24px", textAlign: "right" }}>{sec.score}%</span>
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
