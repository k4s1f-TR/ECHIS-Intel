"use client";

const TOP_AGENCIES = [
  { name: "CIA", value: 312 },
  { name: "MI6", value: 278 },
  { name: "FSB", value: 245 },
  { name: "Mossad", value: 198 },
  { name: "MİT", value: 153 },
];
const MAX_VAL = 320;

export function AgencyActivity() {
  return (
    <div
      className="flex flex-col min-h-0 overflow-hidden"
      style={{
        background: "rgba(10,12,18,0.97)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "8px",
        flex: "0 0 18%",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            style={{
              fontSize: "9.5px",
              fontWeight: 700,
              color: "rgba(140,155,175,0.9)",
              letterSpacing: "0.09em",
              textTransform: "uppercase",
            }}
          >
            Agency Activity
          </span>
          <span
            style={{
              fontSize: "9px",
              color: "rgba(100,115,135,0.7)",
              cursor: "default",
            }}
            title="Top agencies by mention volume in the last 7 days"
          >
            (i)
          </span>
        </div>
        <button
          style={{
            fontSize: "9px",
            color: "rgba(74,222,128,0.8)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          View All
        </button>
      </div>

      {/* Subtitle */}
      <div className="px-3 pt-2 flex-shrink-0">
        <span
          style={{
            fontSize: "9px",
            color: "rgba(90,105,125,0.75)",
            letterSpacing: "0.04em",
          }}
        >
          Activity Level (Last 7 Days)
        </span>
      </div>

      {/* Agency rows */}
      <div className="flex flex-col gap-1.5 px-3 pt-2 pb-1 flex-1 min-h-0 overflow-hidden">
        {TOP_AGENCIES.map((agency) => {
          const pct = (agency.value / MAX_VAL) * 100;
          return (
            <div key={agency.name} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 500,
                    color: "rgba(195,208,225,0.9)",
                  }}
                >
                  {agency.name}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "rgba(140,155,175,0.75)",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {agency.value}
                </span>
              </div>
              <div
                style={{
                  height: "3px",
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: "2px",
                    background: "rgba(96,165,250,0.55)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="px-3 py-2 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.045)" }}
      >
        <span style={{ fontSize: "9.5px", color: "rgba(80,95,115,0.75)" }}>
          + 42 more agencies
        </span>
      </div>
    </div>
  );
}
