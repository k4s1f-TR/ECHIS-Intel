# Handoff Prompt — Global View: Existing Filter vs. Targeted Detection System (COMPARISON REPORT)

> **Purpose of this file:** paste the block below to a fresh code agent. It must
> produce a **written comparison report only — NO code changes.** The report
> decides whether/how we build the "full-featured" detection system described in
> `docs/global-view/02_BUILD_SPEC.md`. Run this **before** any build.

---

## PROMPT (give everything below to the agent)

You are a senior engineer doing a **read-only architecture investigation** of the
ECHIS dashboard (Next.js 16 · React 19 · TypeScript). Follow `AGENTS.md`.
**Do not modify any code.** Your only deliverable is a Markdown report saved to
`docs/global-view/COMPARISON_REPORT_RESULT.md`.

### Context

The **Global View** screen (Monitor tab, `activeView === "global"` in
`components/layout/AppShell.tsx`) shows a live geopolitical feed
(`components/source-intelligence/SourceGlobalFeedPanel.tsx`) and places globe
markers from source-intelligence candidates. It is fed by the
**source-intelligence pipeline + geopolitical filter**.

Separately, the **Cyber News** screen recently got a new, purpose-built
detection engine at `lib/cyber/` (region + sector detection with attacker/victim
**role attribution**, macro-region rollup, provenance/confidence, and a
dependency-free test harness). Leadership wants to know: **should Global View get
an equivalent "full-featured" detection system, and what does it add or duplicate
vs. what already exists?**

### Step 1 — Map the EXISTING Global View filter/detection system

Read and summarize precisely (cite file + line ranges):

- `data/source-intelligence/filters/applySourceFilters.ts` — group keyword
  scoring across domains, negative-noise handling, acceptance threshold, marker
  eligibility.
- `data/source-intelligence/filters/geopoliticalFilterRules.ts` — thresholds
  (`FILTER_ACCEPTANCE_THRESHOLD`, `STRONG_MARKER_THRESHOLD`), `scoreGroup`,
  `strongTriggerGroups`, `domainTags`.
- `data/source-intelligence/filters/keywordDictionaries.ts` — domain lexicons.
- `data/source-intelligence/filters/contextClassifier.ts` — event typing +
  entity-role extraction + leader/actor gazetteer (large file; summarize its
  responsibilities and outputs, don't transcribe it).
- `data/source-intelligence/filters/normalizeFilterText.ts` — normalization +
  phrase-regex cache.
- `data/source-intelligence/sourceIntelligenceTypes.ts` — especially
  `SourceEntityRoles`, `GeoEvidenceRole`, `GeoBasisType`, `SourceEventType`,
  `MarkerReason`, `NoMarkerReason`, `MarkerEligibility`, `SourceFilterResult`.
- `data/source-intelligence/sourceIntelligencePipeline.ts` — how the filter is
  invoked (`runSourceIntelligencePipeline`) and what candidates it emits.
- Consumers: `components/layout/AppShell.tsx` (Global View wiring, markers) and
  `components/source-intelligence/SourceGlobalFeedPanel.tsx`.

For the existing system, document: **inputs**, **normalization**, **role model**
(note it already has `primaryActor/targetCountry/blamedActor/affectedCountry/
issuingCountry` etc.), **event typing**, **geo/marker resolution + evidence
strength**, **scoring/acceptance**, **outputs consumed by the UI**, **provenance/
confidence signaling (if any)**, and **test coverage (if any)**.

### Step 2 — Study the REFERENCE "full-featured" pattern

Read `lib/cyber/` end-to-end and `lib/cyber/README.md`. Capture the design
disciplines it embodies: decoupled pure engine, explicit `origin/target/neutral`
role attribution with context regexes, macro-region rollup counted once per item
with role tallies, weighted context-aware sector model, unified
`provenance/inferred` + confidence bands, and the dependency-free tsc→node test
harness (`lib/cyber/__tests__/`). Also read how Cyber wired region highlights to
the map: `lib/cyber/atlasRegions.ts`, the `countryFills` prop on
`components/map/SharedWorldMap2D.tsx`, and `components/cyber/CyberMap.tsx`.

### Step 3 — Define the TARGETED system for Global View

Based on `docs/global-view/02_BUILD_SPEC.md` (read it), state in your own words
what the targeted system is meant to deliver for Global View (e.g., role-tagged
macro-region metrics + a domain/topic aggregation panel, unified confidence/
provenance, a testable decoupled engine, optional map region-fill), and how it
would interface with the existing pipeline.

### Step 4 — Produce the COMPARISON REPORT

Save `docs/global-view/COMPARISON_REPORT_RESULT.md` with these sections:

1. **Executive summary** (≤10 lines) + a one-line recommendation
   (augment / partially replace / full replace / do-not-build).
2. **Capability matrix** — a table: rows = capabilities (normalization,
   country/demonym detection, attacker/victim role, event typing, macro-region
   rollup, domain/sector aggregation, geo/marker resolution, scoring/acceptance,
   confidence, provenance, aggregation-for-panels, map region-fill, tests).
   Columns = *Existing filter* / *Targeted system* / *Overlap?* / *Gap?*.
3. **What the targeted system genuinely ADDS** (net-new value).
4. **What it DUPLICATES** (esp. the existing `SourceEntityRoles`/`GeoEvidence`
   role model) and the **risk of two parallel role systems** drifting.
5. **Integration options**, each with pros/cons and effort (S/M/L):
   - (A) **Aggregation layer on top** — consume existing `SourceFilterResult`
     (reuse its roles/eventType/geo evidence), add only macro-region/domain
     rollup + panels + tests. Least duplication.
   - (B) **Parallel engine** — new `lib/globalview/` mirroring `lib/cyber/`,
     independent detection. Most consistent with Cyber, most duplication.
   - (C) **Hybrid** — reuse existing detection where strong (geo evidence,
     event typing), add a thin role-normalization + rollup + panels layer.
6. **Precision & correctness risks** (false attribution, Turkish/English mixed
   feeds, actor-vs-victim ambiguity) and how each option handles them.
7. **Performance** (existing pipeline runs in a worker; note item volumes and
   whether new work belongs in the worker vs. the client).
8. **Recommendation** with justification and a phased rollout.
9. **Open questions for the product owner** (bulleted).

### Constraints

- **No code changes.** Report only. Cite exact files/lines.
- Be concrete and skeptical: if the existing `SourceEntityRoles` already covers a
  "new" capability, say so plainly and prefer reuse over reinvention.
- Keep OSINT-safe wording (`AGENTS.md` §3.6). Never paste `.env*` contents.

### Done when

`docs/global-view/COMPARISON_REPORT_RESULT.md` exists, contains the capability
matrix + a clear recommendation among options A/B/C, and lists open questions.
No files other than that report are modified.
