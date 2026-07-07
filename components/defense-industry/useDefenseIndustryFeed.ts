"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import {
  analyzeDefenseSignals,
  type DefenseFeedItemLive,
  type DefenseSegmentMetric,
  type DefenseSupplyChainMetric,
  type DefenseSignalInput,
} from "@/lib/defense";

/** RSS sources feeding the Defense Industry screen (allowlisted in the route). */
export const DEFENSE_SOURCE_IDS = [
  "breaking-defense",
  "defensenews-all",
  "the-war-zone",
  "the-aviationist",
  "defense-one",
  "naval-news",
  "edr-magazine",
  "usni-news",
  "dsca-fms",
  "defensescoop",
  "airspace-forces",
  "defence-industry-eu",
  "defence-blog",
  "savunmatr",
] as const;

interface RssResponse {
  items?: NormalizedSourceItem[];
  error?: string;
  reason?: string;
}

export interface DefenseIndustryFeedState {
  items: DefenseFeedItemLive[];
  segments: DefenseSegmentMetric[];
  supplyChain: DefenseSupplyChainMetric[];
  isLoading: boolean;
  error: string | null;
  relevantItems: number;
  totalItems: number;
}

function itemTime(item: NormalizedSourceItem): number {
  return new Date(item.publishedAt || item.collectedAt || 0).getTime();
}

// ── Module-level feed cache ─────────────────────────────────────────────────
// The Defense Industry screen unmounts on every tab switch. Keeping the fetched
// feed in module scope means returning to the tab renders instantly from memory
// and only refreshes in the background once the snapshot is stale. Mirrors the
// server route's 5-minute RSS cache TTL.

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
    DEFENSE_SOURCE_IDS.map(async (sourceId) => {
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
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    anyOk = true;
    for (const item of r.value) {
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
      // All sources failed: keep serving the last good snapshot if we have one.
      return feedCache ?? snapshot;
    })
    .finally(() => {
      feedInFlight = null;
    });
  return feedInFlight;
}

/** Warm the feed cache without mounting the screen (called once at app open). */
export function prefetchDefenseIndustryFeed(): void {
  void loadFeed().catch(() => {});
}

export function useDefenseIndustryFeed(): DefenseIndustryFeedState {
  // Any cached snapshot (even stale) renders immediately; a stale one is
  // refreshed in the background by the effect below.
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
    const inputs: DefenseSignalInput[] = (rawItems ?? []).map((item) => ({
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
    return analyzeDefenseSignals(inputs);
  }, [rawItems]);

  return {
    items: analysis.items,
    segments: analysis.segments,
    supplyChain: analysis.supplyChain,
    isLoading,
    error: snapshot?.error ?? null,
    relevantItems: analysis.relevantItems,
    totalItems: analysis.totalItems,
  };
}
