"use client";
import { Boxes } from "lucide-react";
import { defenseSupplyChainPressure } from "@/data/defenseIndustryMockData";

const STATUS_COLOR: Record<string, { color: string; track: string }> = {
  Critical: { color: "rgba(239,140,90,0.85)", track: "rgba(239,140,90,0.14)" },
  High: { color: "rgba(218,175,22,0.85)", track: "rgba(218,175,22,0.14)" },
  Elevated: { color: "rgba(160,180,200,0.8)", track: "rgba(160,180,200,0.12)" },
  Moderate: { color: "rgba(130,145,160,0.7)", track: "rgba(130,145,160,0.1)" },
};

export function SupplyChainPressurePanel() {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "rgba(7,8,11,0.985)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 flex-shrink-0 px-3.5 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <Boxes size={12} style={{ color: "rgba(165,180,195,0.4)" }} />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "rgba(155,170,180,0.88)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Supply Chain Pressure
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-3.5 cyber-scrollbar">
        {defenseSupplyChainPressure.map((row) => {
          const tone = STATUS_COLOR[row.status] ?? STATUS_COLOR.Moderate;
          return (
            <div key={row.name} className="flex flex-col gap-1.5">
              <div className="flex items-end justify-between">
                <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(195,210,220,0.85)" }}>
                  {row.name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontSize: "8px",
                      fontWeight: 600,
                      color: tone.color,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {row.status}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.8)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: "24px",
                      textAlign: "right",
                    }}
                  >
                    {row.score}%
                  </span>
                </div>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: "3px", background: tone.track }}>
                <div className="h-full rounded-full" style={{ width: `${row.score}%`, background: tone.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
