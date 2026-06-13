import { Shield, MapPin, Crosshair, Users, Target, FileText, Flag, Building, Server } from "lucide-react";
import { cyberNewsItems } from "@/data/cyberMockData";

const G = { accent: "var(--accent-green-dot)", dim: "var(--accent-green-dim)", text: "var(--accent-green)" };

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon size={11} style={{ color: "var(--accent-green-dim)", flexShrink: 0 }} />
      <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{label}</span>
    </div>
  );
}

function SectionValue({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--text-body)", marginBottom: "12px", paddingLeft: "19px" }}>{children}</p>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</span>
      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--text-body)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function StatusBar({ label, level, color }: { label: string; level: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{label}</span>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ width: 14, height: 4, borderRadius: 1, background: i <= level ? color : "var(--border-dim)" }} />
          ))}
        </div>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color, minWidth: 28 }}>{level >= 4 ? "High" : level === 3 ? "Med" : "Low"}</span>
      </div>
    </div>
  );
}

export function ThreatContextPanel({ selectedNewsId }: { selectedNewsId?: string }) {
  const selectedNews = cyberNewsItems.find((n) => n.id === selectedNewsId) || cyberNewsItems[0];
  const ctx = selectedNews.context;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Shield size={12} style={{ color: G.dim }} />
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Threat Context</span>
      </div>

      {/* Content */}
      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col cyber-scrollbar">
        <SectionLabel icon={Flag} label="Country" />
        <div className="flex items-center gap-2 mb-3" style={{ paddingLeft: 19 }}>
          <span style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--text-body)" }}>{ctx.country}</span>
        </div>

        <SectionLabel icon={Building} label="Affected Entity / Organization" />
        <SectionValue>{ctx.affectedEntity}</SectionValue>

        <SectionLabel icon={Crosshair} label="Hack Incident" />
        <SectionValue>{ctx.hackIncident}</SectionValue>

        <SectionLabel icon={Target} label="Attack Type / Vector" />
        <SectionValue>{ctx.attackTypeVector}</SectionValue>

        <SectionLabel icon={Users} label="Threat Actor / Group" />
        <SectionValue>{ctx.threatActorGroup}</SectionValue>

        <SectionLabel icon={Server} label="Target / Asset" />
        <SectionValue>{ctx.targetAsset}</SectionValue>

        <SectionLabel icon={MapPin} label="Target Sector" />
        <SectionValue>{ctx.targetSector}</SectionValue>

        <SectionLabel icon={FileText} label="Summary" />
        <p style={{ fontSize: "var(--fs-base)", fontWeight: 400, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 16, paddingLeft: 19 }}>
          {ctx.contextSummary}
        </p>

        <div className="mt-auto" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <MetaRow label="First Seen" value={ctx.firstSeen} />
          <MetaRow label="Last Update" value={ctx.lastUpdate} />
          <StatusBar label="Confidence" level={ctx.confidenceLevel} color={ctx.confidenceLevel >= 4 ? "var(--accent-green)" : "rgba(218,175,22,0.85)"} />
          <div className="flex items-center justify-between py-2">
            <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Impact</span>
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ width: 14, height: 4, borderRadius: 1, background: i <= ctx.impactLevel ? "var(--sev-critical-text)" : "var(--border-dim)" }} />
                ))}
              </div>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--sev-critical-text)", minWidth: 28 }}>{ctx.impact}</span>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
