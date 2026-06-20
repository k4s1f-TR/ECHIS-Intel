"use client";

import {
  Activity,
  AlertTriangle,
  Database,
  ExternalLink,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSourceIntelligenceStore } from "@/components/source-intelligence/SourceIntelligenceProvider";
import { sourceRegistry } from "@/data/source-intelligence/sourceRegistry";
import type {
  CollectionMethod,
  IntelligenceEventCandidate,
  SourceDefinition,
  SourceStatus,
  SourceType,
} from "@/data/source-intelligence/sourceIntelligenceTypes";

const METHOD_LABELS: Record<CollectionMethod, string> = {
  rss: "RSS",
  api: "API Route",
  aggregator_api: "Aggregator API",
  official_page: "Official Page",
  scraping: "Scraping",
  script_import: "Script Import",
  dataset: "Dataset",
};

const TYPE_LABELS: Record<SourceType, string> = {
  official_government: "Official Government",
  intergovernmental_org: "Intergovernmental Org",
  wire_agency: "Wire Agency",
  regional_news: "Regional News",
  global_news: "Global News",
  crisis_humanitarian: "Crisis / Humanitarian",
  conflict_dataset: "Conflict Dataset",
  aggregator: "Aggregator",
  scraped_official_page: "Scraped Official Page",
  script_import: "Script Import",
};

const STATUS_LABELS: Record<SourceStatus, string> = {
  active: "Active",
  test: "Test",
  candidate: "Candidate",
  disabled: "Disabled",
};

const STATUS_STYLES: Record<
  SourceStatus,
  { color: string; background: string; border: string }
> = {
  active: {
    color: "var(--c-elev)",
    background: "var(--c-elev-bg)",
    border: "var(--c-elev-border)",
  },
  test: {
    color: "rgba(251,191,36,0.94)",
    background: "rgba(113,63,18,0.17)",
    border: "rgba(251,191,36,0.22)",
  },
  candidate: {
    color: "rgba(150,170,196,0.88)",
    background: "rgba(184,190,202,0.07)",
    border: "rgba(184,190,202,0.18)",
  },
  disabled: {
    color: "var(--c-t5)",
    background: "rgba(255,255,255,0.035)",
    border: "var(--c-border-1)",
  },
};

function labelFor(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCollectedAt(iso?: string): string {
  if (!iso) return "Not loaded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not loaded";
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function formatCheckTime(collectedAt?: string, requestedAt?: string): string {
  return formatCollectedAt(collectedAt ?? requestedAt);
}

function formatSourceError(error?: string | null): string | null {
  if (!error) return null;
  if (error === "source_route_not_found") {
    return "Source route was not found. The source may be stale, removed, or still open from an older browser session.";
  }
  if (error === "guardian_key_not_configured") return "Guardian API key is not configured.";
  if (error.endsWith("_key_not_configured")) {
    return `${labelFor(error.replace("_key_not_configured", ""))} API key is not configured.`;
  }
  if (error.endsWith("_source_not_configured")) {
    return `${labelFor(error.replace("_source_not_configured", ""))} source is not configured in the runtime registry.`;
  }
  if (error === "missing_feed_url") return "Feed URL is missing.";
  if (error === "timeout") return "Request timed out.";
  if (error === "network_access_denied") return "Network access was denied for this source route.";
  if (error === "network_connection_reset") return "Source connection was reset.";
  if (error === "network_fetch_failed") return "Source network request failed.";
  if (error === "tls_certificate_error") return "TLS certificate verification failed for this source.";
  if (error === "parse_failed") return "Source response could not be parsed.";
  if (error.startsWith("source_route_")) {
    const detail = error.slice("source_route_".length);
    if (detail === "404") {
      return "Source route was not found. The local runtime endpoint or stale source id should be checked.";
    }
    return `Source runtime route returned HTTP ${detail}.`;
  }
  if (error.startsWith("upstream_")) {
    const detail = error.slice("upstream_".length);
    if (detail.startsWith("429")) {
      return "Source rate limit reached. Wait a few seconds before refreshing again.";
    }
    if (detail.startsWith("400")) {
      return "Source request was rejected by the upstream API. Check the request parameters for this adapter.";
    }
    if (detail.startsWith("401") || detail.startsWith("403")) {
      return "Source authentication or access was rejected by the upstream service.";
    }
    if (detail.startsWith("404")) {
      return "Upstream source endpoint was not found. The external API path or feed URL may have changed.";
    }
    if (detail.includes("approved appname")) {
      return "ReliefWeb API requires an approved appname; this source now uses the RSS adapter in the active pipeline.";
    }
    return `Upstream HTTP ${detail}.`;
  }
  return labelFor(error);
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber";
}) {
  const styles = {
    neutral: {
      color: "rgba(170,180,194,0.78)",
      background: "var(--bg-surface)",
      border: "var(--border-primary)",
    },
    blue: {
      color: "var(--accent-blue-text)",
      background: "var(--accent-blue-bg)",
      border: "var(--accent-blue-border)",
    },
    green: {
      color: "var(--c-elev)",
      background: "var(--accent-green-bg)",
      border: "var(--accent-green-border)",
    },
    amber: {
      color: "rgba(251,191,36,0.9)",
      background: "rgba(113,63,18,0.14)",
      border: "rgba(251,191,36,0.2)",
    },
  }[tone];

  return (
    <span
      className="inline-flex min-w-0 items-center rounded px-2 py-1 font-semibold uppercase"
      style={{
        color: styles.color,
        background: styles.background,
        border: `1px solid ${styles.border}`,
        fontSize: "var(--fs-xs)",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function StatusPill({ status }: { status: SourceStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center rounded px-2 py-1 font-semibold uppercase"
      style={{
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
        fontSize: "var(--fs-xs)",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function RuntimeStatePill({
  label,
  tone,
}: {
  label: string;
  tone: "blue" | "green" | "amber" | "red" | "neutral";
}) {
  const styles = {
    blue: {
      color: "var(--accent-blue-text)",
      background: "var(--accent-blue-bg)",
      border: "var(--accent-blue-border)",
    },
    green: {
      color: "var(--c-elev)",
      background: "var(--accent-green-bg)",
      border: "var(--accent-green-border)",
    },
    amber: {
      color: "rgba(251,191,36,0.9)",
      background: "rgba(113,63,18,0.14)",
      border: "rgba(251,191,36,0.22)",
    },
    red: {
      color: "rgba(252,165,165,0.9)",
      background: "rgba(127,29,29,0.12)",
      border: "rgba(248,113,113,0.18)",
    },
    neutral: {
      color: "rgba(148,163,184,0.74)",
      background: "var(--bg-surface)",
      border: "rgba(255,255,255,0.06)",
    },
  }[tone];

  return (
    <span
      className="inline-flex items-center rounded px-2 py-1 font-semibold uppercase"
      style={{
        color: styles.color,
        background: styles.background,
        border: `1px solid ${styles.border}`,
        fontSize: "var(--fs-xs)",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

function MetricTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div
      className="min-w-0 rounded-md px-3 py-2.5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--c-border-1)",
        boxShadow: "var(--shadow-inset-highlight)",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
          style={{
            color: tone,
            background: "var(--bg-surface-hover)",
            border: "1px solid var(--border-dim)",
          }}
        >
          {icon}
        </span>
        <span
          className="truncate font-semibold uppercase"
          style={{
            color: "var(--text-tertiary)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="truncate font-semibold"
        style={{ color: "var(--text-heading)", fontSize: "20px", lineHeight: 1 }}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div
        className="mb-1 truncate font-semibold uppercase"
        style={{
          color: "var(--text-dim)",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className="min-w-0 truncate"
        style={{
          color: "var(--text-body)",
          fontSize: "var(--fs-md)",
          lineHeight: 1.35,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function compactList(values?: string[]): string | undefined {
  if (!values || values.length === 0) return undefined;
  return values.slice(0, 4).join(", ") + (values.length > 4 ? ` +${values.length - 4}` : "");
}

function NeedsLocationReview({
  items,
}: {
  items: IntelligenceEventCandidate[];
}) {
  if (items.length === 0) return null;

  return (
    <section
      className="flex flex-shrink-0 flex-col overflow-hidden rounded-[8px]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle size={12} style={{ color: "rgba(248,113,113,0.78)" }} />
          <span
            className="truncate font-semibold uppercase"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--fs-sm)",
              letterSpacing: "0.1em",
            }}
          >
            Needs Location Review
          </span>
        </div>
        <Pill tone="amber">{items.length} feed-only until resolved</Pill>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {items.map((item) => {
          const evidence = item.geoBasis?.evidenceDetails ?? [];
          const mentioned = compactList(item.item.mentionedCountries);
          const regions = compactList(item.item.mentionedRegions);
          const persons = compactList(item.item.persons);
          const institutions = compactList(item.item.institutions);

          return (
            <article
              key={item.id}
              className="px-4 py-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone="amber">{labelFor(item.primaryDomain)}</Pill>
                    <Pill>{item.sourceName}</Pill>
                    <Pill>{labelFor(item.sourceBasis)}</Pill>
                  </div>
                  <div
                    className="line-clamp-2 font-semibold"
                    style={{
                      color: "var(--text-heading)",
                      fontSize: "12.5px",
                      lineHeight: 1.35,
                    }}
                  >
                    {item.title}
                  </div>
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded"
                    title="Open original source"
                    style={{
                      color: "var(--text-secondary)",
                      background: "var(--bg-surface-hover)",
                      border: "1px solid var(--border-primary)",
                    }}
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Mentioned Countries">{mentioned ?? "None extracted"}</Field>
                <Field label="Regions">{regions ?? "None extracted"}</Field>
                <Field label="Persons">{persons ?? "None extracted"}</Field>
                <Field label="Institutions">{institutions ?? "None extracted"}</Field>
              </div>

              <div className="mt-2">
                <Field label="Geo Decision">
                  {evidence.length > 0 ? (
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {evidence.slice(0, 4).map((entry, index) => (
                        <Pill
                          key={`${entry.method}-${entry.evidenceText}-${index}`}
                          tone={entry.acceptedForMarker ? "green" : "amber"}
                        >
                          {labelFor(entry.role)} / {labelFor(entry.method)}
                          {entry.rejectionReason
                            ? ` / ${labelFor(entry.rejectionReason)}`
                            : ""}
                        </Pill>
                      ))}
                      {evidence.length > 4 && <Pill>+{evidence.length - 4}</Pill>}
                    </span>
                  ) : (
                    "No marker-grade geo evidence extracted"
                  )}
                </Field>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SourceRow({
  source,
  itemCount,
  acceptedCount,
  markerCount,
  domainLabels,
  matchedDomainLabels,
  collectedAt,
  requestedAt,
  error,
  isLoading,
  onRefresh,
}: {
  source: SourceDefinition;
  itemCount: number;
  acceptedCount: number;
  markerCount: number;
  domainLabels: string[];
  matchedDomainLabels: string[];
  collectedAt?: string;
  requestedAt?: string;
  error?: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const status = source.sourceStatus ?? "candidate";
  const readableError = formatSourceError(error);
  const sourceHref = source.feedUrl ?? source.endpoint;
  const canLoad = status !== "disabled" && Boolean(source.endpoint);
  const buttonLabel = isLoading
    ? "Loading"
    : itemCount > 0 || collectedAt || readableError
      ? "Refresh"
      : "Load";
  const hasBeenChecked = Boolean(collectedAt || requestedAt || readableError);
  const runtimeState = isLoading
    ? { label: "Loading", tone: "blue" as const }
    : readableError
      ? { label: "Error", tone: "red" as const }
      : acceptedCount > 0
        ? { label: "Accepted", tone: "green" as const }
        : itemCount > 0
          ? { label: "Filtered Out", tone: "amber" as const }
          : hasBeenChecked
            ? { label: "No Items", tone: "neutral" as const }
            : { label: "Not Loaded", tone: "neutral" as const };
  const locationLabel =
    source.institutionLocation?.label ??
    source.institutionLocation?.city ??
    source.countryCode ??
    "Location pending";

  return (
    <article
      className="px-4 py-3.5 transition-colors duration-150"
      style={{
        background: "rgba(255,255,255,0.008)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
            <h2
              className="min-w-0 truncate font-semibold"
              style={{ color: "var(--text-heading)", fontSize: "13.5px" }}
            >
              {source.name}
            </h2>
            <StatusPill status={status} />
            <RuntimeStatePill
              label={runtimeState.label}
              tone={runtimeState.tone}
            />
            <Pill tone="blue">{METHOD_LABELS[source.collectionMethod]}</Pill>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Pill>{TYPE_LABELS[source.sourceType]}</Pill>
            {source.language && <Pill>{source.language.toUpperCase()}</Pill>}
            <Pill>{source.markerLocationStrategy ?? "none"}</Pill>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 sm:justify-end">
          {sourceHref && (
            <a
              aria-label={`Open ${source.name}`}
              className="flex h-8 w-8 items-center justify-center rounded transition-colors"
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
              title="Open source endpoint"
              style={{
                color: "var(--text-secondary)",
                background: "var(--bg-surface-hover)",
                border: "1px solid var(--border-primary)",
              }}
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={!canLoad || isLoading}
            className="inline-flex h-8 w-[104px] items-center justify-center gap-1.5 rounded font-semibold uppercase transition-colors"
            title={canLoad ? "Load source feed" : "No runtime route"}
            style={{
              color:
                !canLoad || isLoading
                  ? "rgba(145,155,170,0.62)"
                  : "rgba(226,232,240,0.94)",
              background:
                !canLoad || isLoading
                  ? "var(--bg-surface)"
                  : "var(--accent-blue-bg)",
              border:
                !canLoad || isLoading
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid var(--accent-blue-border)",
              cursor: !canLoad || isLoading ? "not-allowed" : "pointer",
              fontSize: "var(--fs-sm)",
              letterSpacing: "0.08em",
            }}
          >
            <RefreshCw
              size={12}
              className={isLoading ? "animate-spin" : undefined}
            />
            {canLoad ? buttonLabel : "No Route"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-4 xl:grid-cols-[1fr_0.9fr_0.85fr_0.85fr_0.9fr_1.2fr]">
        <Field label="Loaded Items">{itemCount}</Field>
        <Field label="Accepted Events">{acceptedCount}</Field>
        <Field label="Markers">{markerCount}</Field>
        <Field label="Location">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin size={11} style={{ color: "rgba(250,86,96,0.68)", flexShrink: 0 }} />
            <span className="truncate">{locationLabel}</span>
          </span>
        </Field>
        <Field label="Last Check">{formatCheckTime(collectedAt, requestedAt)}</Field>
        <Field label="Domains">
          {domainLabels.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {domainLabels.slice(0, 3).map((domain) => (
                <Pill key={domain} tone="green">
                  {domain}
                </Pill>
              ))}
              {domainLabels.length > 3 && <Pill>+{domainLabels.length - 3}</Pill>}
            </span>
          ) : matchedDomainLabels.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {matchedDomainLabels.slice(0, 2).map((domain) => (
                <Pill key={domain} tone="amber">
                  {domain}
                </Pill>
              ))}
              <Pill tone="amber">Below Threshold</Pill>
            </span>
          ) : isLoading ? (
            <span style={{ color: "rgba(250,86,96,0.78)" }}>Loading...</span>
          ) : readableError ? (
            <span style={{ color: "rgba(252,165,165,0.84)" }}>Source error</span>
          ) : itemCount > 0 ? (
            <span style={{ color: "rgba(251,191,36,0.82)" }}>No accepted domains</span>
          ) : hasBeenChecked ? (
            <span style={{ color: "var(--text-tertiary)" }}>No items returned</span>
          ) : (
            <span style={{ color: "var(--text-tertiary)" }}>Not loaded</span>
          )}
        </Field>
      </div>

      {readableError && (
        <div
          className="mt-3 flex items-start gap-2 rounded px-2.5 py-2"
          style={{
            color: "rgba(252,165,165,0.9)",
            background: "rgba(127,29,29,0.11)",
            border: "1px solid rgba(248,113,113,0.16)",
            fontSize: "var(--fs-base)",
            lineHeight: 1.45,
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{readableError}</span>
        </div>
      )}
    </article>
  );
}

export function SourcesScreen() {
  const {
    sources,
    combinedItems,
    eventCandidates,
    markerCandidates,
    itemsBySourceId,
    collectedAtBySourceId,
    loadingBySourceId,
    errorBySourceId,
    filterResults,
    loadState,
    previewSource,
  } = useSourceIntelligenceStore();
  const [requestedAtBySourceId, setRequestedAtBySourceId] = useState<
    Record<string, string>
  >({});

  const acceptedBySourceId = useMemo(() => {
    return eventCandidates.reduce<Record<string, number>>((acc, item) => {
      acc[item.sourceId] = (acc[item.sourceId] ?? 0) + 1;
      return acc;
    }, {});
  }, [eventCandidates]);

  const markersBySourceId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const marker of markerCandidates) {
      const sourceIds = new Set(marker.items.map((item) => item.sourceId));
      for (const sourceId of sourceIds) {
        counts[sourceId] = (counts[sourceId] ?? 0) + 1;
      }
    }
    return counts;
  }, [markerCandidates]);

  const domainsBySourceId = useMemo(() => {
    const domains: Record<string, Set<string>> = {};
    for (const item of eventCandidates) {
      domains[item.sourceId] ??= new Set<string>();
      domains[item.sourceId].add(labelFor(item.primaryDomain));
    }
    return Object.fromEntries(
      Object.entries(domains).map(([sourceId, values]) => [
        sourceId,
        Array.from(values),
      ]),
    ) as Record<string, string[]>;
  }, [eventCandidates]);

  const matchedDomainsBySourceId = useMemo(() => {
    const domains: Record<string, Set<string>> = {};
    for (const result of filterResults) {
      if (result.accepted || result.matches.length === 0) continue;
      domains[result.item.sourceId] ??= new Set<string>();
      for (const match of result.matches) {
        domains[result.item.sourceId].add(labelFor(match.domain));
      }
    }
    return Object.fromEntries(
      Object.entries(domains).map(([sourceId, values]) => [
        sourceId,
        Array.from(values),
      ]),
    ) as Record<string, string[]>;
  }, [filterResults]);

  const handleRefresh = useCallback(
    (sourceId: string) => {
      setRequestedAtBySourceId((prev) => ({
        ...prev,
        [sourceId]: new Date().toISOString(),
      }));
      void previewSource(sourceId);
    },
    [previewSource],
  );

  const FRANCE24_SOURCE_IDS = useMemo(
    () =>
      new Set([
        "france24-europe",
        "france24-africa",
        "france24-middle-east",
        "france24-americas",
        "france24-asia-pacific",
      ]),
    [],
  );

  const SKYNEWS_SOURCE_IDS = useMemo(
    () =>
      new Set([
        "skynews-world",
        "skynews-uk",
        "skynews-us",
        "skynews-politics",
        "skynews-home",
      ]),
    [],
  );

  const ARABNEWS_SOURCE_IDS = useMemo(
    () => new Set(["arabnews-cat1", "arabnews-cat2"]),
    [],
  );

  const france24Sources = useMemo(
    () => sources.filter((s) => FRANCE24_SOURCE_IDS.has(s.id)),
    [sources, FRANCE24_SOURCE_IDS],
  );
  const skynewsSources = useMemo(
    () => sources.filter((s) => SKYNEWS_SOURCE_IDS.has(s.id)),
    [sources, SKYNEWS_SOURCE_IDS],
  );
  const arabnewsSources = useMemo(
    () => sources.filter((s) => ARABNEWS_SOURCE_IDS.has(s.id)),
    [sources, ARABNEWS_SOURCE_IDS],
  );
  const otherSources = useMemo(
    () =>
      sources.filter(
        (s) =>
          !FRANCE24_SOURCE_IDS.has(s.id) &&
          !SKYNEWS_SOURCE_IDS.has(s.id) &&
          !ARABNEWS_SOURCE_IDS.has(s.id),
      ),
    [sources, FRANCE24_SOURCE_IDS, SKYNEWS_SOURCE_IDS, ARABNEWS_SOURCE_IDS],
  );

  const isFrance24Loading = france24Sources.some(
    (s) => loadingBySourceId[s.id] ?? false,
  );
  const isSkynewsLoading = skynewsSources.some(
    (s) => loadingBySourceId[s.id] ?? false,
  );
  const isArabnewsLoading = arabnewsSources.some(
    (s) => loadingBySourceId[s.id] ?? false,
  );

  const handleRefreshFrance24 = useCallback(() => {
    const now = new Date().toISOString();
    const ids = [
      "france24-europe",
      "france24-africa",
      "france24-middle-east",
      "france24-americas",
      "france24-asia-pacific",
    ];
    setRequestedAtBySourceId((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = now;
      return next;
    });
    for (const id of ids) void previewSource(id);
  }, [previewSource]);

  const handleRefreshSkynews = useCallback(() => {
    const now = new Date().toISOString();
    const ids = [
      "skynews-world",
      "skynews-uk",
      "skynews-us",
      "skynews-politics",
      "skynews-home",
    ];
    setRequestedAtBySourceId((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = now;
      return next;
    });
    for (const id of ids) void previewSource(id);
  }, [previewSource]);

  const handleRefreshArabnews = useCallback(() => {
    const now = new Date().toISOString();
    const ids = ["arabnews-cat1", "arabnews-cat2"];
    setRequestedAtBySourceId((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = now;
      return next;
    });
    for (const id of ids) void previewSource(id);
  }, [previewSource]);

  const markerReadyEvents = eventCandidates.filter(
    (item) => item.markerEligibility === "eligible",
  ).length;
  const needsLocationItems = useMemo(
    () =>
      eventCandidates.filter(
        (item) => item.markerEligibility === "needs_location",
      ),
    [eventCandidates],
  );
  const needsLocationEvents = needsLocationItems.length;
  const failedSources = sources.filter(
    (source) => (errorBySourceId[source.id] ?? null) !== null,
  ).length;

  return (
    <main
      className="flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden"
      style={{ background: "var(--c-bg-base)" }}
    >
      <div className="tm-scrollbar sources-registry-scrollbar flex h-full min-h-0 w-full min-w-0 flex-1 basis-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-3 pt-3">
        <section className="flex flex-shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <Database size={13} style={{ color: "var(--accent-blue-text)" }} />
              <span
                className="font-semibold uppercase"
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--fs-sm)",
                  letterSpacing: "0.12em",
                }}
              >
                Source Intelligence Registry
              </span>
            </div>
            <h1
              className="truncate font-semibold"
              style={{ color: "var(--text-heading)", fontSize: "19px" }}
            >
              Runtime Sources
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={loadState === "loaded" ? "green" : loadState === "partial" ? "amber" : "blue"}>
              {labelFor(loadState)}
            </Pill>
            <Pill>{sourceRegistry.length} registered</Pill>
            <Pill>{failedSources} source errors</Pill>
          </div>
        </section>

        <section className="grid flex-shrink-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <MetricTile
            icon={<Database size={12} />}
            label="Runtime Sources"
            value={sources.length}
            tone="var(--accent-blue-text)"
          />
          <MetricTile
            icon={<Radio size={12} />}
            label="Loaded Items"
            value={combinedItems.length}
            tone="var(--accent-blue-text)"
          />
          <MetricTile
            icon={<Activity size={12} />}
            label="Accepted Events"
            value={eventCandidates.length}
            tone="var(--c-elev)"
          />
          <MetricTile
            icon={<MapPin size={12} />}
            label="Marker Candidates"
            value={markerCandidates.length}
            tone="rgba(251,191,36,0.92)"
          />
          <MetricTile
            icon={<ShieldCheck size={12} />}
            label="Marker Ready"
            value={markerReadyEvents}
            tone="var(--accent-green)"
          />
          <MetricTile
            icon={<AlertTriangle size={12} />}
            label="Needs Location"
            value={needsLocationEvents}
            tone="rgba(248,113,113,0.88)"
          />
        </section>

        <NeedsLocationReview items={needsLocationItems} />

        <section
          className="flex min-h-0 flex-shrink-0 flex-col overflow-hidden rounded-[8px]"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
                  }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border-dim)" }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Radio size={12} style={{ color: "rgba(250,86,96,0.72)" }} />
              <span
                className="truncate font-semibold uppercase"
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--fs-sm)",
                  letterSpacing: "0.1em",
                }}
              >
                Active Source Adapters
              </span>
            </div>
            <span
              className="hidden font-semibold uppercase sm:inline"
              style={{
                color: "var(--text-dim)",
                fontSize: "var(--fs-xs)",
                letterSpacing: "0.1em",
              }}
            >
              Feed + Map Pipeline
            </span>
          </div>

          <div className="flex flex-col">
            {otherSources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                itemCount={itemsBySourceId[source.id]?.length ?? 0}
                acceptedCount={acceptedBySourceId[source.id] ?? 0}
                markerCount={markersBySourceId[source.id] ?? 0}
                domainLabels={domainsBySourceId[source.id] ?? []}
                matchedDomainLabels={matchedDomainsBySourceId[source.id] ?? []}
                collectedAt={collectedAtBySourceId[source.id]}
                requestedAt={requestedAtBySourceId[source.id]}
                error={errorBySourceId[source.id]}
                isLoading={loadingBySourceId[source.id] ?? false}
                onRefresh={() => handleRefresh(source.id)}
              />
            ))}

            {/* ── France 24 group ─────────────────────────────────────────── */}
            {france24Sources.length > 0 && (
              <>
                {/* Group header with collective refresh button */}
                <div
                  className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-2.5"
                  style={{
                    borderTop: "1px solid var(--border-dim)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Radio size={12} style={{ color: "rgba(251,191,36,0.72)", flexShrink: 0 }} />
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: "var(--text-body)",
                        fontSize: "var(--fs-sm)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      France 24
                    </span>
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: "var(--text-dim)",
                        fontSize: "var(--fs-xs)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {france24Sources.length} regional feeds
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshFrance24}
                    disabled={isFrance24Loading}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 font-semibold uppercase transition-colors"
                    title="Refresh all France 24 feeds"
                    style={{
                      color: isFrance24Loading
                        ? "rgba(145,155,170,0.62)"
                        : "rgba(226,232,240,0.94)",
                      background: isFrance24Loading
                        ? "var(--bg-surface)"
                        : "rgba(251,191,36,0.09)",
                      border: isFrance24Loading
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(251,191,36,0.22)",
                      cursor: isFrance24Loading ? "not-allowed" : "pointer",
                      fontSize: "var(--fs-sm)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    <RefreshCw
                      size={12}
                      className={isFrance24Loading ? "animate-spin" : undefined}
                    />
                    {isFrance24Loading ? "Loading…" : "Refresh France 24"}
                  </button>
                </div>

                {france24Sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    itemCount={itemsBySourceId[source.id]?.length ?? 0}
                    acceptedCount={acceptedBySourceId[source.id] ?? 0}
                    markerCount={markersBySourceId[source.id] ?? 0}
                    domainLabels={domainsBySourceId[source.id] ?? []}
                    matchedDomainLabels={matchedDomainsBySourceId[source.id] ?? []}
                    collectedAt={collectedAtBySourceId[source.id]}
                    requestedAt={requestedAtBySourceId[source.id]}
                    error={errorBySourceId[source.id]}
                    isLoading={loadingBySourceId[source.id] ?? false}
                    onRefresh={() => handleRefresh(source.id)}
                  />
                ))}
              </>
            )}

            {/* ── Arab News group ──────────────────────────────────────────── */}
            {arabnewsSources.length > 0 && (
              <>
                <div
                  className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-2.5"
                  style={{
                    borderTop: "1px solid var(--border-dim)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Radio size={12} style={{ color: "rgba(251,146,60,0.72)", flexShrink: 0 }} />
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: "var(--text-body)",
                        fontSize: "var(--fs-sm)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Arab News
                    </span>
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: "var(--text-dim)",
                        fontSize: "var(--fs-xs)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {arabnewsSources.length} feeds
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshArabnews}
                    disabled={isArabnewsLoading}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 font-semibold uppercase transition-colors"
                    title="Refresh all Arab News feeds"
                    style={{
                      color: isArabnewsLoading
                        ? "rgba(145,155,170,0.62)"
                        : "rgba(226,232,240,0.94)",
                      background: isArabnewsLoading
                        ? "var(--bg-surface)"
                        : "rgba(251,146,60,0.09)",
                      border: isArabnewsLoading
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(251,146,60,0.22)",
                      cursor: isArabnewsLoading ? "not-allowed" : "pointer",
                      fontSize: "var(--fs-sm)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    <RefreshCw
                      size={12}
                      className={isArabnewsLoading ? "animate-spin" : undefined}
                    />
                    {isArabnewsLoading ? "Loading…" : "Refresh Arab News"}
                  </button>
                </div>

                {arabnewsSources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    itemCount={itemsBySourceId[source.id]?.length ?? 0}
                    acceptedCount={acceptedBySourceId[source.id] ?? 0}
                    markerCount={markersBySourceId[source.id] ?? 0}
                    domainLabels={domainsBySourceId[source.id] ?? []}
                    matchedDomainLabels={matchedDomainsBySourceId[source.id] ?? []}
                    collectedAt={collectedAtBySourceId[source.id]}
                    requestedAt={requestedAtBySourceId[source.id]}
                    error={errorBySourceId[source.id]}
                    isLoading={loadingBySourceId[source.id] ?? false}
                    onRefresh={() => handleRefresh(source.id)}
                  />
                ))}
              </>
            )}

            {/* ── Sky News group ───────────────────────────────────────────── */}
            {skynewsSources.length > 0 && (
              <>
                <div
                  className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-2.5"
                  style={{
                    borderTop: "1px solid var(--border-dim)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Radio size={12} style={{ color: "rgba(250,86,96,0.72)", flexShrink: 0 }} />
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: "var(--text-body)",
                        fontSize: "var(--fs-sm)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Sky News
                    </span>
                    <span
                      className="font-semibold uppercase"
                      style={{
                        color: "var(--text-dim)",
                        fontSize: "var(--fs-xs)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {skynewsSources.length} feeds
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshSkynews}
                    disabled={isSkynewsLoading}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 font-semibold uppercase transition-colors"
                    title="Refresh all Sky News feeds"
                    style={{
                      color: isSkynewsLoading
                        ? "rgba(145,155,170,0.62)"
                        : "rgba(226,232,240,0.94)",
                      background: isSkynewsLoading
                        ? "var(--bg-surface)"
                        : "var(--accent-blue-bg)",
                      border: isSkynewsLoading
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid var(--accent-blue-border)",
                      cursor: isSkynewsLoading ? "not-allowed" : "pointer",
                      fontSize: "var(--fs-sm)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    <RefreshCw
                      size={12}
                      className={isSkynewsLoading ? "animate-spin" : undefined}
                    />
                    {isSkynewsLoading ? "Loading…" : "Refresh Sky News"}
                  </button>
                </div>

                {skynewsSources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    itemCount={itemsBySourceId[source.id]?.length ?? 0}
                    acceptedCount={acceptedBySourceId[source.id] ?? 0}
                    markerCount={markersBySourceId[source.id] ?? 0}
                    domainLabels={domainsBySourceId[source.id] ?? []}
                    matchedDomainLabels={matchedDomainsBySourceId[source.id] ?? []}
                    collectedAt={collectedAtBySourceId[source.id]}
                    requestedAt={requestedAtBySourceId[source.id]}
                    error={errorBySourceId[source.id]}
                    isLoading={loadingBySourceId[source.id] ?? false}
                    onRefresh={() => handleRefresh(source.id)}
                  />
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
