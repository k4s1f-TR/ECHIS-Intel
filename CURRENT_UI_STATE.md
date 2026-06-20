# ECHIS - Current UI State Handoff

## Goal
Dark-themed, map-first OSINT situation dashboard. Full-screen desktop layout, no backend, mock data only.

---

## Layout

```text
[ HeaderNav spans full width ]
[ LeftRail 68px ] [ Main content / globe / active module ]
```

- **`app/page.tsx`** - root entry, renders `AppShell`
- **`components/layout/AppShell.tsx`** - owns top-level UI state and wires all modules together
- **`components/layout/HeaderNav.tsx`** - top navigation with Monitor, Policy, Intel Watch, Cyber News, Defense Industry, Sources
- **`components/layout/LeftRail.tsx`** - icon-only rail for Global View, SOCMINT Watch, Bookmarks, and reserved modules
- **`components/maplibre/MapLibreGlobe.tsx`** - MapLibre-only active globe
- **`components/map/FloatingMonitoringCard.tsx`** - Global View overlay controls
- **`components/map/MapControls.tsx`** - center and zoom controls wired to `MapLibreGlobe` via ref
- **`components/map/LiveStatusPill.tsx`** - live indicator badge on map modes
- **`components/events/RightEventsPanel.tsx`** - scrollable event panel for Global View
- **`components/events/EventCard.tsx`** - individual event card with selection and bookmark state
- **`components/ui/StatusBadge.tsx`** - category/severity/source/verification badges

---

## Globe Map (`MapLibreGlobe.tsx`)

- The active map is a **MapLibre-only globe**.
- Rendering uses `maplibre-gl` with globe projection and the CARTO dark-matter style.
- `DEFAULT_GLOBE_VIEW` in **`components/maplibre/MapLibreGlobe.tsx`** is the canonical camera source.
- Supported view modes are `situation`, `global`, and `signals`.
- The globe supports drag rotation, wheel zoom, auto-rotation, center view, zoom in, and zoom out.
- Country labels are handled through MapLibre style layers and default-view label filtering.
- Event and SOCMINT markers are rendered through separate MapLibre GeoJSON sources and circle layers.
- Marker palettes are severity/confidence-aware and are defined inside `MapLibreGlobe.tsx`.
- `MapControls.tsx` is already wired to `MapLibreGlobeHandle` through `AppShell`.

---

## Main Screens

- **Monitor home** - MapLibre globe without side panels until a rail mode is selected
- **Global View** - globe markers, `FloatingMonitoringCard`, `RightEventsPanel`, and live pill
- **SOCMINT Watch** - signal markers, `SignalsFloatingCard`, `SignalsPanel`, and live pill
- **Policy** - panel/feed-first political monitoring screen with filters and market side panels
- **Intel Watch** - mock intelligence watch dashboard with map, feed, watchlist, agency activity, and drawers
- **Cyber News** - mock cyber dashboard with threat map, news feed, context, regions, and sectors
- **Sources** - Source Registry screen with counts derived from `mockEvents.sourceId`
- **Bookmarks** - localStorage-backed bookmarked events and SOCMINT reports
- **Defense Industry** - placeholder module

---

## Data Model

- **`types/event.ts`** - `OsintEvent`, `EventCategory`, `EventSeverity`, `SourceType`, `VerificationStatus`, `RegionKey`
- **`data/mockEvents.ts`** - mock OSINT events across Middle East and global regions
- **`types/socmint.ts`** - `SocmintReport` model and confidence filter helpers
- **`data/socmintReports.ts`** - mock SOCMINT reports
- **`types/source.ts`** and **`data/mockSources.ts`** - Source Registry model and mock source list
- **`data/intel-watch/*`** - Intel Watch mock data
- **`data/cyberMockData.ts`** - Cyber module mock data

---

## Design Rules To Preserve

- Keep the UI dark, restrained, premium, and analyst-oriented.
- Use existing mock/static data patterns.
- Do not add backend, auth, database, scraping, live tracking, or real APIs unless explicitly requested.
- Do not invent live/current factual claims.
- Preserve existing schemas unless the task requires a schema change.
- Avoid unrelated refactors.
- Avoid excessive glow, decorative borders, and busy effects.
- Use low-opacity `rgba()` backgrounds, borders, and text treatments.
- Keep `html` and `body` overflow hidden so the app owns the full viewport.
- Keep the global scrollbar styling in `globals.css`.

---

## Protected Areas

Do not change these unless the task explicitly targets them:

- app shell structure
- top navigation
- left rail
- MapLibre globe engine
- camera presets
- marker behavior
- MapLibre label LOD strategy
- map tone, center, zoom, and interaction model
- SOCMINT behavior
- Global View marker data
- backend/API/auth/database assumptions

---

## Reserved / Future Areas

- Air Track and Ship Track are reserved for future modules.
- Defense Industry is currently a placeholder module.
- Analytics is currently reserved.

---

## Validation

- Run `npm run lint` after changes.
- On Windows PowerShell, use `npm.cmd run lint` if execution policy blocks npm scripts.
- Run `npm run build` when TypeScript, imports, data models, or component structure change.
- For tiny CSS/text-only changes, lint is usually enough.
