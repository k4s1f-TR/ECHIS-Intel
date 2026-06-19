"use client";

import { SharedWorldMap2D } from "@/components/map/SharedWorldMap2D";
import { cyberHotspots, cyberAttackIndicators } from "@/data/cyberMockData";

type Severity = "critical" | "high" | "medium" | "low";

/* ── Heat ramp: clearly-stepped red → orange → gold → silver ───── */
const SEV: Record<Severity, { col: string; core: string; glow: string; glowSoft: string }> = {
  critical: { col: "#ff3b42", core: "#ffd2d4", glow: "rgba(255,59,66,0.9)", glowSoft: "rgba(255,59,66,0.10)" },
  high: { col: "#ff7a2f", core: "#ffd9b8", glow: "rgba(255,122,47,0.8)", glowSoft: "rgba(255,122,47,0.10)" },
  medium: { col: "#f1c24f", core: "#fff0c2", glow: "rgba(241,194,79,0.7)", glowSoft: "rgba(241,194,79,0.10)" },
  low: { col: "#9aa3b2", core: "#e6e9ee", glow: "rgba(154,163,178,0.5)", glowSoft: "rgba(154,163,178,0.10)" },
};

/* ── Marker spec: radius + hue + ping both step with severity ───── */
const MK: Record<Severity, { r: number; ping: boolean; spec: boolean }> = {
  critical: { r: 3.0, ping: true, spec: true },
  high: { r: 2.5, ping: true, spec: true },
  medium: { r: 2.1, ping: false, spec: true },
  low: { r: 1.8, ping: false, spec: false },
};

const SIZE_NUM: Record<string, number> = { small: 3, medium: 4, large: 5 };

/* News → map focus coordinates [lng, lat] (kept local; no data-schema change) */
const NEWS_FOCUS: Record<string, [number, number]> = {
  "cn-1": [-97, 38],
  "cn-2": [10, 51],
  "cn-3": [110, 5],
  "cn-4": [8, 25],
  "cn-5": [-100, 40],
};

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

/* Dark continents + crimson coastlines, applied only to this map instance.
   SharedWorldMap2D renders identically for every other consumer (no theme). */
const CYBER_MAP_THEME = {
  land: "#221a1e",
  border: "rgba(255,72,84,0.40)",
  graticule: "rgba(255,72,84,0.04)",
  background: "radial-gradient(120% 100% at 50% 36%, #0c0a0d 0%, #070507 58%, #040305 100%)",
};

export function CyberMap({ focusNewsId }: { focusNewsId?: string }) {
  return (
    <SharedWorldMap2D
      ariaLabel="Cyber Threat world map"
      theme={CYBER_MAP_THEME}
      markerLayer={(project) => {
        const focus = focusNewsId ? NEWS_FOCUS[focusNewsId] : undefined;
        const focusXY = focus ? project(focus[0], focus[1]) : null;

        return (
          <>
            <defs>
              {SEVERITIES.map((s) => {
                const c = SEV[s];
                return (
                  <g key={s}>
                    {/* gem core — lit from top-left */}
                    <radialGradient id={`cyber-core-${s}`} cx="0.35" cy="0.35" r="0.75">
                      <stop offset="0" stopColor={c.core} />
                      <stop offset="1" stopColor={c.col} />
                    </radialGradient>
                    {/* soft glow halo */}
                    <radialGradient id={`cyber-halo-${s}`} cx="0.5" cy="0.5" r="0.5">
                      <stop offset="0" stopColor={c.glow} />
                      <stop offset="0.6" stopColor={c.glowSoft} />
                      <stop offset="1" stopColor="rgba(0,0,0,0)" />
                    </radialGradient>
                  </g>
                );
              })}
            </defs>

            {/* ── Attack comets (screen-space quadratic béziers, no base track) ── */}
            <g aria-hidden="true">
              {cyberAttackIndicators.map((a, index) => {
                const from = project(a.fromLng, a.fromLat);
                const to = project(a.toLng, a.toLat);
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.hypot(dx, dy) || 1;
                // perpendicular, biased upward → graceful overhead arc
                let nx = -dy / len;
                let ny = dx / len;
                if (ny > 0) {
                  nx = -nx;
                  ny = -ny;
                }
                const lift = Math.min(len * 0.32, 130);
                const cx = (from.x + to.x) / 2 + nx * lift;
                const cy = (from.y + to.y) / 2 + ny * lift;
                const d = `M${from.x.toFixed(2)} ${from.y.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
                const sev = SEV[a.severity];
                // de-sync phases (negative delay starts mid-flight → never blank)
                const delay = `-${(index * 0.19).toFixed(2)}s`;
                const dur = `${2400 + (index % 4) * 250}ms`;

                return (
                  <g key={a.id}>
                    <path
                      className="cyber-comet-trail"
                      d={d}
                      pathLength={100}
                      stroke={sev.col}
                      strokeWidth={1.3}
                      style={{ opacity: 0.42, animationDelay: delay, animationDuration: dur, filter: `drop-shadow(0 0 2px ${sev.glow})` }}
                    />
                    <path
                      className="cyber-comet-head"
                      d={d}
                      pathLength={100}
                      stroke={sev.core}
                      strokeWidth={1.1}
                      style={{ opacity: 0.9, animationDelay: delay, animationDuration: dur, filter: `drop-shadow(0 0 3px ${sev.glow})` }}
                    />
                  </g>
                );
              })}
            </g>

            {/* ── Gem markers ── */}
            {cyberHotspots.map((h) => {
              const { x, y } = project(h.lng, h.lat);
              const sev = h.severity as Severity;
              const c = SEV[sev];
              const mk = MK[sev] ?? MK.low;
              const r = mk.r + ((SIZE_NUM[h.size] ?? 3) - 3) * 0.18;
              const seed = ((h.lng * 0.013 + h.lat * 0.019 + 10) % 1 + 1) % 1;

              return (
                <g key={h.id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
                  {/* radar ping — crit/high only, staggered */}
                  {mk.ping && [0, 1].map((k) => (
                    <circle
                      key={k}
                      className="cyber-map-ping"
                      r={r + 1}
                      stroke={c.col}
                      vectorEffect="non-scaling-stroke"
                      style={{ animationDelay: `-${Math.round(seed * 2800 + k * 1400)}ms` }}
                    />
                  ))}

                  {/* soft glow halo */}
                  <circle r={r * 3.4} fill={`url(#cyber-halo-${sev})`} opacity={0.55} />

                  {/* gem core (breathing) */}
                  <circle
                    className="cyber-map-core"
                    r={r}
                    fill={`url(#cyber-core-${sev})`}
                    style={{ animationDelay: `-${Math.round(seed * 3000)}ms` }}
                  />

                  {/* crisp bezel ring */}
                  <circle r={r + 0.6} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />

                  {/* specular highlight */}
                  {mk.spec && <circle cx={-r * 0.34} cy={-r * 0.34} r={r * 0.26} fill="rgba(255,255,255,0.55)" />}
                </g>
              );
            })}

            {/* ── Focus marker (selected news → map focus), replays per selection ── */}
            {focusXY && (
              <g key={focusNewsId} aria-hidden="true" transform={`translate(${focusXY.x.toFixed(2)} ${focusXY.y.toFixed(2)})`}>
                <circle className="cyber-focus-ring" r={6} vectorEffect="non-scaling-stroke" />
                <path
                  className="cyber-focus-cross"
                  d="M-11 0 L11 0 M0 -11 L0 11"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
          </>
        );
      }}
    />
  );
}
