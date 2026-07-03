"use client";
import { Boxes } from "lucide-react";
import { defenseSupplyChainPressure } from "@/data/defenseIndustryMockData";
import type { DefenseSupplyChainMetric } from "@/lib/defense";

const STATUS_COLOR: Record<string, { tag: string; fill: string }> = {
  Critical: { tag: "var(--c-crit)", fill: "linear-gradient(90deg, var(--c-accent-2), var(--c-crit))" },
  High: { tag: "var(--c-high)", fill: "linear-gradient(90deg, var(--c-accent-2), var(--c-high))" },
  Elevated: { tag: "var(--c-elev)", fill: "linear-gradient(90deg, rgba(150,160,172,0.3), var(--c-elev))" },
  Moderate: { tag: "var(--c-elev)", fill: "linear-gradient(90deg, rgba(150,160,172,0.3), var(--c-elev))" },
};

export function SupplyChainPressurePanel({ rows }: { rows?: DefenseSupplyChainMetric[] }) {
  const data = rows && rows.length > 0 ? rows : defenseSupplyChainPressure;
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 flex-shrink-0 px-3.5 py-2"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <Boxes size={12} style={{ color: "var(--c-silver-dim)" }} />
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
          Supply Chain Pressure
        </span>
      </div>
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-3.5 defense-scrollbar">
        {data.map((row) => {
          const tone = STATUS_COLOR[row.status] ?? STATUS_COLOR.Moderate;
          return (
            <div key={row.name} className="flex flex-col gap-1.5">
              <div className="flex items-end justify-between">
                <span style={{ fontSize: "var(--fs-base)", fontWeight: 500, color: "var(--c-t3)" }}>
                  {row.name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontFamily: "var(--font-disp)",
                      fontSize: "var(--fs-2xs)",
                      fontWeight: 600,
                      color: tone.tag,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                    }}
                  >
                    {row.status}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-num)",
                      fontSize: "var(--fs-md)",
                      fontWeight: 600,
                      color: "var(--c-t2)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: "24px",
                      textAlign: "right",
                    }}
                  >
                    {row.score}%
                  </span>
                </div>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: "5px", background: "rgba(255,255,255,0.045)" }}>
                <div className="h-full rounded-full" style={{ width: `${row.score}%`, background: tone.fill }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
