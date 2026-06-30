"use client";
import { Crosshair, Landmark, Building2, ShieldAlert, Zap, Users, Target, Building, FileText } from "lucide-react";
import type { CyberNewsItem } from "@/types/cyberNews";

function CtxRow({ icon: Icon, label, value, body }: { icon: React.ElementType; label: string; value: string; body?: boolean }) {
  return (
    <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--c-border-3)" }}>
      <div
        className="flex items-center gap-[6px]"
        style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-t5)", marginBottom: 5 }}
      >
        <Icon size={11} style={{ opacity: 0.75, flexShrink: 0 }} />
        {label}
      </div>
      <div
        style={{
          fontSize: body ? "var(--c-fs-base)" : "var(--c-fs-md)",
          fontWeight: body ? 400 : 600,
          color: body ? "var(--c-t3)" : "var(--c-t2)",
          lineHeight: body ? 1.56 : 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pips({ level, kind }: { level: number; kind: "silver" | "crit" }) {
  const on = kind === "crit" ? "var(--c-crit)" : "var(--c-silver)";
  return (
    <div className="flex gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{ width: 13, height: 4, borderRadius: 2, background: i < level ? on : "rgba(255,255,255,0.08)" }}
        />
      ))}
    </div>
  );
}

function CtxPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-t5)" }}>
        {label}
      </span>
      <span className="c-mono" style={{ fontSize: "var(--c-fs-base)", fontWeight: 500, color: "var(--c-t3)" }}>
        {value}
      </span>
    </div>
  );
}

export function ThreatContextPanel({
  selectedNewsId,
  items = [],
}: {
  selectedNewsId?: string;
  items?: CyberNewsItem[];
}) {
  const selectedNews = items.find((n) => n.id === selectedNewsId) || items[0];

  if (!selectedNews) {
    return (
      <div className="cyber-panel h-full">
        <div className="cyber-panel-head">
          <div className="flex items-center gap-[9px]">
            <Crosshair size={15} style={{ color: "var(--c-silver-dim)" }} />
            <span className="cyber-panel-title">Threat Context</span>
          </div>
          <span className="cyber-live-pill" style={{ color: "var(--c-silver-dim)" }}>
            RSS
          </span>
        </div>
        <div
          className="c-mono flex flex-1 items-center justify-center px-4 text-center"
          style={{
            color: "var(--c-t4)",
            fontSize: "var(--c-fs-xs)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          No live RSS item selected.
        </div>
      </div>
    );
  }

  const ctx = selectedNews.context;

  return (
    <div className="cyber-panel h-full">
      {/* Header */}
      <div className="cyber-panel-head">
        <div className="flex items-center gap-[9px]">
          <Crosshair size={15} style={{ color: "var(--c-silver-dim)" }} />
          <span className="cyber-panel-title">Threat Context</span>
        </div>
        <span className="cyber-live-pill" style={{ color: "var(--c-silver-dim)" }}>
          {selectedNews.source}
        </span>
      </div>

      {/* Content (re-keyed → 380ms fade on selection change) */}
      <div key={selectedNews.id} className="cyber-ctx-fade tm-scrollbar cyber-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col">
        <CtxRow icon={Landmark} label="Country / Region" value={ctx.country} />
        <CtxRow icon={Building2} label="Affected Entity / Organization" value={ctx.affectedEntity} />
        <CtxRow icon={ShieldAlert} label="Hack Incident" value={ctx.hackIncident} />
        <CtxRow icon={Zap} label="Attack Type / Vector" value={ctx.attackTypeVector} />
        <CtxRow icon={Users} label="Threat Actor / Group" value={ctx.threatActorGroup} />
        <CtxRow icon={Target} label="Target / Asset" value={ctx.targetAsset} />
        <CtxRow icon={Building} label="Target Sector" value={ctx.targetSector} />
        <CtxRow icon={FileText} label="Summary" value={ctx.contextSummary} body />

        {/* Footer */}
        <div className="mt-auto flex flex-col gap-[11px]" style={{ padding: "12px 16px", borderTop: "1px solid var(--c-border-2)" }}>
          <CtxPair label="First Seen" value={ctx.firstSeen} />
          <CtxPair label="Last Update" value={ctx.lastUpdate} />
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-t5)" }}>
              Confidence
            </span>
            <div className="flex items-center gap-2">
              <Pips level={ctx.confidenceLevel} kind="silver" />
              <span className="c-disp" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 600, color: "var(--c-silver)" }}>{ctx.confidence}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "var(--c-fs-2xs)", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-t5)" }}>
              Impact
            </span>
            <div className="flex items-center gap-2">
              <Pips level={ctx.impactLevel} kind="crit" />
              <span className="c-disp" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 600, color: "var(--c-crit)" }}>{ctx.impact}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
