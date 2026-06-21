"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createEchisOsmGlobeStyle,
  OSM_VECTOR_SOURCE_ID,
  USE_ECHIS_OSM_BASEMAP,
} from "@/components/map/styles/echisOsmGlobeStyle";
import type { RegionKey } from "@/types/event";

// ---------------------------------------------------------------------------
// Public handle — imperative API consumed by MapControls.
// ---------------------------------------------------------------------------
export interface MapLibreGlobeHandle {
  centerView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  projectMarker: (lng: number, lat: number) => { x: number; y: number } | null;
  setAutoRotatePaused: (paused: boolean) => void;
  /** Smoothly pan the globe to the given coordinate so the selected marker
   *  becomes visible.  Keeps the current zoom and framing padding so the
   *  marker appears in the open viewport area between panels.  Also pauses
   *  auto-rotate for the standard interaction idle delay. */
  focusMarker: (lng: number, lat: number) => void;
}

// ---------------------------------------------------------------------------
// View modes the globe component can frame for.  Mirrors AppShell's ViewMode
// so the value can be passed through as a prop without conversion.
// ---------------------------------------------------------------------------
export type GlobeViewMode = "situation" | "global" | "signals";

// ---------------------------------------------------------------------------
// Marker foundation — Global View and SOCMINT use separate GeoJSON sources
// + circle layers so visibility, styling, and lifecycle stay independent.
//
// Far-side clipping note: MapLibre v5's globe projection automatically hides
// symbol/circle features that fall on the back of the sphere, so no manual
// horizon visibility check is needed for this foundation.  TODO revisit if
// we ever ship a per-marker label / sprite that doesn't respect occlusion.
// ---------------------------------------------------------------------------
export type MarkerKind = "global" | "signals";

export type MarkerFeature = {
  id: string;
  lng: number;
  lat: number;
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: "low" | "medium" | "high";
  itemCount?: number;
};

interface MapLibreGlobeProps {
  activeView?: GlobeViewMode;
  activeRegion?: RegionKey;
  activeSignalsRegion?: RegionKey;
  globalMarkers?: MarkerFeature[];
  signalsMarkers?: MarkerFeature[];
  /** Called when the user clicks a marker.  `kind` identifies which layer
   *  fired so the parent can route to the correct panel. */
  onMarkerClick?: (
    id: string,
    kind: MarkerKind,
    point?: { x: number; y: number },
  ) => void;
  autoRotatePaused?: boolean;
  onGlobalMarkerRevealStart?: () => void;
  /** ID of the currently selected Global View event — drives the selected
   *  marker highlight (larger pin + neon red glow). */
  selectedGlobalId?: string | null;
  /** ID of the currently selected SOCMINT report — same visual treatment. */
  selectedSignalsId?: string | null;
}

// MapLibre adds `.features` to layer-specific mouse events; this local alias
// avoids repeating the intersection type throughout the file.
type LayerClickEvent = maplibregl.MapMouseEvent & {
  features?: maplibregl.MapGeoJSONFeature[];
};

const MARKER_SOURCE_GLOBAL  = "echis-markers-global";
const MARKER_SOURCE_SIGNALS = "echis-markers-signals";

// Layer IDs — ordered bottom → top per kind:
//   BLOOM   outer soft spread (large blurred circle)
//   GLOW    inner crisp ring (small circle + bright stroke)
//   LAYER   normal pins      (all features minus the selected one)
//   SEL     selected pin     (the one selected feature, larger)
const MARKER_BLOOM_GLOBAL   = "echis-markers-global-bloom";
const MARKER_BLOOM_SIGNALS  = "echis-markers-signals-bloom";
const MARKER_GLOW_GLOBAL    = "echis-markers-global-glow";
const MARKER_GLOW_SIGNALS   = "echis-markers-signals-glow";
const MARKER_LAYER_GLOBAL   = "echis-markers-global-layer";
const MARKER_LAYER_SIGNALS  = "echis-markers-signals-layer";
const MARKER_HOVER_GLOW_GLOBAL   = "echis-markers-global-hover-glow";
const MARKER_HOVER_GLOW_SIGNALS  = "echis-markers-signals-hover-glow";
const MARKER_HOVER_LAYER_GLOBAL  = "echis-markers-global-hover-layer";
const MARKER_HOVER_LAYER_SIGNALS = "echis-markers-signals-hover-layer";
const MARKER_SEL_GLOBAL     = "echis-markers-global-selected";
const MARKER_SEL_SIGNALS    = "echis-markers-signals-selected";
const MARKER_BADGE_GLOBAL   = "echis-markers-global-count-badge";
const MARKER_BADGE_TEXT_GLOBAL = "echis-markers-global-count-badge-text";

// Filter value used to make the selected-pin layer show nothing when there
// is no active selection — matches a feature id that can never exist.
const FILTER_MATCH_NONE: maplibregl.ExpressionSpecification =
  ["==", ["get", "id"], "__echis_none__"];
const MARKER_ITEM_COUNT_PROP = "itemCount";
const MARKER_COUNT_BADGE_FILTER: maplibregl.FilterSpecification = [
  ">",
  ["to-number", ["get", MARKER_ITEM_COUNT_PROP], 1],
  1,
] as unknown as maplibregl.FilterSpecification;

const ECHIS_GRAD_DARK = "#3b0509";
const ECHIS_GRAD_BRIGHT = "#a80d18";
const ECHIS_GRAD_MID = "#6f0710";
const ECHIS_GRAD_GLOW = "rgba(168,13,24,0.34)";

const selectedMarkerOpacityExpression = (
  selectedId: string,
  baseOpacity: number,
): maplibregl.ExpressionSpecification =>
  ["match", ["get", "id"], selectedId, baseOpacity, 0] as maplibregl.ExpressionSpecification;

// ---------------------------------------------------------------------------
// Premium red location-pin icon — single shared SVG image used by both the
// Global View and SOCMINT marker symbol layers.  Deep red body, dark inner
// core, controlled rim/highlight detail, and a small shadow for legibility on
// dark land/water without pushing into oversized neon bloom.
//
// Sizing: the SVG is 28x34 source pixels and registered at pixelRatio:1.
// The default icon-size below renders the marker at about 32px tall, while
// selected/hover states remain restrained. icon-anchor: "bottom" keeps the
// pin tip aligned with the geographic coordinate during zoom / drag /
// auto-rotate.
// ---------------------------------------------------------------------------
const PIN_ICON_ID = "echis-marker-pin";
const PIN_ICON_PIXEL_RATIO = 2;
const PIN_ICON_SIZE_DEFAULT = 1;
const PIN_ICON_SIZE_SELECTED = 1.45;
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 24 34">' +
  "<defs>" +
  '<linearGradient id="pinBody" x1="4" y1="2" x2="20" y2="31" gradientUnits="userSpaceOnUse">' +
  `<stop offset="0" stop-color="${ECHIS_GRAD_BRIGHT}"/>` +
  `<stop offset="1" stop-color="${ECHIS_GRAD_DARK}"/>` +
  "</linearGradient>" +
  "</defs>" +
  '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z" fill="url(#pinBody)"/>' +
  '<circle cx="12" cy="12" r="4.2" fill="#0a0d10"/>' +
  "</svg>";

const GLOBAL_PIN_ICON_ID = "echis-marker-pin-premium";
const GLOBAL_PIN_ICON_PIXEL_RATIO = 1;
const GLOBAL_PIN_ICON_SIZE_DEFAULT = 0.8;
const GLOBAL_PIN_ICON_SIZE_HOVER = 0.86;
const GLOBAL_PIN_ICON_SIZE_SELECTED = 0.94;
const GLOBAL_PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">' +
  "<defs>" +
  '<linearGradient id="pinBody" x1="7.5" y1="3" x2="21" y2="30" gradientUnits="userSpaceOnUse">' +
  `<stop offset="0" stop-color="${ECHIS_GRAD_BRIGHT}"/>` +
  `<stop offset="0.56" stop-color="${ECHIS_GRAD_MID}"/>` +
  `<stop offset="1" stop-color="${ECHIS_GRAD_DARK}"/>` +
  "</linearGradient>" +
  '<linearGradient id="pinShade" x1="14" y1="4" x2="14" y2="31" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-color="#ffffff" stop-opacity=".07"/>' +
  '<stop offset=".52" stop-color="#ffffff" stop-opacity=".01"/>' +
  '<stop offset="1" stop-color="#030203" stop-opacity=".13"/>' +
  "</linearGradient>" +
  '<filter id="softRedHalo" x="-38%" y="-28%" width="176%" height="158%" color-interpolation-filters="sRGB">' +
  '<feGaussianBlur stdDeviation="1.65"/>' +
  "</filter>" +
  "</defs>" +
  `<path filter="url(#softRedHalo)" d="M14 31.05S4.45 20.25 4.45 12.65C4.45 6.35 8.78 2.05 14 2.05s9.55 4.3 9.55 10.6c0 7.6-9.55 18.4-9.55 18.4Z" fill="${ECHIS_GRAD_BRIGHT}" opacity=".2"/>` +
  '<path d="M14 31.2S4.7 20.45 4.7 12.75C4.7 6.55 8.9 2.35 14 2.35s9.3 4.2 9.3 10.4c0 7.7-9.3 18.45-9.3 18.45Z" fill="#160204" opacity=".76"/>' +
  '<path d="M14 30.45S5.28 20.18 5.28 12.85C5.28 6.95 9.18 3.02 14 3.02s8.72 3.93 8.72 9.83c0 7.33-8.72 17.6-8.72 17.6Z" fill="url(#pinBody)"/>' +
  '<path d="M14 31.2S4.7 20.45 4.7 12.75C4.7 6.55 8.9 2.35 14 2.35s9.3 4.2 9.3 10.4c0 7.7-9.3 18.45-9.3 18.45Z" fill="url(#pinShade)"/>' +
  `<path d="M14 30.15S5.75 20.05 5.75 12.95C5.75 7.35 9.28 3.45 14 3.45s8.25 3.9 8.25 9.5c0 7.1-8.25 17.2-8.25 17.2Z" fill="none" stroke="${ECHIS_GRAD_BRIGHT}" stroke-opacity=".32" stroke-width=".62"/>` +
  '<path d="M8.65 9.6C9.5 7.18 11.38 5.65 13.82 5.48" fill="none" stroke="#f3c7c0" stroke-opacity=".24" stroke-width=".95" stroke-linecap="round"/>' +
  '<circle cx="14" cy="12.8" r="4.18" fill="#05070b"/>' +
  '<circle cx="14" cy="12.8" r="4.18" fill="none" stroke="#170309" stroke-opacity=".9" stroke-width=".52"/>' +
  "</svg>";

function registerSvgIcon(
  map: maplibregl.Map,
  iconId: string,
  svg: string,
  pixelRatio: number,
): void {
  const tryLoad = () => {
    if (map.hasImage(iconId)) return;
    const img = new Image();
    img.onload = () => {
      try {
        if (!map.hasImage(iconId)) {
          map.addImage(iconId, img, { pixelRatio });
        }
      } catch {
        /* style mid-teardown — ignore */
      }
    };
    img.onerror = () => {
      console.warn("[MapLibreGlobe] pin icon failed to decode");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  // Eager load so the icon is in the sprite cache before the first paint of
  // the symbol layers; styleimagemissing remains the safety net for any
  // unforeseen race during HMR / style reloads.
  tryLoad();
  map.on("styleimagemissing", (e: { id: string }) => {
    if (e.id === iconId) tryLoad();
  });
}

function registerPinIcons(map: maplibregl.Map): void {
  registerSvgIcon(map, PIN_ICON_ID, PIN_SVG, PIN_ICON_PIXEL_RATIO);
  registerSvgIcon(
    map,
    GLOBAL_PIN_ICON_ID,
    GLOBAL_PIN_SVG,
    GLOBAL_PIN_ICON_PIXEL_RATIO,
  );
}

// ---------------------------------------------------------------------------
// Style source — CARTO dark-matter (public, no token).
//
// Chosen for OSIRIS-adjacent dark cartography quality: crisp muted labels,
// thin neutral borders, near-black water/land contrast.  Suitable for a PoC.
// Production should replace with first-party tile hosting or a contracted
// provider before shipping.
// ---------------------------------------------------------------------------
const CARTO_DARK_MATTER_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// ---------------------------------------------------------------------------
// DEFAULT_GLOBE_VIEW — the single source of truth for the globe's default
// camera state.  Used in three places that MUST stay in lock-step:
//   1. initial MapLibre construction (first paint / refresh)
//   2. the Central View imperative reset
//   3. the auto-rotate start frame (which reads the current center, but
//      since auto-rotate begins from this framing the visual baseline is
//      the same)
//
// Composition tuned to the reference: Africa centered, Europe upper-left,
// Asia visible on the right, Mediterranean/Middle East visible, South
// America out of frame.  Tune center.lat slightly higher to pull Europe in,
// slightly lower to expose more of southern Africa.
// ---------------------------------------------------------------------------
const DEFAULT_GLOBE_VIEW = {
  // Türkiye / Eastern Mediterranean as the strategic focus, but the camera
  // center sits south of Türkiye so Anatolia lands in the upper-center of
  // the framed globe rather than dead center.  Longitude held around 35.
  // MapLibre center order is [longitude, latitude].
  center: [35, 31] as [number, number],
  // Tuned visually to the reference screenshot: the full globe is
  // comfortably visible with a black margin around it, Europe / Türkiye /
  // Middle East / Africa / Asia all in frame.  Single source of truth —
  // initial paint and Central View consume this same value.
  zoom: 2.12,
  bearing: 0,
  pitch: 0,
} as const;
const ZOOM_STEP = 0.75;

// ---------------------------------------------------------------------------
// GLOBE_SCREEN_FRAMING — screen-space padding per view mode.
//
// The geographic camera (center/zoom/bearing/pitch) is identical across all
// three view modes — Central View / site-entry composition is preserved.
// What differs is the MapLibre `padding`, which insets the camera's effective
// anchor so the globe is rendered into the empty viewport region instead of
// sitting dead-centre behind the side panels.
//
// Layout reality (matters for how padding is chosen):
//   • Left edge of the free zone is the right edge of the small top-left
//     floating monitoring / signals card (~210px wide + a small margin →
//     ~220px from the left).
//   • Right edge of the free zone is the left edge of the MapControls
//     (zoom / Central View buttons), which sit just to the left of the
//     right panel.  MapControls = `bottom-12 right-4` translated left by
//     `panelOffset` and the buttons are 28px wide:
//       – Global View  → right-edge inset = 4 + 390 + 28 = 422
//       – SOCMINT      → right-edge inset = 4 + 368 + 28 = 400
// → Padding equals those two edges directly, so MapLibre's unpadded
//   centre (= where the geographic centre is rendered) lands at the
//   midpoint of the free zone — the globe sits visually centred between
//   the floating card on the left and the buttons / right panel on the
//   right, no longer hugging the left edge.
// ---------------------------------------------------------------------------
type FramingPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const GLOBE_SCREEN_FRAMING: Record<GlobeViewMode, FramingPadding> = {
  situation: { top: 0, bottom: 0, left: 0, right: 0 },
  global: { top: 16, bottom: 16, left: 220, right: 422 },
  signals: { top: 16, bottom: 16, left: 220, right: 422 },
};

const VIEW_TRANSITION_MS = 1400;

const REGION_GLOBE_VIEWS: Record<
  RegionKey,
  { center: [number, number]; zoom: number }
> = {
  "middle-east": { center: [35, 31], zoom: 2.45 },
  europe: { center: [15, 51], zoom: 2.45 },
  "asia-pacific": { center: [112, 18], zoom: 2.15 },
  americas: { center: [-74, 15], zoom: 2.05 },
};

// ---------------------------------------------------------------------------
// applyDefaultGlobeView — the only function that may set the canonical
// default camera.  Both the initial load (animated=false) and the Central
// View reset (animated=true) MUST go through here so the two views can
// never drift apart.  `padding` lets the caller reframe the same geographic
// camera within the viewport (used by Central View when invoked from a
// view mode that has side panels).
// ---------------------------------------------------------------------------
function applyDefaultGlobeView(
  map: maplibregl.Map,
  animated: boolean,
  padding: FramingPadding = GLOBE_SCREEN_FRAMING.situation,
): void {
  const camera = {
    center: DEFAULT_GLOBE_VIEW.center,
    zoom: DEFAULT_GLOBE_VIEW.zoom,
    bearing: DEFAULT_GLOBE_VIEW.bearing,
    pitch: DEFAULT_GLOBE_VIEW.pitch,
    padding,
  };
  if (animated) {
    map.easeTo({
      ...camera,
      duration: CENTRAL_VIEW_ANIM_MS,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  } else {
    map.jumpTo(camera);
  }
}

// Apply a view mode's camera + screen framing + marker visibility in one
// call.  Geographic camera comes from DEFAULT_GLOBE_VIEW (same for all
// modes — Central View / site-entry composition is preserved); only the
// padding shifts so the globe re-frames into the empty area between panels.
// When `animated` is true the camera eases over VIEW_TRANSITION_MS;
// otherwise it jumps (used on first-paint sync, where no animation is
// desired).
function applyViewMode(
  map: maplibregl.Map,
  view: GlobeViewMode,
  animated: boolean,
): void {
  const framing = GLOBE_SCREEN_FRAMING[view];
  const camera = {
    center: DEFAULT_GLOBE_VIEW.center,
    zoom: DEFAULT_GLOBE_VIEW.zoom,
    bearing: DEFAULT_GLOBE_VIEW.bearing,
    pitch: DEFAULT_GLOBE_VIEW.pitch,
    padding: framing,
  };
  try {
    if (animated) {
      map.easeTo({
        ...camera,
        duration: VIEW_TRANSITION_MS,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    } else {
      map.jumpTo(camera);
    }
  } catch {
    /* map mid-teardown — ignore */
  }
  setMarkerVisibility(map, "global", view === "global");
  setMarkerVisibility(map, "signals", view === "signals");
}

function applyFramedRegionView(
  map: maplibregl.Map,
  region: RegionKey,
  framing: FramingPadding,
): void {
  const target = REGION_GLOBE_VIEWS[region];
  try {
    map.easeTo({
      center: target.center,
      zoom: target.zoom,
      bearing: DEFAULT_GLOBE_VIEW.bearing,
      pitch: DEFAULT_GLOBE_VIEW.pitch,
      padding: framing,
      duration: VIEW_TRANSITION_MS,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  } catch {
    /* map mid-teardown — ignore */
  }
}

function setMarkerVisibility(
  map: maplibregl.Map,
  kind: MarkerKind,
  visible: boolean,
): void {
  const ids =
    kind === "global"
      ? [
          MARKER_BLOOM_GLOBAL,
          MARKER_GLOW_GLOBAL,
          MARKER_LAYER_GLOBAL,
          MARKER_HOVER_GLOW_GLOBAL,
          MARKER_HOVER_LAYER_GLOBAL,
          MARKER_SEL_GLOBAL,
          MARKER_BADGE_GLOBAL,
          MARKER_BADGE_TEXT_GLOBAL,
        ]
      : [
          MARKER_BLOOM_SIGNALS,
          MARKER_GLOW_SIGNALS,
          MARKER_LAYER_SIGNALS,
          MARKER_SEL_SIGNALS,
        ];
  const vis = visible ? "visible" : "none";
  try {
    for (const id of ids) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  } catch {
    /* layer not yet added — skip */
  }
}

// ---------------------------------------------------------------------------
// setupMarkerLayers — idempotent, called once after style.load.
//
// Layer stack per kind (bottom → top):
//
//  BLOOM  large soft spread — outer neon bloom (big blurred circle)
//  GLOW   small crisp ring  — inner neon ring with bright stroke
//  LAYER  normal pin icons  — all features except the selected one
//  SEL    selected pin icon — only the selected feature, larger
//
// BLOOM + GLOW start with opacity 0 and LAYER starts unfiltered.
// SEL starts with a "match nothing" filter.
// applyMarkerSelection() switches all four layers live on selection change.
//
// Glow circles are translated ≈11 px upward (viewport space) so they wrap
// the pin head rather than the tip, which sits at the geographic coordinate.
// ---------------------------------------------------------------------------
function setupMarkerLayers(map: maplibregl.Map): void {
  const emptyFC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

  const addGlowLayers = (source: string, bloomId: string, glowId: string) => {
    const isGlobal = source === MARKER_SOURCE_GLOBAL;
    // Outer selection bloom — soft and controlled, centered on the pin head.
    if (!map.getLayer(bloomId)) {
      map.addLayer({
        id: bloomId,
        type: "circle",
        source,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 22,
          "circle-color": isGlobal ? ECHIS_GRAD_MID : ECHIS_GRAD_BRIGHT,
          "circle-blur": isGlobal ? 0.94 : 1,
          "circle-opacity": 0,
          "circle-translate": isGlobal ? [0, -16] : [0, -11],
          "circle-translate-anchor": "viewport",
        },
      } as unknown as maplibregl.LayerSpecification);
    }
    // Selected ring — tight enough to read as premium, not a neon cloud.
    if (!map.getLayer(glowId)) {
      map.addLayer({
        id: glowId,
        type: "circle",
        source,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": isGlobal ? 11 : 10,
          "circle-color": isGlobal
            ? "rgba(168,13,24,0.22)"
            : ECHIS_GRAD_GLOW,
          "circle-blur": isGlobal ? 0.34 : 0.15,
          "circle-opacity": 0,
          "circle-stroke-width": isGlobal ? 1.2 : 2.5,
          "circle-stroke-color": ECHIS_GRAD_BRIGHT,
          "circle-stroke-opacity": 0,
          "circle-translate": isGlobal ? [0, -16] : [0, -11],
          "circle-translate-anchor": "viewport",
        },
      } as unknown as maplibregl.LayerSpecification);
    }
  };

  const addHoverLayers = (
    source: string,
    hoverGlowId: string,
    hoverLayerId: string,
  ) => {
    if (!map.getLayer(hoverGlowId)) {
      map.addLayer({
        id: hoverGlowId,
        type: "circle",
        source,
        filter: FILTER_MATCH_NONE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 15,
          "circle-color": ECHIS_GRAD_BRIGHT,
          "circle-blur": 0.72,
          "circle-opacity": 0.24,
          "circle-opacity-transition": { duration: 180, delay: 0 },
          "circle-translate": [0, -16],
          "circle-translate-anchor": "viewport",
        },
      } as unknown as maplibregl.LayerSpecification);
    }
    if (!map.getLayer(hoverLayerId)) {
      map.addLayer({
        id: hoverLayerId,
        type: "symbol",
        source,
        filter: FILTER_MATCH_NONE,
        layout: {
          visibility: "none",
          "icon-image": GLOBAL_PIN_ICON_ID,
          "icon-anchor": "bottom",
          "icon-size": GLOBAL_PIN_ICON_SIZE_HOVER,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
          "icon-opacity-transition": { duration: 180, delay: 0 },
        },
      });
    }
  };

  const addGlobalBadgeLayers = () => {
    if (!map.getLayer(MARKER_BADGE_GLOBAL)) {
      map.addLayer({
        id: MARKER_BADGE_GLOBAL,
        type: "circle",
        source: MARKER_SOURCE_GLOBAL,
        filter: MARKER_COUNT_BADGE_FILTER,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "case",
            [">=", ["to-number", ["get", MARKER_ITEM_COUNT_PROP], 1], 100],
            8.4,
            7.2,
          ],
          "circle-color": "#07090f",
          "circle-opacity": 0.94,
          "circle-opacity-transition": { duration: 180, delay: 0 },
          "circle-stroke-width": 1.25,
          "circle-stroke-color": ECHIS_GRAD_BRIGHT,
          "circle-stroke-opacity": 0.92,
          "circle-stroke-opacity-transition": { duration: 180, delay: 0 },
          "circle-translate": [9, -23],
          "circle-translate-anchor": "viewport",
        },
      } as unknown as maplibregl.LayerSpecification);
    }
    if (!map.getLayer(MARKER_BADGE_TEXT_GLOBAL)) {
      map.addLayer({
        id: MARKER_BADGE_TEXT_GLOBAL,
        type: "symbol",
        source: MARKER_SOURCE_GLOBAL,
        filter: MARKER_COUNT_BADGE_FILTER,
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", MARKER_ITEM_COUNT_PROP]],
          "text-size": [
            "case",
            [">=", ["to-number", ["get", MARKER_ITEM_COUNT_PROP], 1], 100],
            8,
            9.5,
          ],
          "text-font": ["Noto Sans Regular"],
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#f4f7fb",
          "text-halo-color": "rgba(0,0,0,0.72)",
          "text-halo-width": 0.55,
          "text-opacity": 1,
          "text-opacity-transition": { duration: 180, delay: 0 },
          "text-translate": [9, -23],
          "text-translate-anchor": "viewport",
        },
      } as unknown as maplibregl.LayerSpecification);
    }
  };

  const addPinLayers = (
    source: string,
    layerId: string,
    selId: string,
  ) => {
    const isGlobal = source === MARKER_SOURCE_GLOBAL;
    const iconId = isGlobal ? GLOBAL_PIN_ICON_ID : PIN_ICON_ID;
    const defaultSize = isGlobal ? GLOBAL_PIN_ICON_SIZE_DEFAULT : PIN_ICON_SIZE_DEFAULT;
    const selectedSize = isGlobal ? GLOBAL_PIN_ICON_SIZE_SELECTED : PIN_ICON_SIZE_SELECTED;
    // Normal pins — all features; selected feature excluded once a selection exists
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "symbol",
        source,
        layout: {
          visibility: "none",
          "icon-image": iconId,
          "icon-anchor": "bottom",
          "icon-size": defaultSize,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
          "icon-opacity-transition": { duration: 180, delay: 0 },
        },
      });
    }
    // Selected pin — only the selected feature, drawn larger on top
    if (!map.getLayer(selId)) {
      map.addLayer({
        id: selId,
        type: "symbol",
        source,
        filter: FILTER_MATCH_NONE,
        layout: {
          visibility: "none",
          "icon-image": iconId,
          "icon-anchor": "bottom",
          "icon-size": selectedSize,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 1,
          "icon-opacity-transition": { duration: 180, delay: 0 },
        },
      });
    }
  };

  try {
    // ── Global View ──────────────────────────────────────────────────────────
    if (!map.getSource(MARKER_SOURCE_GLOBAL)) {
      map.addSource(MARKER_SOURCE_GLOBAL, { type: "geojson", data: emptyFC });
    }
    addGlowLayers(MARKER_SOURCE_GLOBAL, MARKER_BLOOM_GLOBAL, MARKER_GLOW_GLOBAL);
    addPinLayers(MARKER_SOURCE_GLOBAL, MARKER_LAYER_GLOBAL, MARKER_SEL_GLOBAL);
    addHoverLayers(
      MARKER_SOURCE_GLOBAL,
      MARKER_HOVER_GLOW_GLOBAL,
      MARKER_HOVER_LAYER_GLOBAL,
    );
    addGlobalBadgeLayers();

    // ── SOCMINT ──────────────────────────────────────────────────────────────
    if (!map.getSource(MARKER_SOURCE_SIGNALS)) {
      map.addSource(MARKER_SOURCE_SIGNALS, { type: "geojson", data: emptyFC });
    }
    addGlowLayers(MARKER_SOURCE_SIGNALS, MARKER_BLOOM_SIGNALS, MARKER_GLOW_SIGNALS);
    addPinLayers(MARKER_SOURCE_SIGNALS, MARKER_LAYER_SIGNALS, MARKER_SEL_SIGNALS);
    addHoverLayers(
      MARKER_SOURCE_SIGNALS,
      MARKER_HOVER_GLOW_SIGNALS,
      MARKER_HOVER_LAYER_SIGNALS,
    );
  } catch (e) {
    console.warn("[MapLibreGlobe] marker layer setup failed:", e);
  }
}

// ---------------------------------------------------------------------------
// applyMarkerSelection — called from the selectedGlobalId / selectedSignalsId
// useEffects.  When a selection is active:
//   • BLOOM + GLOW: opacity snaps to neon-red values (only for the selected feature)
//   • LAYER: filter excludes the selected feature (SEL draws it instead)
//   • SEL: filter includes only the selected feature (drawn 1.45x, on top)
// When cleared (selectedId null/undefined):
//   • BLOOM + GLOW: opacity 0 and stroke-opacity 0
//   • LAYER: filter removed (show all)
//   • SEL: FILTER_MATCH_NONE (show nothing)
// ---------------------------------------------------------------------------
function applyMarkerSelection(
  map: maplibregl.Map,
  kind: MarkerKind,
  selectedId: string | null | undefined,
): void {
  const bloomId  = kind === "global" ? MARKER_BLOOM_GLOBAL  : MARKER_BLOOM_SIGNALS;
  const glowId   = kind === "global" ? MARKER_GLOW_GLOBAL   : MARKER_GLOW_SIGNALS;
  const layerId  = kind === "global" ? MARKER_LAYER_GLOBAL  : MARKER_LAYER_SIGNALS;
  const selId    = kind === "global" ? MARKER_SEL_GLOBAL    : MARKER_SEL_SIGNALS;

  try {
    if (selectedId) {
      applyMarkerHover(map, kind, null);
      // Match expressions route the selected feature to highlight values;
      // all other features get transparent (0) so glow is exclusive.
      const isGlobal = kind === "global";

      // Outer bloom
      map.setPaintProperty(
        bloomId,
        "circle-opacity",
        selectedMarkerOpacityExpression(selectedId, isGlobal ? 0.24 : 0.45),
      );
      // Inner ring: fill + vivid stroke
      map.setPaintProperty(
        glowId,
        "circle-opacity",
        selectedMarkerOpacityExpression(selectedId, isGlobal ? 0.42 : 0.7),
      );
      map.setPaintProperty(
        glowId,
        "circle-stroke-opacity",
        selectedMarkerOpacityExpression(selectedId, isGlobal ? 0.68 : 1),
      );

      // Normal layer excludes selected so the selected-pin layer (larger, on top)
      // renders cleanly without stacking.
      map.setFilter(layerId,
        ["!=", ["get", "id"], selectedId] as unknown as maplibregl.FilterSpecification,
      );
      // Selected pin layer — show only the selected feature
      map.setFilter(selId,
        ["==", ["get", "id"], selectedId] as unknown as maplibregl.FilterSpecification,
      );
    } else {
      // Clear all highlight state
      map.setPaintProperty(bloomId, "circle-opacity", 0);
      map.setPaintProperty(glowId,  "circle-opacity", 0);
      map.setPaintProperty(glowId,  "circle-stroke-opacity", 0);
      map.setFilter(layerId, null);
      map.setFilter(selId, FILTER_MATCH_NONE as unknown as maplibregl.FilterSpecification);
    }
  } catch {
    /* layers may not exist yet — initial load race, safe to ignore */
  }

}

function applyMarkerHover(
  map: maplibregl.Map,
  kind: MarkerKind,
  hoveredId: string | null | undefined,
): void {
  const hoverGlowId =
    kind === "global" ? MARKER_HOVER_GLOW_GLOBAL : MARKER_HOVER_GLOW_SIGNALS;
  const hoverLayerId =
    kind === "global" ? MARKER_HOVER_LAYER_GLOBAL : MARKER_HOVER_LAYER_SIGNALS;
  const filter = hoveredId
    ? (["==", ["get", "id"], hoveredId] as unknown as maplibregl.FilterSpecification)
    : (FILTER_MATCH_NONE as unknown as maplibregl.FilterSpecification);

  try {
    map.setFilter(hoverGlowId, filter);
    map.setFilter(hoverLayerId, filter);
  } catch {
    /* layers may not exist yet — initial load race, safe to ignore */
  }
}

function setGlobalMarkerLayerOpacity(
  map: maplibregl.Map,
  opacity: number,
  duration: number,
): void {
  const setPaint = (
    layerId: string,
    property: string,
    value: number,
  ) => {
    if (!map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, `${property}-transition`, { duration, delay: 0 });
    map.setPaintProperty(layerId, property, value);
  };

  try {
    setPaint(MARKER_LAYER_GLOBAL, "icon-opacity", opacity);
    setPaint(MARKER_SEL_GLOBAL, "icon-opacity", opacity);
    setPaint(MARKER_HOVER_LAYER_GLOBAL, "icon-opacity", opacity);
    setPaint(MARKER_HOVER_GLOW_GLOBAL, "circle-opacity", 0.24 * opacity);
    setPaint(MARKER_BADGE_GLOBAL, "circle-opacity", 0.94 * opacity);
    setPaint(MARKER_BADGE_GLOBAL, "circle-stroke-opacity", 0.92 * opacity);
    setPaint(MARKER_BADGE_TEXT_GLOBAL, "text-opacity", opacity);
  } catch {
    /* layers may not exist yet — initial load race, safe to ignore */
  }
}

// Push a fresh feature set into a marker source.  Safe to call before
// layers exist (no-op) and tolerant of mid-teardown errors.
function applyMarkerData(
  map: maplibregl.Map,
  kind: MarkerKind,
  features: MarkerFeature[],
): void {
  const sourceId =
    kind === "global" ? MARKER_SOURCE_GLOBAL : MARKER_SOURCE_SIGNALS;
  const source = map.getSource(sourceId);
  if (!source || source.type !== "geojson") return;
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: features.map((f) => {
      const groupedItems = (f as MarkerFeature & { items?: unknown[] }).items;
      const itemCount = Math.max(
        1,
        f.itemCount ?? (Array.isArray(groupedItems) ? groupedItems.length : 1),
      );
      return {
        type: "Feature",
        id: f.id,
        geometry: { type: "Point", coordinates: [f.lng, f.lat] },
        properties: {
          id: f.id,
          severity: f.severity ?? null,
          confidence: f.confidence ?? null,
          [MARKER_ITEM_COUNT_PROP]: itemCount,
        },
      };
    }),
  };
  try {
    (source as maplibregl.GeoJSONSource).setData(fc);
  } catch {
    /* mid-teardown — ignore */
  }
}

function markerItemCount(feature: MarkerFeature): number {
  const groupedItems = (feature as MarkerFeature & { items?: unknown[] }).items;
  return Math.max(
    1,
    feature.itemCount ?? (Array.isArray(groupedItems) ? groupedItems.length : 1),
  );
}

function markerDataSignature(features: MarkerFeature[]): string {
  return features
    .map((feature) =>
      [
        feature.id,
        feature.lng,
        feature.lat,
        feature.severity ?? "",
        feature.confidence ?? "",
        markerItemCount(feature),
      ].join(":"),
    )
    .join("|");
}

// Time after which a still-loading map is treated as failed.  Prevents the
// loading placeholder from sitting forever if the style/tiles never arrive.
const LOAD_TIMEOUT_MS = 9000;
const MARKER_DATA_DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Auto-rotate — calm, ambient globe motion when the operator is idle.
//
// Implementation note: rotation is driven by stepping the map *center
// longitude* via jumpTo, not by changing bearing.  Bearing rotation would
// spin the viewport like a clock (counter-clockwise flat-disk effect);
// stepping longitude makes the globe surface naturally drift right-to-left.
//
// 1.5°/sec → one full revolution every 4 minutes.  A touch livelier than
// the previous 1.2°/s baseline; still ambient and not consumer-map fast.
// Two distinct idle delays:
//   • CENTRAL_VIEW_IDLE_DELAY_MS — short, after a Central View reset
//   • INTERACTION_IDLE_DELAY_MS  — longer, after raw user input
// ---------------------------------------------------------------------------
const AUTO_ROTATE_DEG_PER_SEC = 1.5;
const CENTRAL_VIEW_IDLE_DELAY_MS = 3_000;
const INTERACTION_IDLE_DELAY_MS = 15_000;
// Duration of the Central View easeTo (kept in sync with applyDefaultGlobeView).
const CENTRAL_VIEW_ANIM_MS = 1200;
// Cap on per-frame delta so a tab-throttle or long task can't make the
// globe leap forward; ~50ms ≈ one slow frame's worth.
const AUTO_ROTATE_MAX_DT_S = 0.05;
// eventData marker placed on every programmatic jumpTo so MapLibre move
// events triggered by auto-rotate can be distinguished from real user input.
const AUTO_ROTATE_EVENT_TAG = "echisAutoRotate";

// ---------------------------------------------------------------------------
// Dark colour palette — tuned to integrate with the ECHIS panel.
//
// Hierarchy (darkest → lightest by perceived brightness):
//   PANEL_BG         outer container, behind canvas
//   WATER_FILL       oceans/seas — slightly above panel so the globe edge
//                    stays visible against the panel
//   LAND_FILL        background layer = land base — clearly readable above
//                    water but still restrained
//
// Borders, labels: muted gray, low opacity, no neon, no pure white.
// ---------------------------------------------------------------------------
// --- Luxe palette (option A): vivid red ocean, black continents, white
// borders — the Luxe Globe look applied to the detailed OSM basemap so all
// zoom / city-district / label detail is preserved.
const PANEL_BG = "#030203";
const LAND_FILL = "#070607"; // black continents (land base)
const LAND_OVERLAY = "#110405";
const WATER_FILL = ECHIS_GRAD_DARK;
const WATERWAY_FILL = ECHIS_GRAD_MID;

// National border — clean white, the dominant boundary line (Luxe look).
const BORDER_COUNTRY = "rgba(168, 13, 24, 0.72)";
// Sub-national (state/province/district) lines — faint white so OSM detail
// stays visible without competing with the country skeleton.
const BORDER_ADMIN = "rgba(111, 7, 16, 0.28)";

const LABEL_MAJOR = "rgba(206, 210, 218, 0.74)";
const LABEL_MINOR = "rgba(150, 158, 170, 0.46)";
const LABEL_WATER = "rgba(140, 150, 166, 0.50)";
const LABEL_HALO = "rgba(5, 3, 5, 0.85)";

// ---------------------------------------------------------------------------
// Default-view country whitelist.  At default / Central View zoom only the
// continents (style default) plus Türkiye and a small set of globally
// significant countries from each continent stay labeled; the rest fade
// in past LABEL_DETAIL_ZOOM so user zoom-in restores the full country
// label set.  Sub-country labels (cities, states, etc.) are left to the
// CARTO style's own zoom rules.
// ---------------------------------------------------------------------------
const LABEL_DETAIL_ZOOM = 2.5;
const DEFAULT_VIEW_COUNTRIES = [
  // Türkiye
  "Turkey",
  "Türkiye",
  "Turkiye",
  // Major anchors per region — kept sparse for a clean, balanced look
  "United States",
  "United States of America",
  "USA",
  "Brazil",
  "Russia",
  "China",
  "India",
  "Australia",
  "South Africa",
  // Europe (a couple)
  "France",
  "Germany",
  "United Kingdom",
  // North Africa (a couple)
  "Egypt",
  "Algeria",
  // Additional regional anchors
  "Iran",
  "Ukraine",
  "Ethiopia",
  "Afghanistan",
  "Bosnia and Herzegovina",
  "Bosna i Hercegovina",
];

type LoadState = "loading" | "ready" | "error";

// ---------------------------------------------------------------------------
// Dark tone pass — categorises every layer in the loaded style by its id and
// applies the panel-friendly colour palette.  Designed to be resilient: any
// layer that doesn't match a category is left alone, and any per-layer paint
// failure is swallowed so a single bad id can't break the whole pass.
//
// Categories handled:
//   • background          → land base fill
//   • water / ocean       → near-black water fill
//   • waterway            → slightly lighter than ocean, mostly invisible
//   • landcover/landuse   → blended overlay on the land base
//   • boundary/admin      → muted thin lines, country lines slightly stronger
//   • road/tunnel/bridge  → hidden (consumer-map clutter)
//   • building/poi        → hidden
//   • place_* labels      → muted gray text, dark halo
//   • water_name labels   → cooler muted text
//   • road labels/shields → hidden
// ---------------------------------------------------------------------------
function applyDarkTone(map: maplibregl.Map): void {
  const style = map.getStyle();
  const layers = style?.layers ?? [];

  let bgFound = false;
  let waterFound = false;
  const skipped: string[] = [];

  for (const layer of layers) {
    const id = layer.id;
    const type = layer.type;

    try {
      if (
        USE_ECHIS_OSM_BASEMAP &&
        type === "symbol" &&
        (id === "water_name" || /^place_/.test(id))
      ) {
        continue;
      }
      if (
        USE_ECHIS_OSM_BASEMAP &&
        type === "line" &&
        (id === "boundary_regional_admin" || id === "boundary_local_admin")
      ) {
        continue;
      }
      // ── Background — land base for the whole globe ─────────────────────
      if (id === "background" && type === "background") {
        bgFound = true;
        map.setPaintProperty(id, "background-color", LAND_FILL);
        continue;
      }

      // ── Water (oceans, seas, lakes) ────────────────────────────────────
      if (/^(water|ocean)(_|$)/.test(id) && type === "fill") {
        waterFound = true;
        map.setPaintProperty(id, "fill-color", WATER_FILL);
        map.setPaintProperty(id, "fill-opacity", 1);
        continue;
      }

      // ── Waterways (rivers) — barely visible ───────────────────────────
      if (/^waterway/.test(id) && type === "line") {
        map.setPaintProperty(id, "line-color", WATERWAY_FILL);
        map.setPaintProperty(id, "line-opacity", 0.55);
        continue;
      }

      // ── Landcover / landuse / parks — gentle overlay on land base ──────
      if (/^(landcover|landuse|park|wood)/.test(id) && type === "fill") {
        map.setPaintProperty(id, "fill-color", LAND_OVERLAY);
        map.setPaintProperty(id, "fill-opacity", 0.45);
        continue;
      }

      // ── Country borders + sub-admin lines ──────────────────────────────
      if (/^(boundary|admin)/.test(id) && type === "line") {
        const isCountry =
          /country/.test(id) || /_1\b/.test(id) || /\bcountry\b/.test(id);
        map.setPaintProperty(
          id,
          "line-color",
          isCountry ? BORDER_COUNTRY : BORDER_ADMIN,
        );
        // Keep stroke thin regardless of the style's default.
        map.setPaintProperty(id, "line-width", isCountry ? 0.6 : 0.4);
        continue;
      }

      // ── Hide: roads / tunnels / bridges / transit / aero / rail ───────
      if (
        /^(road|tunnel|bridge|highway|motorway|railway|aeroway|transit|ferry)/.test(
          id,
        )
      ) {
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }

      // ── Hide: buildings, POIs, house numbers ──────────────────────────
      if (/^(building|poi|housenum)/.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }

      // ── Hide: road / highway shields and route labels ─────────────────
      if (/road_label|road_shield|highway_shield|motorway_junction/.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }

      // ── Water labels (oceans, seas) — cool muted text ─────────────────
      if (
        /water_name|marine_label|ocean_label/.test(id) &&
        type === "symbol"
      ) {
        map.setPaintProperty(id, "text-color", LABEL_WATER);
        map.setPaintProperty(id, "text-halo-color", LABEL_HALO);
        map.setPaintProperty(id, "text-halo-width", 1);
        continue;
      }

      // ── Place labels (country, state, city, town, village…) ───────────
      if (/^place/.test(id) && type === "symbol") {
        const isMajor =
          /(country|continent|capital|state|city)/.test(id) &&
          !/(other|village|hamlet|suburb)/.test(id);
        map.setPaintProperty(
          id,
          "text-color",
          isMajor ? LABEL_MAJOR : LABEL_MINOR,
        );
        map.setPaintProperty(id, "text-halo-color", LABEL_HALO);
        map.setPaintProperty(id, "text-halo-width", isMajor ? 1.2 : 1);
        continue;
      }
    } catch {
      // Best-effort; mismatched paint props / unsupported layers are skipped.
      skipped.push(id);
    }
  }

  // Dev-only diagnostics — useful for confirming the style had the expected
  // anchors; production stays silent.
  if (process.env.NODE_ENV !== "production") {
    if (!bgFound) {
      console.warn("[MapLibreGlobe] no background layer in loaded style");
    }
    if (!waterFound) {
      console.warn("[MapLibreGlobe] no water/ocean layer in loaded style");
    }
    if (skipped.length > 0) {
      console.debug("[MapLibreGlobe] tuning skipped layers:", skipped);
    }
  }
}

// ---------------------------------------------------------------------------
// Country label declutter — at default / Central View zoom, only the
// continent labels (style default) and the whitelisted countries stay
// visible.  Other country labels fade in around LABEL_DETAIL_ZOOM via a
// per-feature text-opacity expression, so user zoom-in restores the full
// label set.  Sub-country labels (cities, states, etc.) are NOT touched
// here — CARTO's own zoom rules handle them.
// ---------------------------------------------------------------------------
const WHITELIST_LAYER_ID = "echis-country-whitelist";

function applyCountryLabelWhitelist(map: maplibregl.Map): void {
  const style = map.getStyle();
  const layers = style?.layers ?? [];

  // Step 1: hide all native country label layers below LABEL_DETAIL_ZOOM
  // via a per-feature text-opacity fade.  Our own custom whitelist layer
  // covers the low-zoom range and CARTO's native rendering takes over
  // once the user zooms past the fade window.
  const lowZoomHide: maplibregl.ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    LABEL_DETAIL_ZOOM - 0.3,
    0,
    LABEL_DETAIL_ZOOM + 0.3,
    1,
  ];

  // Probe one of the native country symbol layers to copy its source /
  // source-layer / font into our custom whitelist layer — that way we
  // hit exactly the same vector tiles the style itself uses without
  // hardcoding CARTO-specific names.
  let countrySource: string | undefined;
  let countrySourceLayer: string | undefined;
  let countryFont: unknown;

  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const id = layer.id;
    if (!/country/i.test(id)) continue;
    if (/continent/i.test(id)) continue;
    const lyr = layer as unknown as {
      source?: string;
      "source-layer"?: string;
      layout?: { "text-font"?: unknown };
    };
    if (!countrySource && lyr.source) {
      countrySource = lyr.source;
      countrySourceLayer = lyr["source-layer"];
      countryFont = lyr.layout?.["text-font"];
    }
    try {
      map.setPaintProperty(id, "text-opacity", lowZoomHide);
    } catch {
      /* skip */
    }
  }

  // Step 2: add a dedicated whitelist layer drawing only the few
  // globally-significant countries at low zoom.  Reuses the loaded basemap
  // source so the data is guaranteed to be present.  Auto-cleaned by
  // its own maxzoom once the native layers fade in.
  if (
    countrySource &&
    countrySourceLayer &&
    !map.getLayer(WHITELIST_LAYER_ID)
  ) {
    const isOsmCountrySource = countrySource === OSM_VECTOR_SOURCE_ID;
    const fontProp = (countryFont as string[] | undefined) ?? [
      isOsmCountrySource ? "Noto Sans Regular" : "Open Sans Regular",
    ];
    try {
      map.addLayer({
        id: WHITELIST_LAYER_ID,
        type: "symbol",
        source: countrySource,
        "source-layer": countrySourceLayer,
        minzoom: 0,
        maxzoom: LABEL_DETAIL_ZOOM + 0.3,
        filter: [
          "any",
          [
            "match",
            ["coalesce", ["get", "name_en"], ["get", "name:en"], ""],
            DEFAULT_VIEW_COUNTRIES,
            true,
            false,
          ],
          [
            "match",
            ["coalesce", ["get", "name"], ""],
            DEFAULT_VIEW_COUNTRIES,
            true,
            false,
          ],
          [
            "match",
            ["coalesce", ["get", "name_en"], ""],
            DEFAULT_VIEW_COUNTRIES,
            true,
            false,
          ],
          [
            "match",
            ["coalesce", ["get", "name:latin"], ""],
            DEFAULT_VIEW_COUNTRIES,
            true,
            false,
          ],
        ],
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name:latin"],
            ["get", "name"],
            "",
          ],
          "text-font": fontProp,
          "text-size": isOsmCountrySource
            ? ["interpolate", ["linear"], ["zoom"], 0, 11, 2.5, 12.5]
            : 12,
          "text-letter-spacing": isOsmCountrySource ? 0.11 : 0.1,
          "text-transform": "uppercase",
          "text-max-width": isOsmCountrySource ? 7 : 8,
          "text-padding": isOsmCountrySource ? 8 : 4,
        },
        paint: {
          "text-color": isOsmCountrySource
            ? "rgba(196, 202, 198, 0.86)"
            : LABEL_MAJOR,
          "text-halo-color": LABEL_HALO,
          "text-halo-width": isOsmCountrySource ? 1 : 1.2,
          "text-opacity": isOsmCountrySource ? 0.9 : 1,
        },
      } as unknown as maplibregl.LayerSpecification);
    } catch (e) {
      console.warn("[MapLibreGlobe] whitelist layer add failed:", e);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[MapLibreGlobe] country source:",
      countrySource,
      "source-layer:",
      countrySourceLayer,
    );
  }
}

export const MapLibreGlobe = forwardRef<MapLibreGlobeHandle, MapLibreGlobeProps>(
  function MapLibreGlobe(
    {
      activeView = "situation",
      activeRegion,
      activeSignalsRegion,
      globalMarkers,
      signalsMarkers,
      onMarkerClick,
      autoRotatePaused = false,
      onGlobalMarkerRevealStart,
      selectedGlobalId,
      selectedSignalsId,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const pendingGlobalMarkersRef = useRef<MarkerFeature[]>([]);
    const globalMarkerDebounceTimerRef = useRef<number | null>(null);
    const globalMarkerRevealFrameRef = useRef<number | null>(null);
    const globalMarkerRenderedIdsRef = useRef<Set<string>>(new Set());
    const globalMarkerTargetSignatureRef = useRef("");
    const signalsMarkerTargetSignatureRef = useRef("");
    const globalMarkerVisibleCountRef = useRef(0);
    const selectedGlobalIdRef = useRef<string | null | undefined>(selectedGlobalId);
    const selectedSignalsIdRef = useRef<string | null | undefined>(selectedSignalsId);
    const autoRotatePausedPropRef = useRef(autoRotatePaused);
    const setAutoRotatePausedRef = useRef<(paused: boolean) => void>(() => {});

    // Imperative pause-rotate hook — wired by the useEffect below and called
    // from the imperative handle (button-driven zoom/center) and from real
    // user input listeners on the canvas.  Accepts the idle delay (ms) so
    // Central View can use a shorter resume window than raw user input.
    const pauseAutoRotateRef = useRef<(delayMs: number) => void>(() => {});

    // Stable ref for onMarkerClick so the one-time map setup closure always
    // calls the latest prop value without needing to re-register handlers.
    const onMarkerClickRef = useRef(onMarkerClick);
    useEffect(() => {
      onMarkerClickRef.current = onMarkerClick;
    }, [onMarkerClick]);

    const onGlobalMarkerRevealStartRef = useRef(onGlobalMarkerRevealStart);
    useEffect(() => {
      onGlobalMarkerRevealStartRef.current = onGlobalMarkerRevealStart;
    }, [onGlobalMarkerRevealStart]);

    useEffect(() => {
      selectedGlobalIdRef.current = selectedGlobalId;
    }, [selectedGlobalId]);

    useEffect(() => {
      selectedSignalsIdRef.current = selectedSignalsId;
    }, [selectedSignalsId]);

    useEffect(() => {
      autoRotatePausedPropRef.current = autoRotatePaused;
      setAutoRotatePausedRef.current(autoRotatePaused);
    }, [autoRotatePaused]);

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Tracks the last view actually applied to the map so we can tell
    // first-application (jumpTo, no auto-rotate pause) from a real user
    // navigation between views (easeTo + pause).
    const lastAppliedViewRef = useRef<GlobeViewMode | null>(null);

    // Guards auto-rotate from starting before the view-mode effect has
    // committed the initial camera position.  Without this, the RAF loop
    // begins rotating immediately when mapLoaded flips, which is 1-3 frames
    // before the React view-mode effect fires its first jumpTo — causing a
    // visible positional conflict and startup stutter.  Set to true once the
    // first applyViewMode call is complete; reset on map teardown.
    const viewReadyRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const m = mapRef.current;
          if (!m) return;
          pauseAutoRotateRef.current(INTERACTION_IDLE_DELAY_MS);
          m.zoomTo(m.getZoom() + ZOOM_STEP, { duration: 350 });
        },
        zoomOut: () => {
          const m = mapRef.current;
          if (!m) return;
          pauseAutoRotateRef.current(INTERACTION_IDLE_DELAY_MS);
          m.zoomTo(m.getZoom() - ZOOM_STEP, { duration: 350 });
        },
        projectMarker: (lng: number, lat: number) => {
          const m = mapRef.current;
          if (!m) return null;
          try {
            const point = m.project([lng, lat]);
            return { x: point.x, y: point.y };
          } catch {
            return null;
          }
        },
        setAutoRotatePaused: (paused: boolean) => {
          autoRotatePausedPropRef.current = paused;
          setAutoRotatePausedRef.current(paused);
        },
        centerView: () => {
          const m = mapRef.current;
          if (!m) return;
          // Pause auto-rotate immediately so it can't fight the easeTo or
          // mutate the camera mid-reset.  Schedule resume CENTRAL_VIEW
          // _IDLE_DELAY_MS AFTER the animation finishes, not after the
          // click — matches "dönüş tamamlandıktan sonra".  Reframe with
          // the current view's screen padding so Central View from inside
          // Global View / SOCMINT stays out from behind the side panels.
          const currentView = lastAppliedViewRef.current ?? "situation";
          const framing = GLOBE_SCREEN_FRAMING[currentView];
          pauseAutoRotateRef.current(
            CENTRAL_VIEW_ANIM_MS + CENTRAL_VIEW_IDLE_DELAY_MS,
          );
          applyDefaultGlobeView(m, true, framing);
        },
        focusMarker: (lng: number, lat: number) => {
          const m = mapRef.current;
          if (!m) return;
          // Pause auto-rotate for the standard interaction window so it
          // does not fight the camera movement.
          pauseAutoRotateRef.current(INTERACTION_IDLE_DELAY_MS);
          // Keep the current zoom.  Apply the current view's padding so
          // the target coordinate is centered in the open viewport area
          // (not hidden behind the left floating card or the right panel).
          const currentView = lastAppliedViewRef.current ?? "situation";
          const padding = GLOBE_SCREEN_FRAMING[currentView];
          try {
            m.easeTo({
              center: [lng, lat],
              padding,
              duration: 850,
              easing: (t) => 1 - Math.pow(1 - t, 3),
            });
          } catch {
            /* map mid-teardown — ignore */
          }
        },
      }),
      [],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // ── WebGL probe ──────────────────────────────────────────────────────
      // MapLibre v5 removed the static .supported() helper, so check directly.
      // WebGL2 is required for globe projection; WebGL1 is enough for mercator.
      // The probe canvas is explicitly destroyed after the check so the
      // abandoned context does not sit in the GC queue during initial tile load.
      const probe = document.createElement("canvas");
      const gl2 = probe.getContext("webgl2");
      const hasWebGL2 = !!gl2;
      let hasWebGL1 = false;
      if (!hasWebGL2) {
        const gl1 = probe.getContext("webgl");
        hasWebGL1 = !!gl1;
        gl1?.getExtension("WEBGL_lose_context")?.loseContext();
      } else {
        gl2.getExtension("WEBGL_lose_context")?.loseContext();
      }
      probe.remove();
      if (!hasWebGL2 && !hasWebGL1) {
        setErrorMsg("WebGL is not available in this browser.");
        setLoadState("error");
        return;
      }

      // ── Construct map ────────────────────────────────────────────────────
      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map({
          container,
          style: USE_ECHIS_OSM_BASEMAP
            ? createEchisOsmGlobeStyle({
                landFill: LAND_FILL,
                landOverlay: LAND_OVERLAY,
                waterFill: WATER_FILL,
                waterwayFill: WATERWAY_FILL,
                borderCountry: BORDER_COUNTRY,
                labelHalo: LABEL_HALO,
              })
            : CARTO_DARK_MATTER_STYLE_URL,
          center: DEFAULT_GLOBE_VIEW.center,
          zoom: DEFAULT_GLOBE_VIEW.zoom,
          bearing: DEFAULT_GLOBE_VIEW.bearing,
          pitch: DEFAULT_GLOBE_VIEW.pitch,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 200,
          // antialias defaults to false in MapLibre v5 (canvasContextAttributes),
          // so no explicit override is needed — MSAA is already off.
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "MapLibre constructor threw.";
        setErrorMsg(msg);
        setLoadState("error");
        console.error("[MapLibreGlobe] init failed:", err);
        return;
      }
      mapRef.current = map;

      if (USE_ECHIS_OSM_BASEMAP) {
        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-left",
        );
      }

      // Disable consumer-y double-click zoom; keep wheel + drag + pinch.
      map.doubleClickZoom.disable();

      // ── Marker click + cursor handlers ──────────────────────────────────
      // Declared here (after map construction) so both handleStyleLoad
      // (which registers them) and the cleanup function (which removes them)
      // share the same references via closure.
      const cursorEnter = () => {
        try { map.getCanvas().style.cursor = "pointer"; } catch { /* noop */ }
      };
      const cursorLeave = () => {
        try { map.getCanvas().style.cursor = ""; } catch { /* noop */ }
      };
      let markerClickGlobal: ((e: LayerClickEvent) => void) | null = null;
      let markerClickSignals: ((e: LayerClickEvent) => void) | null = null;
      let markerHoverGlobal: ((e: LayerClickEvent) => void) | null = null;
      let markerHoverSignals: ((e: LayerClickEvent) => void) | null = null;
      let markerLeaveGlobal: (() => void) | null = null;
      let markerLeaveSignals: (() => void) | null = null;

      let resolved = false;
      let styleReady = false;

      const markMapUiReady = () => {
        if (resolved) return;
        resolved = true;
        setLoadState("ready");
      };

      // ── Style load → projection + dark tuning ────────────────────────────
      const handleStyleLoad = () => {
        styleReady = true;
        if (hasWebGL2) {
          try {
            map.setProjection({ type: "globe" });
          } catch (e) {
            // Stays on mercator — log the actual reason for diagnostics.
            console.warn(
              "[MapLibreGlobe] setProjection(globe) failed — using mercator:",
              e,
            );
          }
        } else {
          console.warn(
            "[MapLibreGlobe] WebGL2 unavailable — globe projection skipped, mercator only.",
          );
        }

        // Dark refinement pass — only needed for the CARTO basemap.  When the
        // OSM basemap is active the style is pre-built with the correct palette
        // by createEchisOsmGlobeStyle, so running the pass would redundantly
        // call setPaintProperty on every layer (triggering shader revalidation)
        // at exactly the moment the browser is compiling tile shaders.
        if (!USE_ECHIS_OSM_BASEMAP) applyDarkTone(map);
        // Default-view country label whitelist — keeps only continents +
        // whitelisted countries at default zoom; user zoom-in restores all.
        applyCountryLabelWhitelist(map);
        // Register the shared red pin icon before adding the symbol layers
        // that reference it; styleimagemissing acts as a safety net if the
        // image add races the layer add.
        registerPinIcons(map);
        // Marker foundation — empty sources + symbol layers for Global View
        // and SOCMINT.  Visibility/data driven by props via useEffects below.
        setupMarkerLayers(map);

        // Register click + hover handlers after the layers exist so MapLibre
        // can bind them correctly.
        markerClickGlobal = (e: LayerClickEvent) => {
          const feature = e.features?.[0];
          if (!feature?.properties) return;
          const id = String(feature.properties.id ?? "");
          if (id) onMarkerClickRef.current?.(id, "global", { x: e.point.x, y: e.point.y });
        };
        markerClickSignals = (e: LayerClickEvent) => {
          const feature = e.features?.[0];
          if (!feature?.properties) return;
          const id = String(feature.properties.id ?? "");
          if (id) onMarkerClickRef.current?.(id, "signals", { x: e.point.x, y: e.point.y });
        };
        markerHoverGlobal = (e: LayerClickEvent) => {
          cursorEnter();
          const feature = e.features?.[0];
          const id = feature?.properties ? String(feature.properties.id ?? "") : "";
          applyMarkerHover(
            map,
            "global",
            id && id !== selectedGlobalIdRef.current ? id : null,
          );
        };
        markerHoverSignals = (e: LayerClickEvent) => {
          cursorEnter();
          const feature = e.features?.[0];
          const id = feature?.properties ? String(feature.properties.id ?? "") : "";
          applyMarkerHover(
            map,
            "signals",
            id && id !== selectedSignalsIdRef.current ? id : null,
          );
        };
        markerLeaveGlobal = () => {
          cursorLeave();
          applyMarkerHover(map, "global", null);
        };
        markerLeaveSignals = () => {
          cursorLeave();
          applyMarkerHover(map, "signals", null);
        };
        map.on("click", MARKER_LAYER_GLOBAL, markerClickGlobal);
        map.on("click", MARKER_HOVER_LAYER_GLOBAL, markerClickGlobal);
        map.on("click", MARKER_SEL_GLOBAL, markerClickGlobal);
        map.on("click", MARKER_BADGE_GLOBAL, markerClickGlobal);
        map.on("click", MARKER_BADGE_TEXT_GLOBAL, markerClickGlobal);
        map.on("click", MARKER_LAYER_SIGNALS, markerClickSignals);
        map.on("click", MARKER_HOVER_LAYER_SIGNALS, markerClickSignals);
        map.on("click", MARKER_SEL_SIGNALS, markerClickSignals);
        map.on("mousemove", MARKER_LAYER_GLOBAL, markerHoverGlobal);
        map.on("mousemove", MARKER_SEL_GLOBAL, markerHoverGlobal);
        map.on("mousemove", MARKER_BADGE_GLOBAL, markerHoverGlobal);
        map.on("mousemove", MARKER_BADGE_TEXT_GLOBAL, markerHoverGlobal);
        map.on("mouseleave", MARKER_LAYER_GLOBAL, markerLeaveGlobal);
        map.on("mouseleave", MARKER_SEL_GLOBAL, markerLeaveGlobal);
        map.on("mouseleave", MARKER_BADGE_GLOBAL, markerLeaveGlobal);
        map.on("mouseleave", MARKER_BADGE_TEXT_GLOBAL, markerLeaveGlobal);
        map.on("mousemove", MARKER_LAYER_SIGNALS, markerHoverSignals);
        map.on("mousemove", MARKER_SEL_SIGNALS, markerHoverSignals);
        map.on("mouseleave", MARKER_LAYER_SIGNALS, markerLeaveSignals);
        map.on("mouseleave", MARKER_SEL_SIGNALS, markerLeaveSignals);

        // Force a resize after style commit in case the container was sized
        // during a transition / mount race.
        try {
          map.resize();
        } catch {
          /* noop */
        }

        // Some public basemap providers fully commit the style and start
        // rendering, but MapLibre's broader "load" event can lag or never
        // settle if late tiles keep streaming. Once style.load has completed,
        // the globe is usable enough for the UI to leave the blocking loading
        // state.
        if (map.isStyleLoaded()) {
          window.requestAnimationFrame(() => {
            markMapUiReady();
          });
        }
      };

      // ── Load complete → flip UI to "ready" ───────────────────────────────
      const handleLoad = () => {
        markMapUiReady();
      };

      // ── Error sink — log; only surface fatal failures to the user ────────
      const handleError = (e: { error?: { message?: string } }) => {
        const reason = e?.error?.message ?? "unknown error";
        console.warn("[MapLibreGlobe] map error:", reason);
        // If the very first style fetch fails, that's fatal — flip to error.
        if (!resolved && /style|net|fetch|load/i.test(reason)) {
          resolved = true;
          mapErrored = true;
          setErrorMsg(reason);
          setLoadState("error");
        }
      };

      map.on("style.load", handleStyleLoad);
      map.on("load", handleLoad);
      map.on("error", handleError);

      // ── Watchdog — if load never resolves, surface a visible error ──────
      const timeoutId = window.setTimeout(() => {
        if (!resolved) {
          if (styleReady || map.isStyleLoaded()) {
            markMapUiReady();
            return;
          }
          resolved = true;
          mapErrored = true;
          setErrorMsg("Map did not load within " + LOAD_TIMEOUT_MS + "ms.");
          setLoadState("error");
          console.error(
            "[MapLibreGlobe] load timeout — style or tiles did not arrive.",
          );
        }
      }, LOAD_TIMEOUT_MS);

      // ── ResizeObserver — keep canvas in sync with container dimensions ──
      const ro = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          /* noop */
        }
      });
      ro.observe(container);

      // ── Auto-rotate ──────────────────────────────────────────────────────
      // Single RAF loop steps the map's center longitude via jumpTo so the
      // globe surface drifts right-to-left like a turning planet.  Bearing
      // is held at 0 — animating bearing would spin the viewport like a
      // clock instead of moving the globe surface.
      //
      // Programmatic jumpTo calls are tagged with AUTO_ROTATE_EVENT_TAG so
      // the user-input handlers below can tell auto-rotate's own move
      // events apart from real user gestures.
      //
      // Gating: the loop only mutates the camera when
      //   mapLoaded && defaultViewApplied && !mapErrored
      //     && !userInteracting && !disposed
      // defaultViewApplied prevents the loop from drifting longitude before
      // the canonical Türkiye-centered framing has been jumpTo'd in place,
      // which is what guarantees the refresh view matches the reset view.
      let rafId = 0;
      let lastFrameTime: number | null = null;
      let resumeTimerId: number | null = null;
      let mapLoaded = false;
      let mapErrored = false;
      let userInteracting = false;
      let disposed = false;
      let defaultViewApplied = false;
      let overlayPaused = autoRotatePausedPropRef.current;

      const canRotate = () =>
        mapLoaded &&
        defaultViewApplied &&
        viewReadyRef.current &&
        !mapErrored &&
        !overlayPaused &&
        !userInteracting &&
        !disposed;

      const wrapLng = (lng: number) =>
        ((((lng + 180) % 360) + 360) % 360) - 180;

      const animate = (now: number) => {
        rafId = requestAnimationFrame(animate);
        if (!canRotate()) {
          lastFrameTime = null;
          return;
        }
        if (lastFrameTime === null) {
          lastFrameTime = now;
          return;
        }
        const dtSeconds = Math.min(
          (now - lastFrameTime) / 1000,
          AUTO_ROTATE_MAX_DT_S,
        );
        lastFrameTime = now;
        if (dtSeconds <= 0) return;
        try {
          const center = map.getCenter();
          const nextLng = wrapLng(
            center.lng + AUTO_ROTATE_DEG_PER_SEC * dtSeconds,
          );
          // Only mutate center — bearing/pitch/zoom are unchanged during
          // auto-rotate and passing them forces MapLibre to validate and
          // process all four props on every frame.
          map.jumpTo(
            { center: [nextLng, center.lat] },
            { [AUTO_ROTATE_EVENT_TAG]: true },
          );
        } catch {
          /* map mid-teardown — ignore */
        }
      };

      const clearResumeTimer = () => {
        if (resumeTimerId !== null) {
          window.clearTimeout(resumeTimerId);
          resumeTimerId = null;
        }
      };

      const scheduleResume = (delayMs: number) => {
        clearResumeTimer();
        resumeTimerId = window.setTimeout(() => {
          resumeTimerId = null;
          userInteracting = false;
          // Reset frame clock so the first post-resume frame computes a
          // small dt instead of catching up missed seconds in one jump.
          lastFrameTime = null;
        }, delayMs);
      };

      const pauseAutoRotate = (delayMs: number) => {
        userInteracting = true;
        lastFrameTime = null;
        scheduleResume(delayMs);
      };

      // Expose pause to the imperative handle (button-driven actions).
      pauseAutoRotateRef.current = pauseAutoRotate;
      setAutoRotatePausedRef.current = (paused: boolean) => {
        overlayPaused = paused;
        lastFrameTime = null;
      };
      setAutoRotatePausedRef.current(autoRotatePausedPropRef.current);

      // ── MapLibre interaction events ─────────────────────────────────────
      // dragstart / zoomstart / rotatestart / pitchstart carry originalEvent
      // only when the action originated from a user gesture.  Our own
      // programmatic jumpTo calls are tagged with AUTO_ROTATE_EVENT_TAG and
      // skipped.
      const isUserOriginated = (
        e: { originalEvent?: unknown; [key: string]: unknown } | undefined,
      ) => {
        if (!e) return false;
        if (e[AUTO_ROTATE_EVENT_TAG]) return false;
        return e.originalEvent != null;
      };

      const onMapUserStart = (
        e: { originalEvent?: unknown; [key: string]: unknown },
      ) => {
        if (!isUserOriginated(e)) return;
        pauseAutoRotate(INTERACTION_IDLE_DELAY_MS);
      };

      map.on("dragstart", onMapUserStart);
      map.on("zoomstart", onMapUserStart);
      map.on("rotatestart", onMapUserStart);
      map.on("pitchstart", onMapUserStart);
      map.on("wheel", onMapUserStart);

      // ── DOM-level safety net ────────────────────────────────────────────
      // Some pointer inputs (touchstart, raw mousedown) pause us before
      // MapLibre's higher-level *start events fire, which closes the brief
      // window where a programmatic rotateTo might still tick during a tap.
      const canvas = map.getCanvasContainer();
      const onDomUserInput = () => pauseAutoRotate(INTERACTION_IDLE_DELAY_MS);
      canvas.addEventListener("mousedown", onDomUserInput, { passive: true });
      canvas.addEventListener("pointerdown", onDomUserInput, { passive: true });
      canvas.addEventListener("touchstart", onDomUserInput, { passive: true });
      canvas.addEventListener("wheel", onDomUserInput, { passive: true });

      // Promote mapLoaded once load resolves and unlock auto-rotate gating.
      //
      // applyDefaultGlobeView is intentionally NOT called here.  The map is
      // already at DEFAULT_GLOBE_VIEW from the constructor options, and the
      // view-mode useEffect (which fires after loadState → "ready") calls
      // applyViewMode with the correct framing padding on its first run.
      // Calling jumpTo here as well would produce a duplicate positional write
      // 1-3 frames before the React effect runs, which is the root cause of
      // the visible startup stutter / camera conflict.
      //
      // canRotate() also gates on viewReadyRef.current, which is only set
      // after the view-mode effect commits the first applyViewMode call —
      // so even though the RAF loop starts here, it does not rotate until
      // the initial camera position is fully settled.
      //
      // The RAF loop is started here (after load) rather than at mount to
      // avoid wasting 60 frames/s during the tile-load window where the
      // loop would spin doing nothing.
      const onLoadInternal = () => {
        mapLoaded = true;
        defaultViewApplied = true;
        lastFrameTime = null;
        // Kick off the auto-rotate loop.  Actual rotation is gated on
        // viewReadyRef.current (set by the view-mode effect) so no frame
        // mutates the camera before the initial jumpTo is settled.
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(animate);
      };
      map.on("load", onLoadInternal);

      // ── Cleanup ──────────────────────────────────────────────────────────
      return () => {
        disposed = true;
        // Reset viewReadyRef so a future remount starts with the correct
        // initial state and the RAF gate doesn't open prematurely.
        viewReadyRef.current = false;
        window.clearTimeout(timeoutId);
        clearResumeTimer();
        cancelAnimationFrame(rafId);
        rafId = 0;
        try {
          canvas.removeEventListener("mousedown", onDomUserInput);
          canvas.removeEventListener("pointerdown", onDomUserInput);
          canvas.removeEventListener("touchstart", onDomUserInput);
          canvas.removeEventListener("wheel", onDomUserInput);
        } catch {
          /* canvas may already be detached */
        }
        pauseAutoRotateRef.current = () => {};
        setAutoRotatePausedRef.current = () => {};
        ro.disconnect();
        mapRef.current = null;
        try {
          map.off("dragstart", onMapUserStart);
          map.off("zoomstart", onMapUserStart);
          map.off("rotatestart", onMapUserStart);
          map.off("pitchstart", onMapUserStart);
          map.off("wheel", onMapUserStart);
          map.off("load", onLoadInternal);
          map.off("style.load", handleStyleLoad);
          map.off("load", handleLoad);
          map.off("error", handleError);
          if (markerClickGlobal) {
            map.off("click", MARKER_LAYER_GLOBAL, markerClickGlobal);
            map.off("click", MARKER_HOVER_LAYER_GLOBAL, markerClickGlobal);
            map.off("click", MARKER_SEL_GLOBAL, markerClickGlobal);
            map.off("click", MARKER_BADGE_GLOBAL, markerClickGlobal);
            map.off("click", MARKER_BADGE_TEXT_GLOBAL, markerClickGlobal);
          }
          if (markerClickSignals) {
            map.off("click", MARKER_LAYER_SIGNALS, markerClickSignals);
            map.off("click", MARKER_HOVER_LAYER_SIGNALS, markerClickSignals);
            map.off("click", MARKER_SEL_SIGNALS, markerClickSignals);
          }
          if (markerHoverGlobal) {
            map.off("mousemove", MARKER_LAYER_GLOBAL, markerHoverGlobal);
            map.off("mousemove", MARKER_SEL_GLOBAL, markerHoverGlobal);
            map.off("mousemove", MARKER_BADGE_GLOBAL, markerHoverGlobal);
            map.off("mousemove", MARKER_BADGE_TEXT_GLOBAL, markerHoverGlobal);
          }
          if (markerHoverSignals) {
            map.off("mousemove", MARKER_LAYER_SIGNALS, markerHoverSignals);
            map.off("mousemove", MARKER_SEL_SIGNALS, markerHoverSignals);
          }
          if (markerLeaveGlobal) {
            map.off("mouseleave", MARKER_LAYER_GLOBAL, markerLeaveGlobal);
            map.off("mouseleave", MARKER_SEL_GLOBAL, markerLeaveGlobal);
            map.off("mouseleave", MARKER_BADGE_GLOBAL, markerLeaveGlobal);
            map.off("mouseleave", MARKER_BADGE_TEXT_GLOBAL, markerLeaveGlobal);
          }
          if (markerLeaveSignals) {
            map.off("mouseleave", MARKER_LAYER_SIGNALS, markerLeaveSignals);
            map.off("mouseleave", MARKER_SEL_SIGNALS, markerLeaveSignals);
          }
          map.remove();
        } catch {
          // Defensive: removal during HMR can race with internal teardown.
        }
      };
    }, []);

    // ── View mode sync ──────────────────────────────────────────────────────
    // First application after load: silent (jumpTo), no auto-rotate pause.
    // Subsequent changes: smooth easeTo with auto-rotate paused for the
    // duration of the animation + the standard Central View idle delay.
    //
    // On first apply, viewReadyRef is set to true AFTER the jumpTo so the RAF
    // loop starts rotating only once the initial camera position is committed.
    // This prevents the startup stutter where auto-rotate would begin between
    // the map's load event and the first React effect cycle.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      const previous = lastAppliedViewRef.current;
      if (previous === activeView) {
        // Still keep marker visibility in sync in case it desynced
        setMarkerVisibility(map, "global", activeView === "global");
        setMarkerVisibility(map, "signals", activeView === "signals");
        if (activeView === "global" && globalMarkerVisibleCountRef.current > 0) {
          window.requestAnimationFrame(() => {
            onGlobalMarkerRevealStartRef.current?.();
          });
        }
        return;
      }
      const isFirstApply = previous === null;
      lastAppliedViewRef.current = activeView;
      if (isFirstApply) {
        applyViewMode(map, activeView, false);
        // Camera is now at its correct initial position — open the RAF gate.
        viewReadyRef.current = true;
        return;
      }
      pauseAutoRotateRef.current(VIEW_TRANSITION_MS + CENTRAL_VIEW_IDLE_DELAY_MS);
      applyViewMode(map, activeView, true);
      if (activeView === "global" && globalMarkerVisibleCountRef.current > 0) {
        window.requestAnimationFrame(() => {
          onGlobalMarkerRevealStartRef.current?.();
        });
      }
    }, [activeView, loadState]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready" || activeView !== "global") return;
      pauseAutoRotateRef.current(VIEW_TRANSITION_MS + CENTRAL_VIEW_IDLE_DELAY_MS);
      if (!activeRegion) {
        applyViewMode(map, "global", true);
        return;
      }
      applyFramedRegionView(map, activeRegion, GLOBE_SCREEN_FRAMING.global);
    }, [activeRegion, activeView, loadState]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready" || activeView !== "signals") return;
      pauseAutoRotateRef.current(VIEW_TRANSITION_MS + CENTRAL_VIEW_IDLE_DELAY_MS);
      if (!activeSignalsRegion) {
        applyViewMode(map, "signals", true);
        return;
      }
      applyFramedRegionView(map, activeSignalsRegion, GLOBE_SCREEN_FRAMING.signals);
    }, [activeSignalsRegion, activeView, loadState]);

    // ── Marker data sync ────────────────────────────────────────────────────
    // Push fresh feature sets into the GeoJSON sources.  Global View marker
    // writes are coalesced on a short timer so bursty RSS/API source batches
    // produce at most one setData call per window, always using the latest
    // complete marker array.  applyMarkerData is a no-op if the source isn't
    // ready yet, so race conditions during initial load are harmless.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      pendingGlobalMarkersRef.current = globalMarkers ?? [];
      if (globalMarkerDebounceTimerRef.current !== null) return;
      globalMarkerDebounceTimerRef.current = window.setTimeout(() => {
        globalMarkerDebounceTimerRef.current = null;
        const latestMap = mapRef.current;
        if (!latestMap) return;
        const latestMarkers = pendingGlobalMarkersRef.current;
        const nextSignature = markerDataSignature(latestMarkers);
        if (nextSignature === globalMarkerTargetSignatureRef.current) return;
        globalMarkerTargetSignatureRef.current = nextSignature;

        if (globalMarkerRevealFrameRef.current !== null) {
          window.cancelAnimationFrame(globalMarkerRevealFrameRef.current);
          globalMarkerRevealFrameRef.current = null;
        }

        const previousRenderedIds = globalMarkerRenderedIdsRef.current;
        const hasEntering =
          latestMarkers.length > 0 &&
          (previousRenderedIds.size === 0 ||
            latestMarkers.some((marker) => !previousRenderedIds.has(marker.id)));

        globalMarkerVisibleCountRef.current = latestMarkers.length;
        applyMarkerData(latestMap, "global", latestMarkers);
        applyMarkerSelection(latestMap, "global", selectedGlobalIdRef.current);
        globalMarkerRenderedIdsRef.current = new Set(
          latestMarkers.map((marker) => marker.id),
        );

        // Count-only updates must not replay a full-layer reveal; keep the
        // marker layer visible while the GeoJSON badge data refreshes.
        setGlobalMarkerLayerOpacity(latestMap, 1, 0);
        if (hasEntering) {
          globalMarkerRevealFrameRef.current = window.requestAnimationFrame(() => {
            globalMarkerRevealFrameRef.current = null;
            onGlobalMarkerRevealStartRef.current?.();
          });
        }
      }, MARKER_DATA_DEBOUNCE_MS);
    }, [globalMarkers, loadState]);

    useEffect(() => {
      return () => {
        if (globalMarkerDebounceTimerRef.current !== null) {
          window.clearTimeout(globalMarkerDebounceTimerRef.current);
          globalMarkerDebounceTimerRef.current = null;
        }
        if (globalMarkerRevealFrameRef.current !== null) {
          window.cancelAnimationFrame(globalMarkerRevealFrameRef.current);
          globalMarkerRevealFrameRef.current = null;
        }
        pendingGlobalMarkersRef.current = [];
        globalMarkerRenderedIdsRef.current = new Set();
        globalMarkerTargetSignatureRef.current = "";
        signalsMarkerTargetSignatureRef.current = "";
        globalMarkerVisibleCountRef.current = 0;
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      const latestMarkers = signalsMarkers ?? [];
      const nextSignature = markerDataSignature(latestMarkers);
      if (nextSignature === signalsMarkerTargetSignatureRef.current) return;
      signalsMarkerTargetSignatureRef.current = nextSignature;
      applyMarkerData(map, "signals", latestMarkers);
    }, [signalsMarkers, loadState]);

    // ── Selected-marker highlight sync ──────────────────────────────────────
    // When the parent sets a selected event / report (either from a panel
    // click or from a marker click routed back), update the icon-size and
    // glow circle-opacity on the relevant layer via data-driven expressions.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      applyMarkerSelection(map, "global", selectedGlobalId);
    }, [selectedGlobalId, loadState]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      applyMarkerSelection(map, "signals", selectedSignalsId);
    }, [selectedSignalsId, loadState]);

    // -----------------------------------------------------------------------
    // Render — inline styles only (no Tailwind classes) to guarantee CSS is
    // applied identically in dev/build regardless of Tailwind purge edge
    // cases.  Both wrappers and the ref'd container are absolutely positioned
    // with explicit inset so MapLibre gets non-zero clientWidth/clientHeight
    // at construction time.
    // -----------------------------------------------------------------------
    return (
      <div
        aria-label="Globe view"
        style={{
          position: "absolute",
          inset: 0,
          background: PANEL_BG,
          overflow: "hidden",
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            background: PANEL_BG,
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 42% 25%, rgba(244,112,102,0.13) 0%, rgba(112,7,16,0.08) 22%, transparent 48%), " +
              "radial-gradient(ellipse at 58% 68%, rgba(255,255,255,0.035) 0%, transparent 36%), " +
              "linear-gradient(135deg, rgba(255,255,255,0.045) 0%, transparent 18%, rgba(0,0,0,0.16) 72%, rgba(0,0,0,0.42) 100%)",
            mixBlendMode: "screen",
            opacity: 0.72,
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 46%, transparent 0%, transparent 48%, rgba(3,2,3,0.34) 76%, rgba(3,2,3,0.72) 100%)",
          }}
        />

        {loadState === "loading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7a90",
              fontSize: 13,
              letterSpacing: 0.4,
              background: PANEL_BG,
              pointerEvents: "none",
            }}
          >
            Loading MapLibre globe…
          </div>
        )}

        {loadState === "error" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              color: "#8a939c",
              fontSize: 13,
              background: PANEL_BG,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div>MapLibre globe failed to load</div>
            {errorMsg && (
              <div style={{ color: "#4e5762", fontSize: 11 }}>{errorMsg}</div>
            )}
          </div>
        )}
      </div>
    );
  },
);
