import {
  Factory,
  Flag,
  Building,
  Rocket,
  Activity,
  Layers,
  Boxes,
  FileText,
} from "lucide-react";
import { defenseFeedItems } from "@/data/defenseIndustryMockData";

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon size={11} style={{ color: "var(--c-silver-dim)", flexShrink: 0 }} />
      <span
        style={{
          fontSize: "var(--fs-xs)",
          fontWeight: 600,
          color: "var(--c-t5)",
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SectionValue({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "var(--fs-md)",
        fontWeight: 500,
        color: "var(--c-t2)",
        marginBottom: "12px",
        paddingLeft: "19px",
      }}
    >
      {children}
    </p>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: "1px solid var(--c-border-3)" }}
    >
      <span
        style={{
          fontSize: "var(--fs-xs)",
          fontWeight: 600,
          color: "var(--c-t5)",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "var(--fs-sm)",
          fontWeight: 500,
          color: "var(--c-t3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBar({
  label,
  level,
  color,
  caption,
}: {
  label: string;
  level: number;
  color: string;
  caption: string;
}) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: "1px solid var(--c-border-3)" }}
    >
      <span
        style={{
          fontSize: "var(--fs-xs)",
          fontWeight: 600,
          color: "var(--c-t5)",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 4,
                borderRadius: 1,
                background: i <= level ? color : "var(--bg-surface-active)",
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color, minWidth: 32 }}>{caption}</span>
      </div>
    </div>
  );
}

export function IndustryContextPanel({ selectedItemId }: { selectedItemId?: string }) {
  const selected = defenseFeedItems.find((d) => d.id === selectedItemId) || defenseFeedItems[0];
  const ctx = selected.context;

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
        className="flex items-center gap-2 flex-shrink-0 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <Factory size={12} style={{ color: "var(--c-silver-dim)" }} />
        <span
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: 700,
            color: "var(--c-t4)",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}
        >
          Industry Context
        </span>
      </div>

      <div className="tm-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col defense-scrollbar">
        <SectionLabel icon={Flag} label="Country / Region" />
        <SectionValue>{ctx.countryRegion}</SectionValue>

        <SectionLabel icon={Building} label="Organization / Company" />
        <SectionValue>{ctx.organization}</SectionValue>

        <SectionLabel icon={Rocket} label="Program / Platform" />
        <SectionValue>{ctx.program}</SectionValue>

        <SectionLabel icon={Activity} label="Activity Type" />
        <SectionValue>{ctx.activityType}</SectionValue>

        <SectionLabel icon={Layers} label="Industry Segment" />
        <SectionValue>{ctx.industrySegment}</SectionValue>

        <SectionLabel icon={Boxes} label="Supply Chain Area" />
        <SectionValue>{ctx.supplyChainArea}</SectionValue>

        <SectionLabel icon={FileText} label="Summary" />
        <p
          style={{
            fontSize: "var(--fs-base)",
            fontWeight: 400,
            color: "var(--c-t4)",
            lineHeight: 1.65,
            marginBottom: 16,
            paddingLeft: 19,
          }}
        >
          {ctx.summary}
        </p>

        <div className="mt-auto" style={{ borderTop: "1px solid var(--c-border-3)", paddingTop: 12 }}>
          <MetaRow label="Source Type" value={ctx.sourceType} />
          <MetaRow label="First Seen" value={ctx.firstSeen} />
          <MetaRow label="Last Update" value={ctx.lastUpdate} />
          <StatusBar
            label="Confidence"
            level={ctx.confidenceLevel}
            color={
              ctx.confidenceLevel >= 4
                ? "var(--c-elev)"
                : "var(--c-med)"
            }
            caption={ctx.confidence}
          />
          <StatusBar
            label="Impact"
            level={ctx.impactLevel}
            color={
              ctx.impactLevel >= 4
                ? "var(--c-high)"
                : ctx.impactLevel === 3
                ? "var(--c-med)"
                : "var(--c-elev)"
            }
            caption={ctx.impact}
          />
        </div>
      </div>
    </div>
  );
}
