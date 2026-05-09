"use client";

const CARDS = [
  {
    label: "Active Agencies",
    value: "47",
    delta: "+5 vs yesterday",
    positive: true,
    data: [38, 40, 39, 42, 41, 43, 45, 47],
  },
  {
    label: "New Mentions Today",
    value: "1,246",
    delta: "+18% vs yesterday",
    positive: true,
    data: [820, 890, 950, 1020, 1100, 1080, 1190, 1246],
  },
  {
    label: "High-Interest Regions",
    value: "12",
    delta: "+2 vs yesterday",
    positive: true,
    data: [8, 8, 9, 10, 10, 11, 11, 12],
  },
  {
    label: "Total Reports",
    value: "18,657",
    delta: "+9% vs yesterday",
    positive: true,
    data: [15200, 15900, 16300, 16800, 17200, 17600, 18100, 18657],
  },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 60;
  const h = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 2) - 1,
  ]);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function IntelWatchKpiCards() {
  return (
    <div
      className="flex gap-2.5 flex-shrink-0"
      style={{ padding: "10px 12px 0" }}
    >
      {CARDS.map((card) => (
        <div
          key={card.label}
          className="flex flex-col justify-between flex-1 min-w-0"
          style={{
            background: "rgba(10,12,18,0.97)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px",
            padding: "10px 13px",
            minHeight: "82px",
          }}
        >
          <span
            style={{
              fontSize: "9.5px",
              fontWeight: 600,
              color: "rgba(120,135,155,0.85)",
              letterSpacing: "0.09em",
              textTransform: "uppercase",
            }}
          >
            {card.label}
          </span>

          <div className="flex items-end justify-between gap-2 mt-1">
            <div className="flex flex-col gap-0.5">
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "rgba(220,228,240,0.97)",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {card.value}
              </span>
              <span
                className="flex items-center gap-0.5"
                style={{
                  fontSize: "10px",
                  color: card.positive
                    ? "rgba(74,222,128,0.85)"
                    : "rgba(239,68,68,0.85)",
                }}
              >
                {card.positive ? "▲" : "▼"} {card.delta}
              </span>
            </div>
            <Sparkline
              data={card.data}
              color={
                card.positive ? "rgba(74,222,128,0.65)" : "rgba(239,68,68,0.65)"
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
