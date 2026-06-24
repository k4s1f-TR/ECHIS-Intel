"use client";

import type { CSSProperties } from "react";
import { POLICY_CHANNEL_COLOR } from "@/types/policy";
import type { RegionStat, SourceStat, TrendBucket } from "./policyView";

const EYEBROW: CSSProperties = {
  fontSize: "9.5px",
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "var(--c-t5)",
};

const CAPTION: CSSProperties = {
  fontSize: "10.5px",
  lineHeight: 1.45,
  color: "var(--c-t5)",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="c-mono" style={{ ...EYEBROW, marginBottom: "6px" }}>
      {children}
    </div>
  );
}

export function PolicyMetaColumn({
  regions,
  sources,
  trend,
  time,
}: {
  regions: RegionStat[];
  sources: SourceStat[];
  trend: TrendBucket[];
  time: number;
}) {
  return (
    <div
      className="tm-scrollbar flex-none overflow-y-auto"
      style={{
        width: "290px",
        borderLeft: "1px solid var(--c-border-3)",
        // Zoom the meta column out so all three panels (Regions / Source
        // Breakdown / Signal Volume) fit without a vertical scrollbar. This
        // also shrinks the column's layout box, handing the freed width to
        // the centred reading column.
        zoom: 0.82,
      }}
    >
      {/* Most Mentioned Regions */}
      <div style={{ padding: "24px 22px 8px 22px" }}>
        <Eyebrow>Most Mentioned Regions</Eyebrow>
        <div style={{ ...CAPTION, marginBottom: "16px" }}>
          Geo-tagged from each report&apos;s text &amp; source metadata, ranked by mentions in the
          current view.
        </div>
        <div className="flex flex-col" style={{ gap: "13px" }}>
          {regions.map((r) => (
            <div key={r.region}>
              <div className="flex justify-between" style={{ marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--c-t3)" }}>{r.region}</span>
                <span className="c-mono" style={{ fontSize: "10px", color: "var(--c-t5)" }}>
                  {r.count}
                </span>
              </div>
              <div
                style={{
                  height: "3px",
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${r.pct}%`,
                    borderRadius: "2px",
                    background: "linear-gradient(90deg, var(--c-accent-2), var(--c-accent))",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source Breakdown */}
      <div
        style={{
          padding: "26px 22px 8px 22px",
          borderTop: "1px solid var(--c-border-3)",
          marginTop: "24px",
        }}
      >
        <Eyebrow>Source Breakdown</Eyebrow>
        <div style={{ ...CAPTION, marginBottom: "16px" }}>
          Share of in-view signals by collection channel.
        </div>
        <div className="flex flex-col" style={{ gap: "13px" }}>
          {sources.map((s) => (
            <div key={s.type} className="flex items-center" style={{ gap: "10px" }}>
              <span
                className="flex-none"
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  background: POLICY_CHANNEL_COLOR[s.type],
                }}
              />
              <span className="flex-1" style={{ fontSize: "12px", color: "var(--c-t3)" }}>
                {s.type}
              </span>
              <span className="c-mono" style={{ fontSize: "10px", color: "var(--c-t4)" }}>
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Volume */}
      <div
        style={{
          padding: "26px 22px 24px 22px",
          borderTop: "1px solid var(--c-border-3)",
          marginTop: "24px",
        }}
      >
        <Eyebrow>Signal Volume</Eyebrow>
        <div style={{ ...CAPTION, marginBottom: "14px" }}>
          Reports collected per interval · last {time}h.
        </div>
        <div className="flex items-end" style={{ height: "54px", gap: "2px" }}>
          {trend.map((b, ix) => (
            <div key={ix} className="flex flex-1 items-end" style={{ height: "100%" }}>
              <div
                style={{
                  width: "100%",
                  height: `${b.pct}%`,
                  borderRadius: "2px",
                  background: "linear-gradient(180deg, var(--c-accent), var(--c-accent-2))",
                  opacity: b.opacity,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
