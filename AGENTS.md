<!-- BEGIN:nextjs-agent-rules -->
# Next.js Version Notice

This project may use Next.js APIs or conventions that differ from common
training examples. Before making framework-level changes, check the
relevant docs under `node_modules/next/dist/docs/` and follow deprecation
warnings.
<!-- END:nextjs-agent-rules -->

# BoruEyes Agent Instructions

## Project

BoruEyes is a dark, premium OSINT-style situational awareness dashboard
built with Next.js, TypeScript, Tailwind, and a custom Three.js globe.

The current product is a frontend prototype using mock/static data.

## Working Rules

- Make small, scoped changes.
- Preserve existing behavior unless the task clearly asks otherwise.
- Do not refactor unrelated code.
- Do not add backend, auth, database, scraping, live tracking, or real APIs
  unless explicitly requested.
- Use existing mock/static data patterns.
- Do not change data schemas unless required by the task.
- Keep the UI dark, restrained, premium, and analyst-oriented.

## Protected Areas

Do not change these unless the task explicitly targets them:

- app shell
- top navigation
- left rail
- Three.js globe engine
- camera presets
- marker behavior
- label strategy
- map tone / center / zoom / interaction model
- SOCMINT behavior
- Global View marker data
- backend/API/auth/database assumptions

## Product Notes

- The live globe is Three.js-first. MapLibre may exist as a dependency but
  is not the main presentation layer.
- Country labels are baked into the generated globe texture for stability.
  Do not reintroduce DOM, billboard, sprite, or screen-space country labels
  unless explicitly requested.
- Label stability matters more than maximum label coverage.
- Politics and Conflict are moving toward panel/feed-first screens.
- Signals is OSINT signal-environment awareness, not real SIGINT collection.
- Air and Maritime are reserved for future use unless explicitly requested.
- Sources refers to the Source Registry screen.
- Source counts should be derived from `mockEvents.sourceId` where possible.
- Do not re-add removed left-rail Situation or Sources icons.

## UI Guidance

- Avoid excessive glow, decorative borders, or busy visual effects.
- Side panels should support the main view, not overpower it.
- Do not make non-functional UI look active.
- Prefer clean, sharp icon styling.
- Keep header, left rail, top nav, and module navigation visually consistent.

## Data Guidance

- Events should follow the existing `OsintEvent` model.
- Sources should follow the existing `OsintSource` model.
- New mock data should use existing categories, regions, source IDs,
  severity values, and verification values where possible.
- Do not invent live/current factual claims. Use generic OSINT-style mock
  placeholders.

## Validation

- Run `npm run lint` after changes.
- On Windows PowerShell, use `npm.cmd run lint` if execution policy blocks
  npm scripts.
- Run `npm run build` when TypeScript, imports, data models, or component
  structure change.
- For tiny CSS/text-only changes, lint is usually enough.

## Final Response Format

Keep summaries short:

- Files changed
- What changed, max 3 bullets
- Validation result
- Risks or follow-up, only if relevant

## Communication Rules

- Do not narrate your internal process.
- Do not print progress updates like “I’m reading…”, “I’ve located…”,
  “I’m now checking…”, or “Next I will…”.
- Do not summarize tool usage while working.
- Do not explain obvious repo inspection steps.
- Work silently until you have either:
  - completed the task, or
  - hit a blocker that requires user input.
- Final response only:
  - Files changed
  - What changed, max 3 bullets
  - Validation result
  - Risks/follow-up only if relevant


Silent mode:
Do not output any intermediate status messages.
No “I’m going to…”, “I’ve located…”, “I’m reading…”, “Next I’m…”
or similar progress narration.
Do the work silently.
Only produce the final summary after completion, or ask only if blocked.