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
  "securityweek",
  "cisa-news",
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

export function useDefenseIndustryFeed(): DefenseIndustryFeedState {
  const [rawItems, setRawItems] = useState<NormalizedSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAll() {
      setIsLoading(true);
      setError(null);

      const results = await Promise.allSettled(
        DEFENSE_SOURCE_IDS.map(async (sourceId) => {
          const res = await fetch(
            `/api/sources/rss-preview?sourceId=${encodeURIComponent(sourceId)}`,
            { cache: "no-store", signal: controller.signal },
          );
          const payload = (await res.json()) as RssResponse;
          if (!res.ok || payload.error) {
            throw new Error(payload.reason ?? payload.error ?? `source_${res.status}`);
          }
          return Array.isArray(payload.items) ? payload.items : [];
        }),
      );

      if (controller.signal.aborted) return;

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
      setRawItems(merged);
      setError(anyOk ? null : "feed_fetch_failed");
      setIsLoading(false);
    }

    void loadAll();
    return () => controller.abort();
  }, []);

  const analysis = useMemo(() => {
    const inputs: DefenseSignalInput[] = rawItems.map((item) => ({
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
    error,
    relevantItems: analysis.relevantItems,
    totalItems: analysis.totalItems,
  };
}
