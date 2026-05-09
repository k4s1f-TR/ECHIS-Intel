"use client";

import { signalThemes, regionLabels, regionColors } from "@/data/intel-watch/regions";

const REGION_KEYS = ["na", "eu", "me", "eurasia", "apac"] as const;

export function RegionalSignals() {
  return (
    <div
      className="flex flex-col min-h-0 overflow-hidden"
      style={{
        background: "rgba(10,12,18,0.97)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "8px",
        flex: "0 0 38%",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3.5 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <span
          style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "rgba(140,155,175,0.9)",
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}
        >
          Regional Signals
        </span>

        {/* Region color legend */}
        <div className="flex items-center gap-2.5">
          {REGION_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-1">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: regionColors[k],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "8.5px",
                  color: "rgba(110,125,145,0.75)",
                  fontWeight: 500,
                }}
              >
                {regionLabels[k]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Theme rows */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-3.5 pt-1.5 pb-1 gap-1.5">
        {signalThemes.map((theme) => (
          <div key={theme.label} className="flex flex-col gap-0.5">
            <span
              style={{
                fontSize: "9.5px",
                fontWeight: 500,
                color: "rgba(155,170,190,0.85)",
              }}
            >
              {theme.label}
            </span>
            <div className="flex gap-1 items-center">
              {REGION_KEYS.map((k) => {
                const val = theme.values[k];
                return (
                  <div
                    key={k}
                    title={`${regionLabels[k]}: ${val}`}
                    style={{
                      flex: 1,
                      height: "5px",
                      borderRadius: "2px",
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${val}%`,
                        height: "100%",
                        borderRadius: "2px",
                        background: regionColors[k],
                        opacity: 0.75,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* X-axis label */}
      <div
        className="flex items-center justify-between px-3.5 pb-2 flex-shrink-0"
      >
        <span style={{ fontSize: "8.5px", color: "rgba(80,95,115,0.6)" }}>
          Low
        </span>
        <span
          style={{
            fontSize: "8.5px",
            color: "rgba(80,95,115,0.6)",
            letterSpacing: "0.04em",
          }}
        >
          Intensity Level
        </span>
        <span style={{ fontSize: "8.5px", color: "rgba(80,95,115,0.6)" }}>
          High
        </span>
      </div>
    </div>
  );
}
