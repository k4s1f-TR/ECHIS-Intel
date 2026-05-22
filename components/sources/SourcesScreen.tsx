"use client";

import { Clock3, Database, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { mockEvents } from "@/data/mockEvents";
import { mockSources } from "@/data/mockSources";
import type { RegionKey } from "@/types/event";
import type { OsintSourceType, SourceCategory, SourceStatus } from "@/types/source";

const STATUS_STYLES: Record<SourceStatus, { color: string; background: string; border: string }> = {
  ACTIVE: {
    color: "rgba(74,222,128,0.95)",
    background: "rgba(22,101,52,0.16)",
    border: "rgba(74,222,128,0.22)",
  },
  INACTIVE: {
    color: "rgba(148,163,184,0.86)",
    background: "rgba(51,65,85,0.2)",
    border: "rgba(148,163,184,0.16)",
  },
  PENDING: {
    color: "rgba(251,191,36,0.95)",
    background: "rgba(113,63,18,0.2)",
    border: "rgba(251,191,36,0.22)",
  },
  FUTURE: {
    color: "rgba(96,165,250,0.95)",
    background: "rgba(30,64,175,0.18)",
    border: "rgba(96,165,250,0.22)",
  },
};

const TYPE_LABELS: Record<OsintSourceType, string> = {
  OFFICIAL: "Official",
  MEDIA: "Media",
  SPECIALIST: "Specialist",
  NGO: "NGO",
  UNVERIFIED: "Unverified",
  MARITIME_SOURCE: "Maritime Source",
  INTEL_SOURCE: "Intel Source",
  SIGNAL_SOURCE: "Signal Source",
  OPEN_DATA: "Open Data",
};

const CATEGORY_LABELS: Record<SourceCategory, string> = {
  PUBLIC_NEWS_WIRE: "Public News / Wire",
  GOVERNMENT_INSTITUTIONAL: "Government & Institutional",
  THINK_TANK_POLICY: "Think Tank / Policy",
  CYBER_SECURITY_FEEDS: "Cyber Security Feeds",
  DEFENSE_INDUSTRY: "Defense Industry",
  REGIONAL_MONITORING: "Regional Monitoring",
  SOCIAL_OPEN_WEB_SIGNALS: "Social / Open Web Signals",
};

const REGION_LABELS: Record<RegionKey, string> = {
  "middle-east": "Middle East",
  europe: "Europe",
  "asia-pacific": "Asia-Pacific",
  americas: "Americas",
};

function StatusPill({ status }: { status: SourceStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <span
      className="inline-flex items-center rounded px-2 py-1 font-semibold uppercase"
      style={{
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
        fontSize: "10px",
        letterSpacing: "0.06em",
        lineHeight: 1,
      }}
    >
      {status}
    </span>
  );
}

function TextPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-2 py-1"
      style={{
        color: "rgba(170,170,170,0.88)",
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.055)",
        fontSize: "10.5px",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      className="min-w-0 rounded-lg px-3 py-2.5"
      style={{
        background: "rgba(14,14,14,0.78)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: tone, boxShadow: `0 0 8px ${tone}` }}
        />
        <span
          className="truncate font-semibold uppercase"
          style={{ color: "rgba(105,105,105,0.9)", fontSize: "10px", letterSpacing: "0.08em" }}
        >
          {label}
        </span>
      </div>
      <span className="font-semibold" style={{ color: "rgba(230,230,230,0.94)", fontSize: "22px" }}>
        {value}
      </span>
    </div>
  );
}

export function SourcesScreen() {
  const totalSources = mockSources.length;
  const activeSources = mockSources.filter((source) => source.status === "ACTIVE").length;
  const futureSources = mockSources.filter((source) => source.status === "FUTURE").length;
  const pendingSources = mockSources.filter((source) => source.status === "PENDING").length;
  const eventCountsBySourceId = mockEvents.reduce<Record<string, number>>((counts, event) => {
    counts[event.sourceId] = (counts[event.sourceId] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main
      className="flex min-h-0 flex-1 overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 28% 18%, rgba(59,130,246,0.055), rgba(10,10,10,0) 34%), #080808",
      }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1380px] flex-col gap-3 px-6 py-4">
        <section className="flex flex-shrink-0 items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Database size={15} style={{ color: "rgba(147,197,253,0.88)" }} />
              <span
                className="font-semibold uppercase"
                style={{ color: "rgba(147,147,147,0.82)", fontSize: "10.5px", letterSpacing: "0.12em" }}
              >
                Source Registry
              </span>
            </div>
            <h1 className="font-semibold" style={{ color: "rgba(235,235,235,0.95)", fontSize: "22px" }}>
              Sources Overview
            </h1>
          </div>
        </section>

        <section className="grid flex-shrink-0 grid-cols-2 gap-2.5 lg:grid-cols-4">
          <SummaryCard label="Total Sources" value={totalSources} tone="rgba(147,197,253,0.9)" />
          <SummaryCard label="Active Sources" value={activeSources} tone="rgba(74,222,128,0.9)" />
          <SummaryCard label="Future Sources" value={futureSources} tone="rgba(96,165,250,0.9)" />
          <SummaryCard label="Pending Sources" value={pendingSources} tone="rgba(251,191,36,0.9)" />
        </section>

        <section
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px]"
          style={{
            background: "rgba(12,12,12,0.96)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.035)",
          }}
        >
          <div
            className="hidden flex-shrink-0 grid-cols-[1.35fr_0.7fr_0.55fr_0.85fr_0.9fr_0.65fr] gap-3 px-4 py-2.5 lg:grid"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.055)",
              color: "rgba(92,92,92,0.95)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>Source</span>
            <span>Type</span>
            <span>Status</span>
            <span>Category</span>
            <span>Last Reviewed</span>
            <span className="text-right">Events</span>
          </div>

          <div className="sources-registry-scrollbar min-h-0 flex-1 overflow-y-auto">
            {mockSources.map((source, index) => (
              <article
                key={source.id}
                className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors duration-150 lg:grid-cols-[1.35fr_0.7fr_0.55fr_0.85fr_0.9fr_0.65fr]"
                style={{
                  background: "rgba(255,255,255,0.008)",
                  borderTop: index === 0 ? "0" : "1px solid rgba(255,255,255,0.045)",
                }}
              >
                <div className="min-w-0">
                  <div className="mb-1.5 flex min-w-0 items-center gap-2">
                    <h2
                      className="truncate font-semibold"
                      style={{ color: "rgba(218,218,218,0.94)", fontSize: "13px" }}
                    >
                      {source.name}
                    </h2>
                    {source.url && (
                      <ExternalLink size={12} style={{ color: "rgba(96,165,250,0.62)", flexShrink: 0 }} />
                    )}
                  </div>
                  <p className="max-w-[520px]" style={{ color: "rgba(118,118,118,0.92)", fontSize: "11.5px", lineHeight: 1.45 }}>
                    {source.description}
                  </p>
                </div>

                <div className="flex items-start">
                  <TextPill>{TYPE_LABELS[source.type]}</TextPill>
                </div>

                <div className="flex items-start">
                  <StatusPill status={source.status} />
                </div>

                <div className="flex flex-wrap content-start gap-1.5">
                  {source.categories.slice(0, 3).map((category) => (
                    <TextPill key={category}>{CATEGORY_LABELS[category]}</TextPill>
                  ))}
                  {source.categories.length > 3 && <TextPill>+{source.categories.length - 3}</TextPill>}
                </div>

                <div className="flex flex-col gap-2">
                  <span
                    className="flex items-center gap-1.5"
                    style={{ color: "rgba(145,145,145,0.88)", fontSize: "11px" }}
                  >
                    <Clock3 size={12} style={{ color: "rgba(95,95,95,0.9)" }} />
                    {source.lastReviewed}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {source.regions.slice(0, 2).map((region) => (
                      <TextPill key={region}>{REGION_LABELS[region]}</TextPill>
                    ))}
                    {source.regions.length > 2 && <TextPill>+{source.regions.length - 2}</TextPill>}
                  </div>
                </div>

                <div className="flex items-start justify-start lg:justify-end">
                  <span className="font-semibold" style={{ color: "rgba(225,225,225,0.9)", fontSize: "16px" }}>
                    {eventCountsBySourceId[source.id] ?? 0}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
