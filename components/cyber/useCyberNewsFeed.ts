"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import type { CyberNewsContext, CyberNewsItem } from "@/types/cyberNews";

/** RSS sources feeding the Cyber News screen (allowlisted in the route). */
export const CYBER_NEWS_SOURCE_IDS = [
  "the-hacker-news",
  "bleeping-computer",
  "the-record",
  "dark-reading",
  "cyberscoop",
  "securityweek",
  "cisa-news",
  "talos",
  "unit42",
  "krebs-security",
  "helpnet-security",
  "infosecurity-mag",
  "register-security",
  "welivesecurity",
  "malwarebytes",
  "securelist",
  "ncsc-uk",
  "schneier",
] as const;

/** Human-readable source label for the map info strip. */
export const CYBER_NEWS_SOURCE_LABEL =
  "The Hacker News · BleepingComputer · The Record · Dark Reading · CyberScoop · Talos · Unit 42 · Krebs · SecurityWeek · CISA + more";

type CyberNewsFeedResponse = {
  sourceId?: string;
  items?: NormalizedSourceItem[];
  collectedAt?: string;
  error?: string;
  reason?: string;
};

type CyberNewsFeedState = {
  items: CyberNewsItem[];
  isLoading: boolean;
  error: string | null;
  collectedAt: string | null;
};

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "RSS item";

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function formatContextTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "RSS item";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// Fallback values only — the Threat Context panel overrides country / sector /
// actor with per-item engine annotations (lib/cyber) when they exist.
function buildContext(item: NormalizedSourceItem): CyberNewsContext {
  const publishedAt = item.publishedAt || item.collectedAt;

  return {
    country: item.relatedCountries[0] ?? "Global",
    hackIncident: item.title,
    targetSector: item.category || "Cyber Security",
    contextSummary:
      item.summary || "The source RSS item did not include a summary.",
    firstSeen: formatContextTime(publishedAt),
    lastUpdate: formatContextTime(item.collectedAt || publishedAt),
  };
}

function toCyberNewsItem(item: NormalizedSourceItem, index: number): CyberNewsItem {
  const publishedAt = item.publishedAt || item.collectedAt;

  return {
    id: item.id || `cyber-news-${index}`,
    headline: item.title,
    source: item.sourceName || "RSS Source",
    timeAgo: formatRelativeTime(publishedAt),
    summary: item.summary || "The source RSS item did not include a summary.",
    categoryTag: item.category || "Cyber Security",
    url: item.url,
    publishedAt,
    isLive: true,
    context: buildContext(item),
  };
}

function itemTime(item: NormalizedSourceItem): number {
  return new Date(item.publishedAt || item.collectedAt || 0).getTime();
}

// ── Module-level feed cache ─────────────────────────────────────────────────
// The Cyber News screen unmounts on every tab switch. Keeping the fetched feed
// in module scope means returning to the tab renders instantly from memory and
// only refreshes in the background once the snapshot is stale. Mirrors the
// server route's 5-minute RSS cache TTL.

const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

type FeedSnapshot = {
  items: NormalizedSourceItem[];
  error: string | null;
  collectedAt: string | null;
};

let feedCache: FeedSnapshot | null = null;
let feedCacheAt = 0;
let feedInFlight: Promise<FeedSnapshot> | null = null;

async function fetchAllSources(): Promise<FeedSnapshot> {
  const results = await Promise.allSettled(
    CYBER_NEWS_SOURCE_IDS.map(async (sourceId) => {
      const response = await fetch(
        `/api/sources/rss-preview?sourceId=${encodeURIComponent(sourceId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as CyberNewsFeedResponse;

      if (!response.ok || payload.error) {
        throw new Error(
          payload.reason ?? payload.error ?? `source_${response.status}`,
        );
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
  return {
    items: merged,
    error: anyOk ? null : "feed_fetch_failed",
    collectedAt: anyOk ? new Date().toISOString() : null,
  };
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
export function prefetchCyberNewsFeed(): void {
  void loadFeed().catch(() => {});
}

export function useCyberNewsFeed(): CyberNewsFeedState {
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

  const items = snapshot?.items;
  const cyberItems = useMemo(
    () => (items ?? []).map(toCyberNewsItem),
    [items],
  );

  return {
    items: cyberItems,
    isLoading,
    error: snapshot?.error ?? null,
    collectedAt: snapshot?.collectedAt ?? null,
  };
}
