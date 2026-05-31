import { candidateSourceDefinitions } from "@/data/sources/sourceDefinitions";
import { fetchRssPreview } from "./rssPreviewAdapter";

export const RSS_PREVIEW_DIAGNOSTIC_SOURCE_IDS = [
  "wam-uae-news",
  "vna-politics",
  "vna-security",
] as const;

export async function runRssPreviewDiagnostics(): Promise<
  Array<{ sourceId: string; ok: boolean; itemCount?: number; error?: string }>
> {
  const sources = candidateSourceDefinitions.filter((source) =>
    RSS_PREVIEW_DIAGNOSTIC_SOURCE_IDS.includes(
      source.id as (typeof RSS_PREVIEW_DIAGNOSTIC_SOURCE_IDS)[number],
    ),
  );

  const results = [];
  for (const source of sources) {
    try {
      const items = await fetchRssPreview(source);
      results.push({ sourceId: source.id, ok: true, itemCount: items.length });
    } catch (error) {
      results.push({
        sourceId: source.id,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }
  return results;
}
