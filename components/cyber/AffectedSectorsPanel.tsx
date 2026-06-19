"use client";
import { Activity } from "lucide-react";

type Sector = { label: string; pct: number; tag: string; cls: "crit" | "high" | "elev" };

const SECTORS: Sector[] = [
  { label: "Energy", pct: 92, tag: "Critical", cls: "crit" },
  { label: "Telecommunications", pct: 84, tag: "High", cls: "high" },
  { label: "Finance", pct: 76, tag: "High", cls: "high" },
  { label: "Government", pct: 63, tag: "Elevated", cls: "elev" },
  { label: "Manufacturing", pct: 58, tag: "Elevated", cls: "elev" },
];

const FILL: Record<Sector["cls"], string> = {
  crit: "linear-gradient(90deg, var(--c-accent-2), var(--c-crit))",
  high: "linear-gradient(90deg, var(--c-accent-2), var(--c-high))",
  elev: "linear-gradient(90deg, rgba(150,160,172,0.3), var(--c-elev))",
};

const TAG_COLOR: Record<Sector["cls"], string> = {
  crit: "var(--c-crit)",
  high: "var(--c-high)",
  elev: "var(--c-elev)",
};

export function AffectedSectorsPanel() {
  return (
    <div className="cyber-panel h-full">
      <div className="cyber-panel-head">
        <div className="flex items-center gap-[9px]">
          <Activity size={15} style={{ color: "var(--c-silver-dim)" }} />
          <span className="cyber-panel-title">Affected Sectors</span>
        </div>
      </div>

      <div className="tm-scrollbar cyber-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-[13px]" style={{ padding: "13px 16px" }}>
        {SECTORS.map((s) => (
          <div key={s.label} className="flex flex-col">
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: "var(--c-fs-base)", fontWeight: 500, color: "var(--c-t3)" }}>{s.label}</span>
              <div className="flex items-center gap-[9px]">
                <span className="c-disp" style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: TAG_COLOR[s.cls] }}>
                  {s.tag}
                </span>
                <span className="c-mono" style={{ fontSize: "var(--c-fs-md)", fontWeight: 600, color: "var(--c-t2)" }}>{s.pct}%</span>
              </div>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.045)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.pct}%`, borderRadius: 999, background: FILL[s.cls] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
