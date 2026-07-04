"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import {
  analyzePolicySignals,
  type PolicyRegionMetric,
  type PolicyReportLive,
  type PolicySignalInput,
  type PolicyTopicMetric,
} from "@/lib/policy";

/** RSS sources feeding the Policy Dossier screen (allowlisted in the route). */
export const POLICY_SOURCE_IDS = [
  "skynews-politics",
  "presstv-politics",
  "mehr-politics",
  "saba-politics",
  "tanjug-politika",
  "gazetauz-politics",
  "aljazeera-middle-east",
  "tass-world",
  "euronews-world",
] as const;

interface RssResponse {
  items?: NormalizedSourceItem[];
  error?: string;
  reason?: string;
}

export interface PolicyFeedState {
  items: PolicyReportLive[];
  topics: PolicyTopicMetric[];
  regions: PolicyRegionMetric[];
  isLoading: boolean;
  error: string | null;
  relevantItems: number;
  totalItems: number;
}

function itemTime(item: NormalizedSourceItem): number {
  return new Date(item.publishedAt || item.collectedAt || 0).getTime();
}

const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

type FeedSnapshot = {
  items: NormalizedSourceItem[];
  error: string | null;
};

let feedCache: FeedSnapshot | null = null;
let feedCacheAt = 0;
let feedInFlight: Promise<FeedSnapshot> | null = null;

async function fetchAllSources(): Promise<FeedSnapshot> {
  const results = await Promise.allSettled(
    POLICY_SOURCE_IDS.map(async (sourceId) => {
      const res = await fetch(
        `/api/sources/rss-preview?sourceId=${encodeURIComponent(sourceId)}`,
        { cache: "no-store" },
      );
      const payload = (await res.json()) as RssResponse;
      if (!res.ok || payload.error) {
        throw new Error(payload.reason ?? payload.error ?? `source_${res.status}`);
      }
      return Array.isArray(payload.items) ? payload.items : [];
    }),
  );

  const merged: NormalizedSourceItem[] = [];
  const seen = new Set<string>();
  let anyOk = false;
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    anyOk = true;
    for (const item of result.value) {
      const key = item.id || item.url || item.title;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  merged.sort((a, b) => itemTime(b) - itemTime(a));
  return { items: merged, error: anyOk ? null : "feed_fetch_failed" };
}

function loadFeed(): Promise<FeedSnapshot> {
  if (feedCache && !feedCache.error && Date.now() - feedCacheAt < FEED_CACHE_TTL_MS) {
    return Promise.resolve(feedCache);
  }
  if (feedInFlight) return feedInFlight;

  feedInFlight = fetchAllSources()
    .then((snapshot) => {
      if (!snapshot.error) {
        feedCache = snapshot;
        feedCacheAt = Date.now();
        return snapshot;
      }
      return feedCache ?? snapshot;
    })
    .finally(() => {
      feedInFlight = null;
    });
  return feedInFlight;
}

/** Warm the feed cache without mounting the screen (called once at app open). */
export function prefetchPolicyFeed(): void {
  void loadFeed().catch(() => {});
}

export function usePolicyFeed(): PolicyFeedState {
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(feedCache);
  const [isLoading, setIsLoading] = useState(feedCache === null);

  useEffect(() => {
    let cancelled = false;

    loadFeed().then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const rawItems = snapshot?.items;
  const analysis = useMemo(() => {
    const inputs: PolicySignalInput[] = (rawItems ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.sourceName,
      url: item.url,
      publishedAt: item.publishedAt,
      collectedAt: item.collectedAt,
      verificationStatus: item.verificationStatus,
      sourceType: item.sourceName,
    }));
    return analyzePolicySignals(inputs);
  }, [rawItems]);

  return {
    items: analysis.items,
    topics: analysis.topics,
    regions: analysis.regions,
    isLoading,
    error: snapshot?.error ?? null,
    relevantItems: analysis.relevantItems,
    totalItems: analysis.totalItems,
  };
}
