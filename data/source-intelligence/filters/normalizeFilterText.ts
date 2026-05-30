export function normalizeFilterText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Phrase regex cache: compiled once per unique phrase, reused on every call.
//
// Keywords are static string literals that never change at runtime. Without
// this cache, containsNormalizedPhrase creates a new RegExp object for every
// (item x keyword) pair. The cache reduces that to one compilation per unique
// keyword phrase, regardless of how many items or pipeline runs occur.
//
// Map value `false` = the phrase normalised to empty string, always false.
// ---------------------------------------------------------------------------
const _phraseRegexCache = new Map<string, RegExp | false>();

export function containsNormalizedPhrase(
  normalizedText: string,
  phrase: string,
): boolean {
  let entry = _phraseRegexCache.get(phrase);
  if (entry === undefined) {
    const normalizedPhrase = normalizeFilterText(phrase);
    if (!normalizedPhrase) {
      _phraseRegexCache.set(phrase, false);
      return false;
    }
    const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    entry = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`);
    _phraseRegexCache.set(phrase, entry);
  }
  if (entry === false) return false;
  return entry.test(normalizedText);
}
