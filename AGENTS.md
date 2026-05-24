<!-- BEGIN:nextjs-agent-rules -->
# Next.js Version Notice

This project may use Next.js APIs or conventions that differ from common
training examples. Before making framework-level changes, check the relevant
docs under `node_modules/next/dist/docs/` and follow deprecation warnings.
<!-- END:nextjs-agent-rules -->

# TaipanMonitor Agent Instructions

## Purpose of This File

This file is the standing instruction set for coding agents working on
TaipanMonitor.

Task prompts should stay short and only include the current task, scope,
do-not-touch items, acceptance criteria, and validation requirements.

Use this structure for future task prompts:

```text
Use AGENTS.md.

Task:
...

Scope:
...

Do not touch:
...

Acceptance:
...

Validation:
...
```

---

## Project

TaipanMonitor is a frontend-only, dark premium OSINT / situational-awareness /
intelligence monitoring dashboard prototype.

The interface should feel:

- dark
- premium
- restrained
- serious
- analyst-oriented
- operational
- professional

Avoid:

- game-like HUD UI
- flashy sci-fi panels
- marketing / landing-page visuals
- generic cyberpunk styling
- hacker clichés
- excessive neon or glow
- filler modules added only to occupy empty space

The current product uses mock/static frontend data only.

---

## Stack

Main stack:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- lucide-react
- MapLibre GL
- topojson-client
- world-atlas
- react-simple-maps

The active Monitor / Global View / SOCMINT globe is **MapLibre-only**.

Do not reintroduce Three.js as an active globe renderer.

---

## Core Working Rules

- Make small, scoped changes.
- Preserve existing behavior unless the task clearly asks otherwise.
- Do not refactor unrelated code.
- Do not add backend, auth, database, scraping, live tracking, real APIs,
  websocket infrastructure, or persistence unless explicitly requested.
- Use existing mock/static data patterns.
- Do not change data schemas unless required by the task.
- Do not invent live/current factual claims.
- Keep wording neutral and OSINT-safe.
- Keep the UI dark, restrained, premium, and analyst-oriented.
- Follow existing component, data, and styling patterns.
- Add abstractions only when they clearly reduce complexity.

---

## Branding and Navigation

Visible product/UI brand:

```text
TaipanMonitor
```

Current top-level product direction/order:

```text
Monitor → Intel Watch → Cyber News → Defense Industry → Policy → Sources
```

Visible naming rules:

- `Politics` should appear as `Policy`.
- `Cyber Sec.` should appear as `Cyber News`.
- Legacy names such as `borueyes` may still exist in paths, storage keys, or
  internal references. Do not rename them unless explicitly requested.

---

## Known Architecture

Common project structure:

- `app/page.tsx` renders `<AppShell />`
- `app/layout.tsx` imports global CSS / MapLibre CSS and app metadata
- `app/globals.css` contains global dark theme, overflow, and scrollbars
- `components/layout/AppShell.tsx` owns app state and screen switching
- `components/layout/HeaderNav.tsx` controls top navigation
- `components/layout/LeftRail.tsx` controls the icon-only left rail
- `components/events/*` contains event cards / right panel / bookmarks logic
- `components/signals/*` contains SOCMINT panel/card logic
- `components/sources/SourcesScreen.tsx` contains the Source Registry screen
- `components/politics/PoliticsPanel.tsx` contains Policy
- `components/cyber/*` contains Cyber News
- `components/intel-watch/*` contains Intel Watch
- active Monitor / Global View / SOCMINT globe logic is MapLibre-only

If old Three.js files or comments still exist, do not treat them as the active
globe system. Clean them only when the current task explicitly asks for cleanup.

---

## Protected Areas

Do not change these unless the task explicitly targets them:

- app shell
- top navigation
- left rail
- unrelated tabs/screens
- unrelated mock data
- backend/API/auth/database assumptions
- storage keys
- Intel Watch layout
- Cyber News layout
- Defense Industry layout
- Sources
- `SharedWorldMap2D`
- active MapLibre globe accepted camera/composition
- active MapLibre globe dark style
- active MapLibre globe label LOD
- active MapLibre globe auto-rotate behavior
- active MapLibre globe marker behavior
- SOCMINT behavior
- Global View marker data

---

## UI Guidance

Keep the UI:

- dark
- restrained
- premium
- modern
- readable
- operational
- analyst-oriented

Preferred direction:

- base near `#0B0F14`
- green is an accent, not the base color
- neon green `#00FF88` only sparingly
- red/yellow/orange/blue should be muted and meaningful

Suggested semantic color use:

- red = conflict / operation / high risk
- blue = diplomatic / cooperation / public statement
- yellow = uncertain / developing / monitoring
- orange = border tension / elevated concern

Avoid:

- excessive glow
- decorative borders
- busy effects
- gaming style
- military exaggeration
- marketing hero sections
- cyberpunk / hacker clichés
- non-functional UI that appears active

Side panels should support the main view, not overpower it.

Prefer clean, sharp icon styling.

Keep header, left rail, top nav, and module navigation visually consistent.

---

## Data Guidance

Events should follow the existing `OsintEvent` model.

Sources should follow the existing `OsintSource` model.

Important data/type areas may include:

- `types/event.ts`
- `data/mockEvents.ts`
- `types/socmint.ts`
- `data/socmintReports.ts`
- `types/source.ts`
- `data/mockSources.ts`
- `data/intel-watch/*`
- `data/cyberMockData.ts`

Rules:

- Source counts should be derived from `mockEvents.sourceId` where possible.
- New mock data should use existing categories, regions, source IDs, severity
  values, and verification values where possible.
- Do not invent live/current factual claims.
- Use generic OSINT-style mock placeholders.
- Use public-source wording.

---

## Active MapLibre Globe

The active Monitor / Global View / SOCMINT globe is **MapLibre-only**.

MapLibre owns:

- globe rendering
- basemap
- labels
- borders/coastlines
- zoom
- drag
- camera movement
- screen framing
- source/layer based marker rendering

Do not reintroduce or rebuild:

- Three.js globe renderer
- Three.js camera system
- Three.js marker sprites
- Three.js raycasting marker selection
- Three.js canvas texture country/capital label system
- Three.js surface/material/lighting system

Accepted visual direction:

- black / near-black background
- near-black water
- dark graphite land
- subtle borders/coastlines
- muted labels
- crisp professional label/border rendering
- no navy/lacivert look
- no bright consumer-map look

The globe panel must never become blank.

Preserve:

- visible loading state
- visible dark error fallback
- verified container sizing
- MapLibre CSS
- `map.remove()` cleanup
- no multiple map instances

---

## Globe Camera / Central View

Initial load / refresh and Central View must use the same accepted default
camera state.

Use one source of truth, such as:

```ts
DEFAULT_GLOBE_VIEW
```

Do not create separate hardcoded camera values for:

- initial load
- refresh
- Central View
- reset view
- Monitor
- Global View
- SOCMINT

Central View should smoothly return to the accepted default camera.

Do not alter the accepted center / zoom / composition unless explicitly
requested.

---

## Globe Auto-Rotate

Auto-rotate must be MapLibre-native and longitude / center based.

Do not use continuous bearing animation for globe auto-rotate.

Avoid this for auto-rotate:

```ts
map.rotateTo(...)
```

Preferred principle:

```ts
const center = map.getCenter()

map.jumpTo({
  center: [nextLng, center.lat],
  bearing: 0,
  pitch: map.getPitch(),
  zoom: map.getZoom(),
})
```

Expected behavior:

- natural horizontal globe movement
- no clock-like rotation
- no counter-clockwise disk spin
- no stutter
- no multiple RAF loops
- no camera jump after pause/resume

Implementation expectations:

- pause on real user interaction
- resume according to task-defined idle rules
- programmatic auto-rotate events must not be treated as user interaction
- reset `lastFrameTime` on resume
- cleanup RAF / timers / listeners on unmount

---

## Globe Label / LOD Rules

Default / Central View may use simplified label visibility to avoid clutter.

At distant/default zoom:

- show continent names
- show selected important country labels if configured

On zoom-in:

- normal detailed labels may return

Prefer:

- MapLibre style layer filters
- `minzoom`
- expression-based label logic

Do not build a heavy custom label system unless explicitly requested.

Label stability matters more than maximum label coverage.

---

## Globe Marker Layer Rules

When marker work is requested:

- use existing mock/static marker data
- keep Global View and SOCMINT markers logically separated
- prefer MapLibre source/layer structure where possible
- markers should be small, sharp, premium, and proportional
- avoid oversized sprites
- avoid cheap glowing dots
- avoid overcrowding
- avoid new live data

If far-side globe marker hiding is complex, implement a simple safe version or
leave a clear TODO.

Do not break the accepted globe foundation while adding markers.

---

## Screen Framing / View Transitions

Separate these two concepts:

```text
Geographic camera view = what part of the world the globe looks at
Screen framing = where the globe sits inside available UI space
```

Do not change the accepted geographic camera just to fix panel overlap.

For Monitor → Global View / SOCMINT transitions:

- preserve the accepted Central View / initial geographic view
- frame the globe into the available empty workspace
- prevent the globe from sitting behind left/right panels
- use padding / offset / available viewport logic where appropriate
- use smooth MapLibre camera transitions
- avoid jump/snap behavior
- pause auto-rotate during major transitions
- resume auto-rotate according to existing idle rules

---

## Shared 2D SVG Map

Intel Watch, Cyber News, and Defense Industry use the accepted shared 2D SVG
map foundation.

Do not touch unless explicitly requested:

- `SharedWorldMap2D`
- Intel Watch shared 2D map
- Cyber News shared 2D map
- Defense Industry shared 2D map

Accepted shared 2D map traits:

- direct black background
- Antarctica removed
- no duplicate world wrapping
- Russia continuity / wrap issue fixed
- smooth geometry
- thin subtle country borders
- accepted zoom / pan / hover / tooltip / modal behavior

---

## Intel Watch

Intel Watch is a general OSINT / geopolitical intelligence monitoring desk.

It should not look like a Cyber News / cybersecurity dashboard.

Focus areas:

- public information
- public news mentions
- regional signals
- geopolitical developments
- diplomatic activity
- policy signals
- security developments
- influence-operation mentions
- border tensions
- sanctions monitoring
- cooperation mentions
- analyst workflow

Do not include:

- secret data
- classified language
- covert operation language
- real operational claims
- real-time tracking claims
- unsupported intelligence assertions

Use OSINT-safe wording such as:

- public-source reporting indicates
- open-source mentions increased
- regional monitoring signal
- reported activity
- public statements
- media and institutional references
- public-source references
- news and official statements

Avoid language such as:

- classified
- secret source
- covert operation
- confirmed intelligence operation
- real-time surveillance
- intelligence agency claim

### Intel Watch 2D SVG Map

Accepted Intel Watch map state:

- 2D SVG world map works
- Antarctica removed
- Russia / duplicate wrapping fixed
- country hover highlight works
- country-name tooltip works
- mouse wheel zoom works
- zoom buttons work
- drag / pan works
- country click-to-zoom works
- red pulsing markers work
- marker click opens centered modal
- map clipping correct
- layout and right-side panels accepted

Do not change unless explicitly requested:

- projection
- projection type
- default fitExtent
- default scale/position
- country geometry/filtering
- Antarctica removal
- Russia continuity fix
- duplicate-wrap prevention
- base map colors
- country borders
- hover highlight
- tooltip
- wheel zoom
- zoom buttons
- drag/pan
- country click-to-zoom
- reset behavior
- marker positions/color/size/pulse
- layout
- right-side panels

Existing SVG transform principle:

```tsx
<g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
  countries
  borders
  markers
</g>
```

Reset:

```ts
zoom = 1
pan = { x: 0, y: 0 }
```

### Intel Watch Marker Modal

Marker click should open a centered HTML overlay modal.

Modal rules:

- centered in the map panel
- map behind blurred/dimmed
- not dependent on marker screen coordinates
- stable during zoom/pan
- implemented as HTML overlay, not SVG text
- map interactions blocked while modal is open

Close via:

- X / close button
- Escape
- backdrop click if implemented

Do not close on:

- modal inner click
- hover
- mouse move

Allowed modal sections only:

1. Header
   - Location
   - Signal Type
   - Severity badge
   - Close button

2. Metadata
   - Source
   - Updated
   - Region
   - Category

3. Event Brief

4. Source Context

Do not add:

- Confidence
- confidence percentage
- probability score
- Key Observations
- Monitoring Focus
- Tags / Related Tags
- analyst recommendation
- AI-generated assessment language
- secret/classified/covert language
- real-time surveillance
- agency tracking claims

---

## Cyber News

Cyber News is a cybersecurity news / cyber intelligence dashboard.

It is not a deep technical SOC engineering screen.

It should feel:

- modern
- premium
- dark
- restrained
- operational
- vivid but not flashy

Accepted layout:

- preserve top nav / left rail
- main area is 3 columns
- left/top: CYBER THREAT MAP
- under map: Session IP strip
- left/bottom: MOST MENTIONED REGIONS
- left/bottom second panel: AFFECTED SECTORS / EXPOSURE
- center: CYBER SECURITY NEWS
- right: THREAT CONTEXT

Interaction:

- Cyber Security News cards are clickable
- `selectedNewsId` updates on click
- Threat Context reflects selected item
- selected card has subtle active state only

Do not re-add:

- Time Filter
- View Full Report
- Threat Context footer CTA
- View All News footer/link/container
- map header severity legend
- VPN / Not Detected in Session IP
- thin left-side severity strips
- unnecessary new modules

Threat Context field order:

1. COUNTRY
2. AFFECTED ENTITY / ORGANIZATION
3. HACK INCIDENT
4. ATTACK TYPE / VECTOR
5. THREAT ACTOR / GROUP
6. TARGET / ASSET
7. TARGET SECTOR
8. SUMMARY
9. FIRST SEEN
10. LAST UPDATE
11. CONFIDENCE
12. IMPACT

Session IP strip:

- IP: `185.234.219.102`
- Location: `Istanbul, Türkiye`
- Badge: `ISP`
- Value: `Türk Telekom`

Do not add VPN detection claims.

Affected Sectors should use compact horizontal bars. Do not use donut charts.

---

## Defense Industry

Defense Industry uses the shared Intel-style 2D SVG base map unless explicitly
changed.

Accepted direction:

- `DefenseIndustryPanel.tsx` renders `DefenseIndustryMap`
- `DefenseIndustryMap` imports `SharedWorldMap2D`
- old Defense canvas/custom map is not rendered
- markers are bright, sharp orange point markers
- no country-fill highlight system
- layout unchanged
- scrollbar accent should match Defense / Key Segments accent, not Cyber green

---

## Sources

Sources refers to the Source Registry screen.

Sources should align with current naming:

- Policy
- Cyber News
- Defense Industry

Keep Sources frontend mock/static only.

Do not add real scraping, API, database, or live source ingestion unless
requested.

---

## Bookmarks

Bookmarks may use the legacy localStorage key:

```text
borueyes.bookmarks
```

Do not rename storage keys unless explicitly requested.

Bookmarks can include both OSINT events and SOCMINT reports if already
implemented.

---

## Reserved Areas

Do not build unless explicitly requested:

- Air Track
- Ship Track
- Analytics / AI Analysis
- real backend
- live intelligence ingestion
- real scraping/data pipelines

---

## Validation

Run after changes:

```bash
npm run lint
```

On Windows PowerShell, if execution policy blocks scripts:

```bash
npm.cmd run lint
```

Run build when TypeScript, imports, data models, component structure,
MapLibre lifecycle, camera logic, or shared code changes:

```bash
npm run build
```

For tiny CSS/text-only changes, lint is usually enough.

Manual browser validation is expected for UI behavior changes.

Common checks:

- no console errors
- no blank screen
- unrelated screens unaffected
- layout unchanged unless requested
- hover/tooltip/zoom/drag/reset behavior preserved unless requested
- marker/modal interaction correct when relevant
- map interactions return after modal close when relevant

Fix only scoped errors caused by the current change.

Report unrelated/pre-existing errors separately.

---

## Final Response Format

Keep summaries short.

Include only:

- Files changed
- What changed, max 3 bullets
- Validation result
- Risks or follow-up, only if relevant

Do not include:

- internal reasoning
- chain-of-thought
- long implementation commentary
- progress narration
- obvious repo inspection steps
- repeated project description

---

## Communication Rules / Silent Mode

Do not print progress updates such as:

- “I’m reading…”
- “I’ve located…”
- “I’m now checking…”
- “Next I will…”
- “I’m going to…”

Do not summarize tool usage while working.

Work silently until either:

- the task is completed, or
- a blocker requires user input

Final response only:

- Files changed
- What changed, max 3 bullets
- Validation result
- Risks/follow-up only if relevant
