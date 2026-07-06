import {
  POLICY_TOPICS,
  type PolicyReport,
  type PolicyTopicKey,
} from "@/types/policy";

// ── Freshness ──────────────────────────────────────────────────────
// Single funnel for "how old is this report?". Today it reads the mock
// `minsAgo`; swapping to real timestamps later means changing only this
// one function: `Math.round((Date.now() - report.publishedAt) / 60000)`.
export function minutesAgo(report: PolicyReport): number {
  return report.minsAgo;
}

export function fmtAgo(m: number): string {
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m ago` : `${h}h ago`;
}

// ── Most Mentioned Regions ─────────────────────────────────────────
export type RegionStat = { region: string; count: number; pct: number };

export function buildRegions(list: PolicyReport[]): RegionStat[] {
  const counts: Record<string, number> = {};
  for (const item of list) counts[item.region] = (counts[item.region] ?? 0) + 1;
  const arr = Object.entries(counts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const max = Math.max(1, ...arr.map((a) => a.count));
  return arr.map((a) => ({ ...a, pct: Math.round((a.count / max) * 100) }));
}

// ── Source Breakdown ───────────────────────────────────────────────
// Split by source affiliation (transparency), not by collection channel:
// every current source is RSS/News, so a channel split carried no signal.
export type SourceStat = { label: string; count: number; pct: number; color: string };

export function buildSources(list: PolicyReport[]): SourceStat[] {
  const total = list.length || 1;
  const state = list.filter((item) => item.stateAffiliated).length;
  const independent = list.length - state;
  return [
    {
      label: "Independent / commercial",
      count: independent,
      pct: Math.round((independent / total) * 100),
      color: "var(--c-accent)",
    },
    {
      label: "State-affiliated",
      count: state,
      pct: Math.round((state / total) * 100),
      color: "rgba(196,202,212,0.72)",
    },
  ];
}

// ── Signal Volume ──────────────────────────────────────────────────
// The active window (3/6/12/24h) is split into 12 equal buckets; newest
// on the right. Bar height scales by count (min 5%), opacity by share.
export type TrendBucket = { count: number; pct: number; opacity: number };

export function buildTrend(list: PolicyReport[], hours: number): TrendBucket[] {
  const n = 12;
  const seg = (hours * 60) / n;
  const buckets = new Array<number>(n).fill(0);
  for (const item of list) {
    let idx = Math.floor(minutesAgo(item) / seg);
    if (idx >= n) idx = n - 1;
    if (idx < 0) idx = 0;
    buckets[n - 1 - idx]++;
  }
  const max = Math.max(1, ...buckets);
  return buckets.map((count) => ({
    count,
    pct: Math.max(5, (count / max) * 100),
    opacity: 0.32 + 0.68 * (count / max),
  }));
}

// ── Topic tabs ─────────────────────────────────────────────────────
// Counts reflect items within the active time window, independent of the
// selected topic.
export type TopicTab = { key: PolicyTopicKey; label: string; count: number; active: boolean };

export function buildTopics(
  all: PolicyReport[],
  time: number,
  topic: PolicyTopicKey,
): TopicTab[] {
  const within = all.filter((i) => minutesAgo(i) <= time * 60);
  const counts: Record<string, number> = {};
  for (const t of POLICY_TOPICS) counts[t] = 0;
  for (const i of within) counts[i.topic]++;
  const tabs: { key: PolicyTopicKey; label: string; count: number }[] = [
    { key: "all", label: "All Topics", count: within.length },
    ...POLICY_TOPICS.map((t) => ({ key: t, label: t, count: counts[t] })),
  ];
  return tabs.map((c) => ({ ...c, active: topic === c.key }));
}

// ── Derived view ───────────────────────────────────────────────────
export type PolicyView = {
  list: PolicyReport[];
  selected: PolicyReport | null;
  related: PolicyReport[];
  topics: TopicTab[];
  regions: RegionStat[];
  sources: SourceStat[];
  trend: TrendBucket[];
};

export function computePolicyView(
  all: PolicyReport[],
  time: number,
  topic: PolicyTopicKey,
  query: string,
  selectedId: string | null,
): PolicyView {
  let list = all.filter((i) => minutesAgo(i) <= time * 60);
  if (topic !== "all") list = list.filter((i) => i.topic === topic);
  if (query) {
    const s = query.toLowerCase();
    list = list.filter((i) =>
      `${i.title} ${i.summary} ${i.source} ${i.region} ${i.topic}`.toLowerCase().includes(s),
    );
  }
  // Most-recent first.
  list = list.slice().sort((a, b) => minutesAgo(a) - minutesAgo(b));

  // If the current selection was filtered out, fall back to the newest item.
  const selected = list.find((i) => i.id === selectedId) ?? list[0] ?? null;

  const related = selected
    ? all
        .filter(
          (i) =>
            i.id !== selected.id &&
            (i.topic === selected.topic || i.region === selected.region),
        )
        .sort((a, b) => minutesAgo(a) - minutesAgo(b))
        .slice(0, 3)
    : [];

  return {
    list,
    selected,
    related,
    topics: buildTopics(all, time, topic),
    regions: buildRegions(list),
    sources: buildSources(list),
    trend: buildTrend(list, time),
  };
}
