"use client";

import { Clock3, Database, ExternalLink, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { mockEvents } from "@/data/mockEvents";
import { mockSources } from "@/data/mockSources";
import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import type {
  ExtractionMethod,
  SourceAccessType,
  SourceBasis,
  SourceCandidateStatus,
  SourceRegionScope,
  SourceStatus as CandidateSourceStatus,
  SourceTargetScreen,
  VerificationStatus as CandidateVerificationStatus,
} from "@/data/sources/sourceTypes";
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

const ACCESS_TYPE_LABELS: Record<SourceAccessType, string> = {
  rss: "RSS",
  api: "API",
  static: "Static",
  manual: "Manual",
};

const CANDIDATE_STATUS_LABELS: Record<SourceCandidateStatus, string> = {
  candidate_test: "Candidate / Test",
  review_more: "Review More",
  later: "Later",
  rejected: "Rejected",
};

const CANDIDATE_SOURCE_STATUS_LABELS: Record<CandidateSourceStatus, string> = {
  public_news_source: "Public News Source",
  official_feed: "Official Feed",
  community_signal: "Community Signal",
  reference_dataset: "Reference Dataset",
};

const CANDIDATE_VERIFICATION_LABELS: Record<CandidateVerificationStatus, string> = {
  source_reported: "Source Reported",
  official_entry: "Official Entry",
  multi_source_reference: "Multi-Source Reference",
  manual_sample: "Manual Sample",
};

const SOURCE_BASIS_LABELS: Record<SourceBasis, string> = {
  single_public_source: "Single Public Source",
  single_official_source: "Single Official Source",
  multiple_public_sources: "Multiple Public Sources",
  manual_sample: "Manual Sample",
};

const EXTRACTION_METHOD_LABELS: Record<ExtractionMethod, string> = {
  rss_summary: "RSS Summary",
  official_json: "Official JSON",
  manual_sample: "Manual Sample",
  keyword_match: "Keyword Match",
  api_result: "API Result",
};

const TARGET_SCREEN_LABELS: Record<SourceTargetScreen, string> = {
  monitor: "Monitor",
  intel_watch: "Intel Watch",
  cyber_news: "Cyber News",
  defense_industry: "Defense Industry",
  policy: "Policy",
  sources: "Sources",
};

const REGION_SCOPE_LABELS: Record<SourceRegionScope, string> = {
  global: "Global",
  middle_east: "Middle East",
  europe: "Europe",
  asia_pacific: "Asia-Pacific",
  americas: "Americas",
  africa: "Africa",
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

function CandidateField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span
        className="mb-1 block font-semibold uppercase"
        style={{ color: "rgba(95,95,95,0.9)", fontSize: "9.5px", letterSpacing: "0.09em" }}
      >
        {label}
      </span>
      <div style={{ color: "rgba(210,210,210,0.92)", fontSize: "11.5px", lineHeight: 1.45 }}>
        {children}
      </div>
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
          className="flex flex-shrink-0 flex-col overflow-hidden rounded-[10px]"
          style={{
            background: "rgba(12,12,12,0.94)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
          >
            <div className="flex items-center gap-2">
              <FlaskConical size={13} style={{ color: "rgba(251,191,36,0.85)" }} />
              <span
                className="font-semibold uppercase"
                style={{ color: "rgba(147,147,147,0.85)", fontSize: "10.5px", letterSpacing: "0.1em" }}
              >
                Candidate / Test Sources
              </span>
            </div>
            <span
              className="rounded px-2 py-0.5 font-semibold uppercase"
              style={{
                color: "rgba(251,191,36,0.92)",
                background: "rgba(113,63,18,0.18)",
                border: "1px solid rgba(251,191,36,0.2)",
                fontSize: "9.5px",
                letterSpacing: "0.08em",
                lineHeight: 1.4,
              }}
            >
              Not Live · Static Frontend Only
            </span>
          </div>
          <div
            className="px-4 py-2.5"
            style={{
              color: "rgba(135,135,135,0.85)",
              fontSize: "11px",
              lineHeight: 1.5,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            These are candidate / test source records held for review. They are
            not approved production / live sources. No live fetching, parsing,
            scraping, API ingestion, or backend integration is connected.
          </div>
          <div className="flex flex-col">
            {candidateSourceDefinitions.map((source, index) => (
              <article
                key={source.id}
                className="px-4 py-3"
                style={{
                  borderTop: index === 0 ? "0" : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3
                    className="font-semibold"
                    style={{ color: "rgba(225,225,225,0.95)", fontSize: "13px" }}
                  >
                    {source.name}
                  </h3>
                  <TextPill>{source.category}</TextPill>
                  <TextPill>{ACCESS_TYPE_LABELS[source.accessType]}</TextPill>
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 font-semibold uppercase"
                    style={{
                      color: "rgba(251,191,36,0.92)",
                      background: "rgba(113,63,18,0.18)",
                      border: "1px solid rgba(251,191,36,0.2)",
                      fontSize: "9.5px",
                      letterSpacing: "0.08em",
                      lineHeight: 1.4,
                    }}
                  >
                    {CANDIDATE_STATUS_LABELS[source.candidateStatus]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 lg:grid-cols-4">
                  <CandidateField label="Source Status">
                    {CANDIDATE_SOURCE_STATUS_LABELS[source.sourceStatus]}
                  </CandidateField>
                  <CandidateField label="Verification Status">
                    {CANDIDATE_VERIFICATION_LABELS[source.verificationStatus]}
                  </CandidateField>
                  <CandidateField label="Source Basis">
                    {SOURCE_BASIS_LABELS[source.sourceBasis]}
                  </CandidateField>
                  <CandidateField label="Extraction Method">
                    {EXTRACTION_METHOD_LABELS[source.extractionMethod]}
                  </CandidateField>
                  <CandidateField label="Language">
                    {source.language.toUpperCase()}
                  </CandidateField>
                  <CandidateField label="Region Scope">
                    {REGION_SCOPE_LABELS[source.regionScope]}
                  </CandidateField>
                  <CandidateField label="Target Screens">
                    <div className="flex flex-wrap gap-1.5">
                      {source.targetScreens.map((screen) => (
                        <TextPill key={screen}>{TARGET_SCREEN_LABELS[screen]}</TextPill>
                      ))}
                    </div>
                  </CandidateField>
                  <CandidateField label="Base URL">
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all"
                      style={{ color: "rgba(147,197,253,0.88)" }}
                    >
                      <span className="truncate">{source.baseUrl}</span>
                      <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    </a>
                  </CandidateField>
                  {source.candidateFeedUrl && (
                    <CandidateField label="Candidate Feed URL">
                      <a
                        href={source.candidateFeedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-all"
                        style={{ color: "rgba(147,197,253,0.88)" }}
                      >
                        <span className="truncate">{source.candidateFeedUrl}</span>
                        <ExternalLink size={11} style={{ flexShrink: 0 }} />
                      </a>
                    </CandidateField>
                  )}
                </div>
                {source.notes && (
                  <p
                    className="mt-2.5"
                    style={{ color: "rgba(125,125,125,0.88)", fontSize: "11px", lineHeight: 1.5 }}
                  >
                    {source.notes}
                  </p>
                )}
              </article>
            ))}
          </div>
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
