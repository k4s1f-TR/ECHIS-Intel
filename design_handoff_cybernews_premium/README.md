# Handoff: Cyber News — Premium Redesign (ECHIS)

## Overview
A full visual + interaction redesign of the **Cyber News** screen of ECHIS:
a dark, luxe OSINT command-center built around **deep black + vivid crimson + sharp
silver**. It covers the Global Threat Map (flat world map with live attack comets and
severity-tiered markers), the Cyber Security News feed, the Threat Context panel, the
Most Mentioned Regions and Affected Sectors panels, plus a top ticker and a header
threat-level meter.

## ⚠️ Reconciling with AGENTS.md (read this first)
This redesign **intentionally diverges** from a few standing defaults in `AGENTS.md`.
A prior agent run followed those defaults and reverted the look. For **this task**, the
overrides below apply **to the Cyber News screen only** — everything else in AGENTS.md
still holds:

- **Accent color:** Cyber News moves from the green house-accent to **crimson**
  (`--accent #ff2b3d`) on deep black, with a sharp silver text ladder. Deliberate, approved
  direction for Cyber News — do **not** substitute green.
- **Glow / motion:** tasteful, restrained glow + motion are **intended** here (gem markers,
  comet attack arcs, radar ping on crit/high only, ticker). Keep it **premium & operational,
  NOT gaming/cyberpunk**. "Restrained" still applies: small markers, calm lower tiers, no
  marketing sections.
- **"Cyber News layout" is the explicit target** of this task, so the protected-area rule
  does not block restyling these panels. Layout structure, Threat-Context field order,
  Session-IP values, clickable cards / `selectedNewsId`, bars-not-donuts, and the AGENTS.md
  "do not re-add" list are all **preserved** — this design already complies with them.
- **`SharedWorldMap2D` stays untouched.** It already gives us the flat, Antarctica-removed
  base map. ONLY edit the `markerLayer` render-prop **inside `CyberMap.tsx`** (marker +
  attack-arc visuals/colors). Do not change the shared map's projection, geometry, Antarctica
  removal, zoom/pan/hover/tooltip, or base colors. (So: ignore the README's earlier "canvas
  overlay" option — stay in the existing SVG `SharedWorldMap2D`.)
- Map severity colors change from green to the **red→orange→gold→silver heat ramp** (below).

**Visual reference:** `reference/01-cyber-news.png` (overview) and `reference/02-cyber-news.png`
(a news item selected → Threat Context swaps + map focus crosshair). Match these.

## About the Design Files
The files in this bundle are **design references created in HTML/Canvas/JS** — a working
prototype showing the intended look and behavior. They are **not production code to copy
verbatim**. The task is to **recreate this design inside the existing Next.js + React +
TypeScript codebase**, using its established component structure, data layer, and the
shared map component. Treat the HTML/CSS as the source of truth for *visuals and
behavior*, and re-express it in the project's idioms (Tailwind/CSS modules, the existing
`SharedWorldMap2D`, `cyberMockData.ts`, etc.).

Design files (in `design/`):
- `Cyber News Premium.html` — markup + the full CSS design system (tokens, panels, feed, context, ticker)
- `cyber-app.js` — all logic: flat-map renderer (d3 + canvas), comet attack arcs, premium markers, live clock, ticker, news→context interaction, count-ups
- `tweaks-app.jsx` + `tweaks-panel.jsx` — the in-prototype "Tweaks" panel (accent / surface / density / glow). This is a **prototype affordance only** — do not port it; it just demonstrates the theme variants.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion, and interactions.
Recreate pixel-faithfully using the codebase's existing libraries and patterns.

---

## Screen → Component Map
The HTML mirrors your existing module almost 1:1. Recreate each panel in its current file:

| Design panel (HTML)            | Your component                                  |
|--------------------------------|-------------------------------------------------|
| Global Threat Map              | `components/cyber/CyberMap.tsx` (via `SharedWorldMap2D`) |
| Cyber Security News (feed)     | `components/cyber/CyberNewsPanel.tsx`           |
| Threat Context                 | `components/cyber/ThreatContextPanel.tsx`       |
| Most Mentioned Regions         | `components/cyber/MostMentionedRegionsPanel.tsx`|
| Affected Sectors               | `components/cyber/AffectedSectorsPanel.tsx`     |
| Page shell / 3-col grid + ticker + header meter | `components/cyber/CyberSecPanel.tsx` |
| Top nav / left rail            | existing `HeaderNav.tsx` / `LeftRail.tsx` (restyle to tokens below only if in scope) |

Data already exists in `data/cyberMockData.ts` (`cyberNewsItems`, `cyberHotspots`,
`cyberAttackIndicators`, `cyberRegionMentions`). The design uses exactly this data —
no schema change required. **Only the severity → color mapping changes** (see Markers).

---

## Design Tokens

### Surfaces
- `--bg-base: #060305` · `--bg-deep: #030203` · `--bg-rail: #080507`
- Panel bg `#0a070a`; panel gradient (carbon): `linear-gradient(180deg, rgba(36,26,29,.42), rgba(12,9,11,.5) 46%)` plus a 1px/7px 135° hairline stripe at `rgba(255,255,255,.012)`
- Panel border `rgba(255,255,255,.07)`; inner hairline `0 1px 0 rgba(255,255,255,.04) inset`; drop shadow `0 14px 40px rgba(0,0,0,.4)`
- Card bg `rgba(255,255,255,.016)`, hover `rgba(255,255,255,.034)`
- Borders ladder: 1 `rgba(255,255,255,.07)` · 2 `rgba(255,255,255,.045)` · 3 `rgba(255,255,255,.028)`

### Text ladder (cool silver)
- `--t-1 rgba(238,240,244,.98)` heading · `--t-2 rgba(214,219,226,.92)` primary · `--t-3 rgba(176,184,196,.82)` body · `--t-4 rgba(132,142,156,.72)` secondary · `--t-5 rgba(96,105,119,.64)` tertiary · `--t-6 rgba(70,78,90,.6)` muted
- Silver metal: `rgba(196,202,212,.94)` / dim `rgba(150,158,170,.74)`

### Accent (crimson — default of three variants)
- `--accent #ff2b3d` · `--accent-2 #b3121f` · `--accent-text rgba(255,86,96,1)`
- `--accent-bg rgba(255,43,61,.13)` · `--accent-border rgba(255,72,84,.42)` · `--accent-glow rgba(255,43,61,.42)`
- (Optional variants demonstrated in prototype — Blood `#d10f1c`, Signal `#ff3a2e`. Ship crimson unless told otherwise.)

### Severity — UI badges/tags (red family)
- Critical `rgba(255,72,82,.98)` on `rgba(255,56,68,.13)`, border `rgba(255,72,84,.40)`
- High `rgba(226,42,54,.95)` · Medium `rgba(168,38,46,.95)` · Elevated/Low silver `rgba(176,184,196,.82)`

### Severity — MAP heat ramp (markers + attack comets)  ← key change from current green
| Tier | core/stroke `col` | bright `core` | `glow` |
|------|-------------------|---------------|--------|
| Critical | `#ff3b42` | `#ffd2d4` | `rgba(255,59,66,.9)` |
| High | `#ff7a2f` | `#ffd9b8` | `rgba(255,122,47,.8)` |
| Medium | `#f1c24f` | `#fff0c2` | `rgba(241,194,79,.7)` |
| Low | `#9aa3b2` | `#e6e9ee` | `rgba(154,163,178,.5)` |

A clearly-stepped red→orange→gold→silver ramp so severity is unmistakable. Map
`cyberMockData` severity (`critical/high/medium/low`) to these instead of the current
green `rgba(24,255,138,…)`.

### Radius / Type scale
- Radius: `12px` / `8px` / `5px`
- Fonts (Google): **Space Grotesk** (headings, brand, badges, titles), **Hanken Grotesk** (UI/body), **JetBrains Mono** (all numbers, clock, IP, timestamps)
- Size scale: 2xs 8.5 · xs 9.5 · sm 10.5 · base 11.5 · md 12.5 · lg 14 · xl 17 (px). UPPERCASE panel titles use `letter-spacing:.14em`.

### Layout
- Header 56px · Ticker 30px · Left rail 62px · main padding/gap 10px
- 3 columns flex ratio **2 : 1.15 : 1** (left / center / right), all `min-height:0`
- Left column = Threat Map (grows) over a fixed **264px** row split into Regions (304px) + Sectors (flex)

---

## The Map (most important — read carefully)

**Target visual**
- **Flat world map, d3 `geoNaturalEarth1`**, centered & proportional, **Antarctica trimmed** (visible latitude band ≈ **−56°…+83°**), no rectangular frame/plate.
- Land fill `#221a1e`; coastlines/borders `rgba(255,72,84,.40)` @ 0.55px; graticule `rgba(255,72,84,.04)` @ 0.5px.
- **Markers** (`cyberHotspots`): layered, gem-like — soft radial **glow halo** (≈ r×3.4), a **gem core** lit from top-left (radial `core`→`col`), a crisp **bezel ring** `rgba(255,255,255,.22)`, and a tiny **specular highlight** (white .55) on crit/high/med. Radii (in fitted-projection units): **crit 3.0 / high 2.5 / med 2.1 / low 1.8**. Only **critical & high** emit a **radar ping** (two expanding rings, 2800ms, staggered by location) — lower tiers stay calm for hierarchy/restraint.
- **Attack arcs** (`cyberAttackIndicators`): drawn as **screen-space quadratic béziers** with an overhead lift (perpendicular, biased up, up to 130px). Animated as a **self-drawing comet**: a head travels `t:0→1`, trailing a ~0.24-long tail of ~20 segments whose alpha fades `pow(f,1.7)*0.92` and width tapers `0.5+f*1.7`; a glowing head dot (r≈1.7, `core` fill + `glow` shadow). **No pre-drawn full track.** When `t>1` the comet disappears and respawns from `t≈−0.14` (staggered, so the map is never overcrowded).
- Header stats live in the **bottom info strip**, not over the map: `Active Arcs` (accent) · `Hotspots`, alongside the Session-IP line.

**Your current implementation & how to port**
Your `CyberMap.tsx` renders into the shared **`SharedWorldMap2D`** via a `markerLayer={(project) => …}` render-prop, using **SVG** `<circle>` markers and straight `<line>` attack routes with green colors and dash animation. Two viable paths:

1. **Stay in SVG (smallest change, recommended first):** inside `markerLayer`, recreate the look in SVG —
   - Markers: swap green for the heat-ramp above; build the gem look with an SVG `radialGradient` per tier, a faint halo circle, a thin white bezel `<circle>`, and a small highlight. Keep the existing pulse keyframe but limit it to crit/high.
   - Arcs: replace straight `<line>` routes with curved `<path d="M x1 y1 Q cx cy x2 y2">` (compute `cx,cy` from the perpendicular-lift formula in `cyber-app.js → drawArc`). Animate a comet using `stroke-dasharray`/`stroke-dashoffset` (a short bright dash chasing along `pathLength=100`), and drop the always-visible base track. This reuses your existing `project(lng,lat)` and animation approach.
2. **Canvas overlay (closest to prototype):** mount a `<canvas>` absolutely over `SharedWorldMap2D` and port `cyber-app.js`'s renderer directly (d3-geo + topojson). Higher fidelity for the comet tails, but adds d3/topojson deps and a second renderer. Choose only if the SVG route can't match the comet quality.

> ⚠️ **Shared-component caution:** the **Natural-Earth projection** and **Antarctica trim** belong to `SharedWorldMap2D`, which other modules also use. If that shared map isn't already Natural-Earth/Antarctica-trimmed, changing it affects every consumer — **confirm scope before editing the shared map's projection/clip.** The marker + arc visuals are local to `CyberMap.tsx` and safe to change there.

Exact numeric constants for projection fit, clip band, bézier lift, comet segment count, alpha/width tapers, ping timing, and marker radii are all in `design/cyber-app.js` (`MAP_CLIP`, `resize`, `drawArc`, `drawHotspot`, `MK`, `SEV`).

---

## Other panels

**Cyber Security News** (`CyberNewsPanel`): vertical list of cards (`cyberNewsItems`). Card =
title (Space Grotesk 12.5, `--t-1`), meta row (source in silver + dot + JetBrains-Mono time),
summary (`--t-4`), then two badges (category + severity). Hover lifts `translateX(2px)` and
brightens bg/border. **Selected** card: accent-tinted bg, `--accent-border`, a 2.5px accent
left bar with glow. Selecting a card drives the Context panel + map focus.

**Threat Context** (`ThreatContextPanel`): labeled rows (Country, Affected Entity, Hack
Incident, Attack Vector, Threat Actor, Target/Asset, Target Sector, Summary) each with a tiny
11px line-icon + uppercase label (`--t-5`, `.1em`) over a value (`--t-2`). Footer: First Seen /
Last Update (mono) and Confidence/Impact shown as **5-pip meters** (filled pips = silver for
confidence, crimson for impact). Content swaps with the selected news item (subtle 380ms fade).
Header shows the active source.

**Most Mentioned Regions** (`MostMentionedRegionsPanel`): ranked rows (`cyberRegionMentions`):
`rank · label + thin accent progress bar · value (mono) + delta`. Positive delta = accent text,
negative = silver. Values count-up on load (≈1s, ease-out cubic) — but render final values as
base state so they're correct without JS.

**Affected Sectors** (`AffectedSectorsPanel`): label · severity tag · % (mono), over a 5px
track with a gradient fill (`accent-2→crit` for Critical/High, silver for Elevated). Render at
final width.

**Ticker** (in shell): 30px bar under the header; an "● Live Feed" tag then an infinite
horizontal marquee (`translateX(-50%)`, ~60s linear, **pause on hover**) of source + summary +
mono timestamp, each prefixed by a severity dot.

**Header threat meter** (in shell): small `THREAT LVL` pill with 5 mini equalizer bars in accent.

---

## Interactions & Behavior
- **News select → Context + Map:** clicking a card sets it selected, replaces Threat Context
  content (380ms fade), and triggers a **map focus** at that item's location — an expanding
  accent ring + crosshair that eases out over ~1700ms (see `focusGlobe`/focus marker in
  `cyber-app.js`). Each news item carries a focus `[lng,lat]`.
- **Live clock:** `HH:MM:SS`, tabular mono, updates every second.
- **Map loop:** continuous `requestAnimationFrame`; comets advance, pings expand, markers
  breathe. **Robustness rule:** every panel's base/end state must be visible *without*
  animation (don't gate visibility on a keyframe), and the map must draw at least one static
  frame on load + on data-ready + on resize, so a backgrounded/paused tab never shows blank.
- **Motion:** honor `prefers-reduced-motion` — your current map already does for routes; keep
  comets/pings calm or static under reduced motion.

## State
- `selectedNewsId` (drives Context + map focus) — lift to `CyberSecPanel` if panels are siblings.
- Clock tick (interval). Map render state (rAF) stays inside the map component.
- No data fetching — all from `cyberMockData.ts`.

## Assets
- No raster assets. All icons are inline 24×24 stroke SVGs (1.6–1.8 stroke). World geometry
  in the prototype uses `world-atlas@2 countries-110m`; if you go canvas, fetch/bundle that —
  if you stay in your SVG `SharedWorldMap2D`, you already have geometry.
- Fonts: Google Fonts **Space Grotesk**, **Hanken Grotesk**, **JetBrains Mono** (swap to the
  app's font setup if it self-hosts).

## Files
- `design/Cyber News Premium.html`
- `design/cyber-app.js`
- `design/tweaks-app.jsx`, `design/tweaks-panel.jsx` (prototype-only; do not port)
