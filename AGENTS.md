<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BoruEyes Agent Instructions

## Project Identity

BoruEyes is a dark, premium, OSINT-style situational awareness dashboard built with Next.js, TypeScript, Tailwind, and a Three.js-first globe system. MapLibre may remain as a dependency, but the live globe presentation is currently custom Three.js.

The project is currently a frontend prototype using mock/static data.

## Hard Rules

- Make minimal, scoped changes.
- Do not refactor unrelated code.
- Do not add real APIs, backend, database, auth, scraping, or live tracking unless explicitly requested.
- Use mock/static data unless explicitly requested otherwise.
- Preserve the existing dark premium BoruEyes UI language.
- Preserve existing behavior unless the task explicitly changes it.
- Do not re-add removed left-rail Situation or Sources icons.
- Do not implement Air or Maritime unless explicitly requested.
- Do not change the Three.js globe engine, camera presets, marker behavior, label strategy, map tone, center, zoom, or interaction model unless explicitly requested.
- Do not change data schemas unless the task explicitly requires it.

## Current Product Decisions

- Top-nav "Situation" may be visually renamed to "Monitor"; internal state may remain `situation` if safer.
- Politics and Conflict are moving toward panel/feed-first screens, not globe/map-first screens.
- Signals is an OSINT signal-environment awareness module, not real SIGINT collection.
- Air is reserved for future aircraft tracking.
- Maritime is reserved for future vessel/AIS tracking.
- Sources is the top-nav Source Registry screen.
- Source counts should be derived from `mockEvents.sourceId` when possible.
- Radar infrastructure has been removed from Signals for now unless explicitly reintroduced later.
- The current globe/map presentation is Three.js-first, not MapLibre-first.
- Country labels are currently baked into the generated globe texture for stability.
- Do not reintroduce DOM/screen-space country label selection or billboard/sprite country labels unless explicitly requested.
- Label stability is prioritized over maximum label coverage.

## UI Rules

- Keep BoruEyes dark, restrained, modern, and analyst-oriented.
- Avoid bright decorative borders, unnecessary glow, and busy effects.
- Side panels should support the main view, not overpower it.
- Header, left rail, top navigation, and module navigation should stay visually consistent.
- If a UI element is not functional, avoid making it look active.
- Prefer clean, sharp icon styling over fuzzy glow/halo effects.

## Data Rules

- Events should follow the existing `OsintEvent` model.
- Sources should follow the existing `OsintSource` model.
- New mock data must use valid existing categories, regions, source IDs, severity values, and verification values.
- Do not invent live/current factual claims. Mock events should be generic OSINT-style placeholders.

## Validation

- Run `npm run lint` after changes.
- On Windows PowerShell, if `npm run lint` is blocked by execution policy, use `npm.cmd run lint`.
- Run `npm run build` when TypeScript, imports, data models, or component structure change.
- For tiny label/CSS-only changes, lint is usually enough unless errors appear.

## Output Format

Keep final summaries short:

- Files changed
- What changed, max 3 bullets
- Validation result
- Any risk or follow-up, if relevant
