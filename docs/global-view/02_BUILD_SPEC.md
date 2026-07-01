# Handoff Prompt / Build Spec — Global View "Full-Featured" Detection System

> **Purpose of this file:** paste the block below to a fresh code agent to BUILD
> the targeted system. **Prerequisite:** the comparison in
> `docs/global-view/01_COMPARISON_REPORT_PROMPT.md` has been run and an
> integration option (A / B / C) has been chosen by the product owner. If it has
> not, stop and run the comparison first.
>
> This spec is written to the same quality bar as the Cyber News engine
> (`lib/cyber/`), which is the reference implementation. Reuse its patterns.

---

## PROMPT (give everything below to the agent)

You are a senior engineer building a production-grade, **role-aware,
context-aware detection + aggregation system** for the **Global View** screen of
the ECHIS dashboard (Next.js 16 · React 19 · TypeScript · Tailwind 4). Follow
`AGENTS.md`. Precision and correctness beat coverage — this must be a reference
implementation with no false attributions.

### 0. Read first (do not skip)

- Reference implementation: **all of `lib/cyber/`** + `lib/cyber/README.md`.
  Mirror its structure, provenance/confidence discipline, and **dependency-free
  test harness** (`lib/cyber/__tests__/cyberSignals.test.ts`, run via
  `tsc --module commonjs … → node`). **Do not add a test-runner dependency.**
- Existing Global View filter/detection (you will reuse, not fight it):
  `data/source-intelligence/filters/*` (`applySourceFilters`,
  `contextClassifier`, `keywordDictionaries`, `geopoliticalFilterRules`,
  `normalizeFilterText`) and
  `data/source-intelligence/sourceIntelligenceTypes.ts` — especially
  `SourceEntityRoles`, `GeoEvidenceRole`, `SourceEventType`, `SourceFilterResult`.
- Pipeline + wiring: `data/source-intelligence/sourceIntelligencePipeline.ts`,
  `data/source-intelligence/pipelineWorker.ts`,
  `components/layout/AppShell.tsx` (Global View state `activeView === "global"`,
  markers), `components/source-intelligence/SourceGlobalFeedPanel.tsx`.
- Map reuse pattern (if map region-fill is in scope):
  `lib/cyber/atlasRegions.ts`, the `countryFills` opt-in prop on
  `components/map/SharedWorldMap2D.tsx`, and `components/cyber/CyberMap.tsx`.

### 1. What to build (scope)

A decoupled engine that turns live Global View items into **aggregated,
role-tagged metrics** for the screen, plus the UI panels that render them:

1. **Macro-region metrics** (role-tagged): reuse the region taxonomy and
   `RegionId` from `lib/cyber` (do not fork it — import/extend the shared
   taxonomy). For each item, resolve the countries/regions involved and their
   **role** (attacker/`origin` vs affected/`target` vs `neutral`). A region is
   counted **once per item**; roles tally independently (identical semantics to
   `lib/cyber/analyzeCyberSignals.ts`). Produce `RegionMetric[]`.
2. **Domain / topic metrics** for Global View: aggregate by the existing
   geopolitical **domains/event types** (diplomacy, conflict, sanctions,
   humanitarian, official statement, …) — reuse `SourceEventType` /
   `SourceFilterDomain`, do not invent a parallel taxonomy. Produce
   `DomainMetric[]` (itemCount, share, sample terms).
3. **Provenance + confidence** on every output, exactly like `lib/cyber`
   (`provenance`, `inferred`, per-signal confidence bands).
4. **UI panels** on the Global View screen mirroring the Cyber panels'
   look/behaviour (muted, serious, `--c-*` tokens; empty/loading/error states).
5. **(Optional, only if the chosen option includes it)** map region-fill on the
   Global View globe/2D map using the existing `countryFills` opt-in prop —
   **role-coded muted palette** identical in spirit to `CyberMap.tsx`
   (target = muted oxblood, origin = muted steel, neutral = graphite; intensity
   by mention count). Do NOT touch the frozen globe camera or `SharedWorldMap2D`
   defaults; only pass the opt-in prop.

### 2. Integration rule (critical — avoid a second role system)

The existing filter **already** produces a rich role model
(`SourceEntityRoles`: `primaryActorCountry`, `targetCountry`, `blamedActor`,
`affectedCountry`, `issuingCountry`, …) and geo evidence (`GeoEvidenceRole`).
Per the chosen option:

- **Option A (aggregation-on-top, preferred default):** consume
  `SourceFilterResult` / `SourceEntityRoles` / `eventType` from the pipeline and
  **map them** into `origin/target/neutral` + `RegionId` + domain buckets. Add
  ONLY the rollup + confidence normalization + panels (+ optional map fill).
  Write a small, well-tested **adapter** (`entityRoles → GeoRole`) and a
  **country/region → RegionId** resolver that reuses `lib/cyber` taxonomy.
  Minimal duplication; this is the recommended path unless the report says
  otherwise.
- **Option C (hybrid):** reuse existing geo evidence + event typing, but add a
  thin independent role-attribution pass (like `lib/cyber/regionDetection.ts`)
  ONLY where the existing roles are absent/weak. Reconcile conflicts with a
  documented precedence (existing strong geo-evidence wins over inferred).
- **Option B (parallel engine):** only if explicitly chosen. Build
  `lib/globalview/` mirroring `lib/cyber/` but still **import the shared region
  taxonomy** from `lib/cyber` (never duplicate country→region tables). Document
  why a parallel role pass is justified and add tests proving it agrees with the
  existing roles on a shared fixture set.

Whatever the option: **one source of truth for the region taxonomy** (shared with
Cyber). If `lib/cyber`'s `RegionId`/country tables need to be shared more widely,
lift them to a neutral module (e.g. `lib/geo/`) and have both consumers import it
— but keep this refactor minimal and behavior-preserving.

### 3. Engine shape (mirror `lib/cyber`)

Create the engine as pure, framework-free modules with **type-only** cross-imports
so it stays unit-testable without bundling. Suggested layout (Option A/C):

```
lib/globalview/
  types.ts                 # RegionMetric (reuse), DomainMetric, result + provenance
  entityRoleAdapter.ts     # SourceEntityRoles/GeoEvidence → GeoRole + RegionId
  domainAggregation.ts     # eventType/domain → DomainMetric[]
  analyzeGlobalSignals.ts  # orchestrator: SourceFilterResult[] → metrics
  index.ts                 # barrel
  __tests__/globalSignals.test.ts
  README.md
```

Public entry (example — adjust to the real `SourceFilterResult` shape):

```ts
analyzeGlobalSignals(results: SourceFilterResult[], options?): {
  totalItems: number;
  analyzedItems: number;
  regions: RegionMetric[];   // role-tagged, sorted desc
  domains: DomainMetric[];   // sorted desc, share = items/total
  provenance: "derived_from_source_intelligence";
  inferred: true;
}
```

### 4. Precision policy (hard requirements)

- **No false attribution.** Prefer the existing strong geo-evidence; only infer a
  role when context is unambiguous. Ransomware/generic-actor style pitfalls don't
  apply here, but the equivalents do: don't treat an *issuing* country
  (statement author) as a *target*; don't treat a *mentioned-only* country as
  affected. Map `mentionedOnly`/`backgroundContext` → `neutral`, not `target`.
- **Attacker vs victim** must be preserved: `primaryActorCountry`/`blamedActor` →
  `origin`; `targetCountry`/`affectedCountry`/`eventLocation` (for attacks) →
  `target`; `issuingCountry` for statements → `origin`-side attribution or a
  dedicated `neutral` per the report's decision (document it).
- **Turkish + English** mixed feeds: reuse `normalizeFilterText` semantics (it
  already handles Turkish suffixes and mojibake). Do not regress Turkish
  handling.
- **One region per item** in the count; roles tally independently.
- Everything is **inferred** — set provenance/confidence and never present as
  verified ground truth (`AGENTS.md` §3.6 OSINT-safe wording).

### 5. UI wiring

- Add panels to the Global View screen following the Cyber panels'
  props-in/presentational pattern (`components/cyber/MostMentionedRegionsPanel.tsx`
  and `AffectedSectorsPanel.tsx` are the templates: empty/loading/error states,
  `--c-*` tokens, muted bars, role chip).
- Compute metrics with `useMemo` from the live Global View results and pass as
  props (mirror `components/cyber/CyberSecPanel.tsx`). **No mock data** — panels
  render only live-derived metrics.
- If map region-fill is in scope, build `countryFills` exactly like
  `components/cyber/CyberMap.tsx` (role-coded muted palette, top-N regions,
  intensity by count) and pass via the opt-in prop. Keep the legend subtle.

### 6. Testing (required, dependency-free)

- Add `lib/globalview/__tests__/globalSignals.test.ts` with curated fixtures
  built from **realistic geopolitical items** (mixed EN/TR), asserting:
  attacker→origin / victim→target mapping, issuing-country handling,
  mentioned-only→neutral, macro-region rollup counted-once + role tallies,
  domain aggregation + share math, and provenance flag. Include false-attribution
  guards.
- Run exactly like Cyber (document the command in `lib/globalview/README.md`):
  ```bash
  tmp="$(mktemp -d)"
  ./node_modules/.bin/tsc --module commonjs --moduleResolution node --target es2020 \
    --strict --esModuleInterop --skipLibCheck --outDir "$tmp" \
    lib/globalview/__tests__/globalSignals.test.ts
  node "$tmp/__tests__/globalSignals.test.js"
  ```
  Exit non-zero on any failed assertion. Aim for ≥40 assertions.

### 7. Do NOT touch / do NOT break

- Frozen: globe camera/`DEFAULT_GLOBE_VIEW`, `SharedWorldMap2D` defaults (only
  the opt-in `countryFills` prop may be used), the source pipeline's existing
  accept/reject behaviour and marker eligibility, `HeaderNav`/`LeftRail`/app
  shell structure, storage keys. See `AGENTS.md` §6–§7.
- **No new dependencies, no new env vars, no schema changes** unless the report
  explicitly approved one. Keep mock/live data on their existing paths
  (`AGENTS.md` §3, §5).
- Do not fork the region taxonomy. Do not create a second, drifting role model —
  reconcile with `SourceEntityRoles` per §2.

### 8. Validation (run and report)

- `npm run lint` (0 new problems from your files; pre-existing unrelated errors
  reported separately, not fixed here — `AGENTS.md` §8).
- `npm run build` (types + component/pipeline changes).
- The `lib/globalview` test harness: all assertions pass.
- Manual: Global View shows live region/domain panels; no console errors; other
  screens (Cyber News, Intel Watch, Defense Industry) unaffected; if map fill is
  on, tones are muted/serious and the globe still pans/zooms/resets.

### 9. Final report (use `AGENTS.md` §9 shape)

Files changed · What changed (≤3 bullets) · Validation (lint/build/tests/manual)
· Risks/follow-up. Note explicitly how the new role mapping reconciles with the
existing `SourceEntityRoles` (agreement rate on the fixture set).

### Done when

The engine + panels are live on Global View, metrics are derived from live
source-intelligence results (no mock), the taxonomy is shared (not forked), the
role mapping is reconciled with the existing filter, tests pass, and lint/build
are clean for the changed files.
