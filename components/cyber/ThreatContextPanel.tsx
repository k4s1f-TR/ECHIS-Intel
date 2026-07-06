"use client";
import { Crosshair, Landmark, ShieldAlert, Users, Building, FileText } from "lucide-react";
import type { CyberNewsItem } from "@/types/cyberNews";
import type { ActorHit, ItemAnnotation } from "@/lib/cyber";
import { HIGHLIGHT_ROLE_LABEL } from "./CyberMap";

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

// ── Engine-annotation → display values ──────────────────────────────────────
// Everything below is inferred from the RSS title+summary text by lib/cyber
// (provenance: derived_from_rss_text). Fallbacks come from the RSS item itself;
// nothing here is invented.

const ACTOR_KIND_LABEL: Record<ActorHit["kind"], string> = {
  nation_state: "nation-state",
  cybercrime: "cybercrime",
  hacktivist: "hacktivist",
  unspecified: "",
};

function formatCountries(annotation: ItemAnnotation | undefined, fallback: string): string {
  const hits = annotation?.countries ?? [];
  if (hits.length === 0) return fallback;
  return hits
    .slice(0, 3)
    .map((c) => `${c.country} — ${HIGHLIGHT_ROLE_LABEL[c.primaryRole]}`)
    .join(" · ");
}

function formatActors(annotation: ItemAnnotation | undefined): string {
  const hits = annotation?.actors ?? [];
  if (hits.length === 0) return "No actor named in the source text";
  return hits
    .slice(0, 2)
    .map((a) => {
      const kind = ACTOR_KIND_LABEL[a.kind];
      const origin = a.attributedCountry ? `${a.attributedCountry}-linked` : kind;
      return origin ? `${a.name} (${origin})` : a.name;
    })
    .join(" · ");
}

function formatSectors(annotation: ItemAnnotation | undefined, fallback: string): string {
  const hits = annotation?.sectors ?? [];
  if (hits.length === 0) return fallback;
  return hits
    .slice(0, 2)
    .map((s) => s.label)
    .join(" · ");
}

/**
 * Confidence = how much independent signal the engine extracted from the text
 * (same idea as lib/defense): country hits, actor hits and sector hits each
 * add one; a high-confidence hit adds one more. Bounded 1..5.
 */
function deriveConfidence(annotation: ItemAnnotation | undefined): { level: number; label: string } {
  const countries = annotation?.countries ?? [];
  const actors = annotation?.actors ?? [];
  const sectors = annotation?.sectors ?? [];

  let level = 1;
  if (countries.length > 0) level += 1;
  if (actors.length > 0) level += 1;
  if (sectors.length > 0) level += 1;
  const hasHighHit =
    countries.some((c) => c.confidence === "high") ||
    sectors.some((s) => s.confidence === "high");
  if (hasHighHit) level += 1;
  level = Math.min(5, level);

  const label = level >= 4 ? "High" : level === 3 ? "Medium" : "Low";
  return { level, label };
}

export function ThreatContextPanel({
  selectedNewsId,
  items = [],
  annotations,
}: {
  selectedNewsId?: string;
  items?: CyberNewsItem[];
  /** Per-item engine annotations from analyzeCyberSignals (keyed by item id). */
  annotations?: ReadonlyMap<string, ItemAnnotation>;
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
  const annotation = annotations?.get(selectedNews.id);
  const confidence = deriveConfidence(annotation);

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
        <CtxRow
          icon={Landmark}
          label="Country / Region"
          value={formatCountries(annotation, ctx.country)}
        />
        <CtxRow icon={ShieldAlert} label="Hack Incident" value={ctx.hackIncident} />
        <CtxRow icon={Users} label="Threat Actor / Group" value={formatActors(annotation)} />
        <CtxRow
          icon={Building}
          label="Target Sector"
          value={formatSectors(annotation, ctx.targetSector)}
        />
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
              <Pips level={confidence.level} kind="silver" />
              <span className="c-disp" style={{ fontSize: "var(--c-fs-xs)", fontWeight: 600, color: "var(--c-silver)" }}>{confidence.label}</span>
            </div>
          </div>
          <span
            style={{
              fontSize: "var(--c-fs-2xs)",
              letterSpacing: "0.05em",
              color: "var(--c-t5)",
            }}
          >
            Country, actor, sector and confidence are inferred from open-source text.
          </span>
        </div>
      </div>
    </div>
  );
}
