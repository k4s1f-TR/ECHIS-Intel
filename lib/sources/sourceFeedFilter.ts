import type { NormalizedSourceItem } from "@/data/sources/sourceTypes";

const BLOCKED_TURKISH_TERMS = [
  "chp",
  "belediye",
  "ozgur ozel",
  "kemal kilicdaroglu",
  "trafik kaza",
  "trafik kazasi",
  "mutlak butlan",
] as const;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i");
}

export function shouldExcludeFromSourceFeed(item: NormalizedSourceItem): boolean {
  if (item.sourceLanguage !== "tr") return false;

  const haystack = normalizeText(`${item.title} ${item.summary}`);
  return BLOCKED_TURKISH_TERMS.some((term) => haystack.includes(term));
}
