# AGENTS.md — ECHIS

Standing instructions for coding agents. Keep this file short.
Per-task prompts use the template at the bottom; do not re-state the
project on every prompt.

---

## 1. What this project is

ECHIS — Next.js dark OSINT / situational-awareness dashboard.
Single Next.js app, no separate backend service.

Stack (see `package.json` for exact versions):
Next.js 16 · React 19 · TypeScript · Tailwind 4 · MapLibre GL ·
react-simple-maps ·
topojson-client / world-atlas · lucide-react.

The app is **not** purely static. `app/api/sources/*` proxies real
news APIs server-side using keys in `.env.local`. Most UI screens
still render mock data from `data/**` — both paths are valid.

---

## 2. Source-of-truth files (read these, do not duplicate them here)

| Concern                        | File                                            |
|--------------------------------|-------------------------------------------------|
| Top-level UI state + wiring    | `components/layout/AppShell.tsx`                |
| Nav labels + order             | `components/layout/HeaderNav.tsx` (`NAV_TABS`)  |
| Left rail items                | `components/layout/LeftRail.tsx` (`topIcons`)   |
| Global design tokens           | `app/globals.css` (`:root`, `.cyber-premium`)   |
| Severity colors → tokens       | `lib/theme.ts`                                  |
| Three.js globe + camera        | `components/map/EchisGlobe.tsx` (`SIZE_CONFIG`) |
| MapLibre / Air Track camera    | `components/maplibre/MapLibreGlobe.tsx` → `DEFAULT_GLOBE_VIEW` |
| Source pipeline                | `data/source-intelligence/sourceIntelligencePipeline.ts` |
| Source adapters (server)       | `lib/sources/*Adapter.ts`                       |
| Source API routes              | `app/api/sources/*/route.ts`                    |
| Event / source / socmint types | `types/event.ts`, `types/source.ts`, `types/socmint.ts` |

When a fact in AGENTS.md disagrees with code, **code wins**. Edit
this file or ask before assuming.

---

## 3. Core rules

1. **Small, scoped changes.** Touch only what the task names.
   No drive-by refactors, no renames, no "while I'm here" cleanup.
2. **Preserve working behavior.** If you don't understand why
   something is the way it is, read the surrounding code before
   changing it; if still unclear, ask.
3. **No new abstractions** unless they remove more complexity than
   they add. Reuse existing patterns in the same folder.
4. **No new dependencies, no new env vars, no schema changes** unless
   the task asks for it.
5. **Mock vs. live data:** keep them on their existing paths.
   `data/**` is mock; `app/api/sources/**` + `lib/sources/**` is live.
   Don't move data between them without an explicit ask.
6. **OSINT-safe wording.** No classified / covert / real-time
   surveillance / agency-tracking language. Use public-source phrasing.
7. **Storage keys are legacy and stable.** `borueyes.bookmarks` and
   any other persisted key stays as-is unless renaming is the task.

---

## 4. Security (non-negotiable)

- `.env.local` holds **real third-party API keys**. Never paste its
  contents, never echo a key in logs, summaries, error messages, code
  comments, or commit messages. Never add a new key without asking.
- `.env*` is gitignored (`.gitignore`); keep it that way. Do not
  create `.env.example` entries that include real values.
- Server routes in `app/api/**` run with `runtime = "nodejs"` and read
  `process.env.*` — keys must stay server-side. Never expose a key to
  the client via `NEXT_PUBLIC_*` or by embedding it in a component.
- Treat any user-pasted PII / IPs / coordinates in tasks as sensitive:
  do not commit them, do not invent live factual claims around them.

---

## 5. Visual system (one paragraph; the rest is in CSS)

Theme: deep black base (`--bg-base #060305`) + crimson gradient
(`--accent-grad: #b3121f → #ff2b3d`) + cool silver text ladder
(`--text-heading` → `--text-dim`, also aliased as `--c-t1..t6`).
The whole app is wrapped in `.cyber-premium` in `AppShell.tsx`, so the
`--c-*` tokens are available everywhere. Severity tokens live as
`--sev-{critical|high|medium|low}-{text|bg|border}`. Note: tokens
named `--accent-blue-*` are historical — their **values are crimson**.
Don't rename them, just use them.

Fonts: Space Grotesk (`--font-display`), Hanken Grotesk (`--font-ui`),
JetBrains Mono (`--font-mono`), Newsreader (`--font-serif`, Policy
only). Loaded once in `app/layout.tsx`.

For Cyber News visual spec details (gradients, panel surface, badge
rules), see `CYBER_NEWS_TEKNIK_TASARIM_RAPORU.md`. **Do not inline that
document into AGENTS.md or into per-task prompts.**

---

## 6. Globe / map (the only place where wrong moves cost hours)

The opening screen, Global View, and SOCMINT use the shared Three.js
`EchisGlobe` renderer. `MonitorLanding` mounts it directly; Global View and
SOCMINT mount it through the screen-scoped `ScreenGlobe` wrapper. Air Track
uses its MapLibre-based `AirTrackGlobe`; `MapLibreGlobe.tsx` also remains the
source of shared region presets. Only the active screen's WebGL globe may be
mounted. The Three.js globe's country asset is
`public/data/home-globe.geojson`; regenerate it with
`npm run generate:home-globe`, never hand-edit it.

Hard rules:

- `SIZE_CONFIG.hero` is the Three.js globe's camera/zoom source of truth.
  `DEFAULT_GLOBE_VIEW` remains the source of truth for MapLibre/Air Track.
- Three.js auto-rotate advances the longitude state and rebuilds the globe
  orientation; preserve that turntable model and its pause/resume contract.
- One WebGL globe instance at a time. On unmount, clear every RAF, timeout,
  and listener; dispose the renderer/context or call `map.remove()` as
  appropriate for the renderer.
- Globe panel must never be blank — keep the loading state and the
  dark error fallback.
- Geographic camera (where we look on Earth) and screen framing (where
  the globe sits in the layout) are separate problems. Solve panel
  overlap with padding/offset, not by moving the camera.

Shared 2D SVG map (`SharedWorldMap2D`) is used by Intel Watch,
Cyber News, and Defense Industry. Treat it as frozen: Antarctica
removed, Russia wrap fixed, accepted projection. Don't re-touch
unless the task targets it explicitly.

### Karşılama küresi canlı veri notu

Karşılama küresi yalnızca ortak `GlobeActivitySnapshot` sözleşmesini
kullanmalı ve canlı olay izlenimi veren sahte marker üretmemelidir. Mevcut
toplama ziyaretçi tarafından tetiklenir; canlıya geçmeden önce zamanlanmış
toplayıcı ve kalıcı snapshot deposu zorunludur. Ayrıntılar için
`docs/CANLI_KURE_VERI_YOL_HARITASI.md` belgesine bakın.

---

## 7. Don't-touch list (unless the task says so)

App shell · HeaderNav · LeftRail · storage keys · `DEFAULT_GLOBE_VIEW`
· `SharedWorldMap2D` · accepted globe camera / labels / markers ·
source pipeline (`data/source-intelligence/**`) · unrelated screens ·
unrelated mock data.

Reserved (don't build unless asked): Air Track, Ship Track, Analytics,
auth, real database, websocket / streaming, scraping.

---

## 8. Validation

Run **after every change**:

```
npm run lint
```

(Windows PowerShell, if script policy blocks: `npm.cmd run lint`.)

Run **build** when any of these changed: TypeScript types, imports,
data models, component structure, MapLibre lifecycle / camera code,
API route, or shared util:

```
npm run build
```

Manual browser check for any UI behavior change: no console errors,
no blank screen, unrelated screens unaffected, hover / tooltip / zoom
/ drag / reset still work, modal close returns map interactions.

Report unrelated pre-existing errors separately — do not fix them in
the same change.

---

## 9. Communication

Work silently. No "I'm now reading…", "Next I'll…", no narration of
tool calls.

Final report — keep it to this shape:

```
Files changed:
  - path/one.tsx
  - path/two.ts

What changed (≤3 bullets):
  - …

Validation:
  - npm run lint: pass
  - npm run build: pass | not run (reason)
  - manual: …

Risks / follow-up (only if real):
  - …
```

No chain-of-thought, no project re-introduction, no unrelated
suggestions.

---

## 10. Task prompt template

Future task prompts should be this short:

```
Use AGENTS.md.

Task:
  …

Scope:
  …

Do not touch:
  …

Acceptance:
  …

Validation:
  npm run lint  (+ npm run build if listed in §8)
```

---

## 11. Legacy docs in this repo

These files exist for history. Read them only if the current task
points you to them; do **not** treat them as standing rules:

- `CURRENT_UI_STATE.md` — older UI snapshot.
- `CYBER_NEWS_TEKNIK_TASARIM_RAPORU.md` — Cyber News visual spec.
- `echis-common-agent-context.md` — Turkish duplicate of an earlier
  AGENTS.md.
- `PROMPT-globe-restyle.md` — one-shot prompt, already applied.
- `design_handoff_cybernews_premium/` — design reference assets.

If any of them contradicts §1–§9 of this file, **this file wins**.
