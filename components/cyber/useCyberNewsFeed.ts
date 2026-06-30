"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";
import type { CyberNewsContext, CyberNewsItem } from "@/types/cyberNews";

export const CYBER_NEWS_SOURCE_ID = "the-hacker-news";

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

function buildContext(item: NormalizedSourceItem): CyberNewsContext {
  const publishedAt = item.publishedAt || item.collectedAt;

  return {
    country: item.relatedCountries[0] ?? "Global",
    affectedEntity: "Not specified by RSS source",
    hackIncident: item.title,
    attackTypeVector: "RSS source item",
    threatActorGroup: "Not specified by RSS source",
    targetAsset: "Not specified by RSS source",
    targetSector: item.category || "Cyber Security",
    contextSummary:
      item.summary || "The source RSS item did not include a summary.",
    firstSeen: formatContextTime(publishedAt),
    lastUpdate: formatContextTime(item.collectedAt || publishedAt),
    confidence: "Medium",
    impact: "Low",
    confidenceLevel: 3,
    impactLevel: 2,
  };
}

function toCyberNewsItem(item: NormalizedSourceItem, index: number): CyberNewsItem {
  const publishedAt = item.publishedAt || item.collectedAt;

  return {
    id: item.id || `${CYBER_NEWS_SOURCE_ID}-${index}`,
    headline: item.title,
    source: item.sourceName || "The Hacker News",
    timeAgo: formatRelativeTime(publishedAt),
    summary: item.summary || "The source RSS item did not include a summary.",
    categoryTag: item.category || "Cyber Security",
    severityTag: "RSS",
    severityLevel: "low",
    accentColor: "#38a869",
    url: item.url,
    publishedAt,
    isLive: true,
    context: buildContext(item),
  };
}

export function useCyberNewsFeed(): CyberNewsFeedState {
  const [items, setItems] = useState<NormalizedSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectedAt, setCollectedAt] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeed() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/sources/rss-preview?sourceId=${encodeURIComponent(CYBER_NEWS_SOURCE_ID)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as CyberNewsFeedResponse;

        if (!response.ok || payload.error) {
          throw new Error(
            payload.reason ?? payload.error ?? `source_${response.status}`,
          );
        }

        setItems(Array.isArray(payload.items) ? payload.items : []);
        setCollectedAt(payload.collectedAt ?? new Date().toISOString());
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "feed_fetch_failed");
        setItems([]);
        setCollectedAt(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadFeed();
    return () => controller.abort();
  }, []);

  const cyberItems = useMemo(
    () => items.map(toCyberNewsItem),
    [items],
  );

  return {
    items: cyberItems,
    isLoading,
    error,
    collectedAt,
  };
}
