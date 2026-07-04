# Task Prompt — Policy (Dossier) detection-filter engine

Use AGENTS.md. This is a handoff brief for building the **third** per-screen
detection engine. Two sibling engines already ship and define every
convention you need — **mirror them, do not invent new patterns**:

- `lib/cyber/` — Cyber News engine (regions with attacker/victim roles + sectors)
- `lib/defense/` — Defense Industry engine (segments, supply-chain stress, buyer/supplier roles)

Read both READMEs (`lib/defense/README.md`) and skim `lib/defense/detect.ts`
before writing code.

---

## Task

Build `lib/policy/` — an independent detection-filter engine for the Policy
"Dossier" screen (`components/policy/`), deriving live report metadata from
RSS text (title + summary), replacing the mock-only feed.

Entry point (mirror the siblings):

```ts
analyzePolicySignals(items: PolicySignalInput[]) => {
  items: PolicyReportLive[];      // enriched feed reports
  topics: ...;                    // counts per PolicyTopic (for the topic tabs)
  regions: ...;                   // most-mentioned regions
  totalItems; relevantItems;
  provenance: "derived_from_rss_text"; inferred: true;
}
```

## What the engine must detect per item

The screen's data model is `types/policy.ts` (`PolicyReport`). Live items
must satisfy the same render contract (`PolicyReportLive` may extend it, as
`DefenseFeedItemLive` does):

1. **Topic classification** → one of `POLICY_TOPICS` (7 fixed values:
   Diplomacy, Defense & Security, Economy & Sanctions, Intl. Organizations,
   Official Statements, Energy, Crisis & Conflict). Weighted keyword lexicon
   (`NormPattern { term, weight }`, score threshold ≥ 2, longest-first
   overlap suppression) — copy the `scorePatterns` approach from
   `lib/defense/detect.ts`. Fallback topic when ambiguous: pick from the
   strongest signal, not a hardcoded default, unless nothing matches.
2. **Region** → reuse `lib/cyber/geoLexicon.ts` (`NORMALIZED_COUNTRIES`,
   `REGION_DIRECT`, `regionLabel`) + `lib/cyber/normalize.ts`
   (`normalizeText`, `findTermSpans`). Do NOT build a new gazetteer.
   `PolicyReport.region` is a display string — use the macro-region label
   (or the country name when exactly one country dominates).
3. **Severity** (`sev`: critical/high/medium/low) → signal-based, like
   defense's impact: escalation/urgency terms (clash, strike, mobilization,
   ultimatum, emergency session…), magnitude terms (nationwide, multi-state,
   billion…), de-escalation terms lower it (ceasefire, agreement, talks
   resume). Official-source hint lifts confidence, not severity.
4. **Tags** → 2–4 short tags from matched lexicon terms (deduped, title-cased),
   like the mock's `tags`.
5. **Relevance gate** → drop items with no policy/diplomacy/geopolitics signal
   (`gateRelevance` option, default true), mirroring `NORM_RELEVANCE` in
   `lib/defense/lexicon.ts`.
6. **Channel** → `sourceType: "News"` for all RSS sources (Telegram ingestion
   does not exist yet; keep the `PolicyChannel` union unchanged).

## Wiring (mirror `components/defense-industry/useDefenseIndustryFeed.ts` EXACTLY)

- `components/policy/usePolicyFeed.ts`:
  - `POLICY_SOURCE_IDS` const — see "Sources" below.
  - Fetch each id from `/api/sources/rss-preview?sourceId=…`,
    `Promise.allSettled`, merge, dedupe by `id || url || title`, sort newest
    first, error only if ALL sources fail.
  - **Module-level cache** (5 min TTL, matching the route) + in-flight dedupe
    + `prefetchPolicyFeed()` export. Copy the pattern from
    `useDefenseIndustryFeed.ts` verbatim — this is what makes tab switches
    instant. Add `prefetchPolicyFeed()` to the existing prefetch effect in
    `components/layout/AppShell.tsx` (one line; AppShell already calls
    `prefetchCyberNewsFeed()` + `prefetchDefenseIndustryFeed()`).
- `minsAgo`: live items must compute it from `publishedAt`
  (`Math.round((Date.now() - ts) / 60000)`) — `policyView.ts` already funnels
  freshness through `minutesAgo()`, so time-window filtering and the trend
  chart then work unchanged.
- `computePolicyView` (`components/policy/policyView.ts`) stays the filter/
  view layer — feed it live reports instead of `policyReports`. Keep its API.
- Empty/loading/error states in the panels; NO mock fallback. Whether
  `data/policyReports.ts` is deleted or kept temporarily → ask the user
  (they removed the defense mock entirely; expect the same wish here).

## Sources

There are currently NO sources with `targetScreens: ["policy", …]`. Propose a
starter set to the user before wiring. Good candidates already registered in
`data/sources/sourceDefinitions.ts` AND allowlisted in
`app/api/sources/rss-preview/route.ts` (politics/diplomacy-leaning):
`skynews-politics`, `presstv-politics`, `mehr-politics`, `saba-politics`,
`tanjug-politika`, `gazetauz-politics`, `aljazeera-middle-east`, `tass-world`,
`euronews-world`. If new sources are added, follow the existing definition
shape + add to the route allowlist; new `targetScreens` value (e.g.
`"policy"`) must be added to the `SourceTargetScreen` union in
`data/sources/sourceTypes.ts` (check the exact type name there).

## Tests

Mirror `lib/defense/__tests__/defenseSignals.test.ts`: dependency-free node
test, compiled via tsc to a temp dir (imports reach `../cyber`, so compile
output must preserve the folder layout — see the README note). Cover: topic
classification per topic, region attribution (country + REGION_DIRECT),
severity escalation vs de-escalation, relevance gate, tags.

## Scope

- New: `lib/policy/` (types.ts, lexicon.ts, detect.ts, analyzePolicySignals.ts,
  index.ts, README.md, `__tests__/`), `components/policy/usePolicyFeed.ts`.
- Modified: `components/policy/PolicyDossierScreen.tsx` (+ children as needed),
  `components/layout/AppShell.tsx` (prefetch line only),
  `data/sources/sourceDefinitions.ts` + rss-preview allowlist (only if
  sources are added), `types/policy.ts` (only if `PolicyReportLive` needs it).

## Do not touch

- `lib/cyber/` and `lib/defense/` internals (import from them only).
- `SharedWorldMap2D`, globe components, unrelated screens, storage keys.
- `policyView.ts` public API (extend, don't reshape).
- The `.cyber-premium` token system; Policy uses `POLICY_SEV` tokens as-is.

## Acceptance

- Policy screen renders live RSS-derived reports with topic tabs, region
  stats, source breakdown, trend bars and detail/related panels all working
  off live data; empty/loading/error states instead of mock.
- Tab switch away/back does NOT refetch or flash loading (module cache).
- All detection is OSINT-safe wording, inferred-from-text provenance.
- `npm run lint` and `npm run build` pass; engine tests pass.

## Validation

npm run lint · npm run build · engine unit tests · manual browser check
(Policy tab: filters, search, time windows, detail panel, no console errors).
