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
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-10m.json";
import {
  createEchisOsmGlobeStyle,
  OSM_VECTOR_SOURCE_ID,
  USE_ECHIS_OSM_BASEMAP,
} from "@/components/map/styles/echisOsmGlobeStyle";
import { GlobeLoadingAnimation } from "@/components/map/GlobeLoadingAnimation";
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
  globalMarkersLoading?: boolean;
  onReady?: () => void;
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
const GLOBAL_MARKER_INTERACTION_LAYERS = [
  MARKER_LAYER_GLOBAL,
  MARKER_HOVER_LAYER_GLOBAL,
  MARKER_SEL_GLOBAL,
  MARKER_BADGE_GLOBAL,
  MARKER_BADGE_TEXT_GLOBAL,
] as const;
const SIGNALS_MARKER_INTERACTION_LAYERS = [
  MARKER_LAYER_SIGNALS,
  MARKER_HOVER_LAYER_SIGNALS,
  MARKER_SEL_SIGNALS,
] as const;
const ALL_MARKER_INTERACTION_LAYERS = [
  ...GLOBAL_MARKER_INTERACTION_LAYERS,
  ...SIGNALS_MARKER_INTERACTION_LAYERS,
] as const;
const GLOBAL_MARKER_INTERACTION_LAYER_SET = new Set<string>(
  GLOBAL_MARKER_INTERACTION_LAYERS,
);
let didWarnMarkerQueryFailure = false;

function queryMarkerAtPoint(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
): { feature: maplibregl.MapGeoJSONFeature; kind: MarkerKind } | null {
  const layers = ALL_MARKER_INTERACTION_LAYERS.filter((layerId) =>
    map.getLayer(layerId),
  );
  if (layers.length === 0) return null;

  try {
    const feature = map
      .queryRenderedFeatures(point, { layers: [...layers] })
      .find((candidate) => candidate.properties?.id);
    if (!feature) return null;

    return {
      feature,
      kind: GLOBAL_MARKER_INTERACTION_LAYER_SET.has(feature.layer.id)
        ? "global"
        : "signals",
    };
  } catch (error) {
    // MapLibre 5.24 can briefly retain a feature-grid entry for an empty
    // OpenFreeMap vector tile while sources/styles are being refreshed. Its
    // delegated layer events let the resulting DictionaryCoder bounds error
    // escape globally. Keep marker interaction best-effort until the next
    // pointer event instead of taking down the Next.js development overlay.
    if (!didWarnMarkerQueryFailure) {
      didWarnMarkerQueryFailure = true;
      console.warn("[MapLibreGlobe] marker hit-test skipped:", error);
    }
    return null;
  }
}

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

// Silver marker accent tokens (design_handoff_silver_map_marker).  Used only by
// the marker glow / selection / badge layers — the silver redesign exists to
// break the pins out of the red basemap, so their highlight halo is silver, not
// red.
const SILVER_RING = "#BABDC5"; // inner disc ring + count-badge ring (muted gunmetal, less glare)
const SILVER_HALO = "rgba(200,204,214,0.34)"; // selection bloom — toned down so it doesn't shout
const SILVER_GLOW = "rgba(198,202,212,0.3)"; // selection / hover ring glow

const selectedMarkerOpacityExpression = (
  selectedId: string,
  baseOpacity: number,
): maplibregl.ExpressionSpecification =>
  ["match", ["get", "id"], selectedId, baseOpacity, 0] as maplibregl.ExpressionSpecification;

// ---------------------------------------------------------------------------
// Silver location-pin icon — metallic silver-to-charcoal teardrop with a dark
// inner badge disc (design_handoff_silver_map_marker).  Shared by the Global
// View and SOCMINT marker symbol layers.  Silver was chosen to break the pins
// out of the dark/red basemap, where the previous all-red pins blended in and
// read as "alarm".
//
// Geometry is the handoff canonical: viewBox 0 0 36 46, teardrop path and the
// 6-stop vertical body gradient verbatim.  The width/height below uniformly
// scale that 36:46 viewBox (never stretched) to the previous on-screen
// footprint, so the glow / badge translate offsets stay as tuned.  Per-pin
// pixelRatio + icon-size then set the final size. icon-anchor: "bottom" keeps
// the tip on the geographic coordinate during zoom / drag / auto-rotate.
//
// Two ring variants per the handoff state table: default (#E6E7EC, 0.9 px) and
// active/selected (#FFFFFF, 1.2 px).
// ---------------------------------------------------------------------------
// Muted gunmetal variant of the handoff body gradient — the original silver was
// too bright against the dark basemap; darker highlight + cooler mids keep the
// pin legible without glaring ("çok göze batmasın").
const SILVER_PIN_BODY_STOPS =
  '<stop offset="0%" stop-color="#C0C3CA"/>' +
  '<stop offset="22%" stop-color="#92959E"/>' +
  '<stop offset="42%" stop-color="#565962"/>' +
  '<stop offset="62%" stop-color="#2F3036"/>' +
  '<stop offset="82%" stop-color="#1A191F"/>' +
  '<stop offset="100%" stop-color="#0A090D"/>';

const buildSilverPinSvg = (ringColor: string, ringWidth: number): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="34.5" viewBox="0 0 36 46" fill="none">' +
  "<defs>" +
  '<linearGradient id="markerBody" x1="0" y1="0" x2="0" y2="1">' +
  SILVER_PIN_BODY_STOPS +
  "</linearGradient>" +
  "</defs>" +
  '<path d="M18 1C9 1 2 8 2 17c0 11 16 28 16 28s16-17 16-28C34 8 27 1 18 1z" ' +
  'fill="url(#markerBody)" stroke="rgba(255,255,255,0.18)" stroke-width="0.4"/>' +
  `<circle cx="18" cy="17" r="9.5" fill="rgba(20,16,22,0.92)" stroke="${ringColor}" stroke-width="${ringWidth}"/>` +
  "</svg>";

const PIN_ICON_ID = "echis-marker-pin";
const PIN_SEL_ICON_ID = "echis-marker-pin-selected";
const PIN_ICON_PIXEL_RATIO = 2;
const PIN_ICON_SIZE_DEFAULT = 0.85;
const PIN_ICON_SIZE_SELECTED = 1.24;
const PIN_SVG = buildSilverPinSvg(SILVER_RING, 0.9);
const PIN_SELECTED_SVG = buildSilverPinSvg("#FFFFFF", 1.2);

const GLOBAL_PIN_ICON_ID = "echis-marker-pin-premium";
const GLOBAL_PIN_SEL_ICON_ID = "echis-marker-pin-premium-selected";
const GLOBAL_PIN_ICON_PIXEL_RATIO = 1;
const GLOBAL_PIN_ICON_SIZE_DEFAULT = 0.68;
const GLOBAL_PIN_ICON_SIZE_HOVER = 0.73;
const GLOBAL_PIN_ICON_SIZE_SELECTED = 0.8;
const GLOBAL_PIN_SVG = buildSilverPinSvg(SILVER_RING, 0.9);
const GLOBAL_PIN_SELECTED_SVG = buildSilverPinSvg("#FFFFFF", 1.2);

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
  registerSvgIcon(map, PIN_SEL_ICON_ID, PIN_SELECTED_SVG, PIN_ICON_PIXEL_RATIO);
  registerSvgIcon(
    map,
    GLOBAL_PIN_ICON_ID,
    GLOBAL_PIN_SVG,
    GLOBAL_PIN_ICON_PIXEL_RATIO,
  );
  registerSvgIcon(
    map,
    GLOBAL_PIN_SEL_ICON_ID,
    GLOBAL_PIN_SELECTED_SVG,
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

// Deepest zoom-in the globe allows. Capped at ~city-boundary level so the
// globe stays a strategic/overview surface — the user can zoom to a city's
// extent but not into street/building clutter (that detail lives in Intel
// Watch). Layers that would only appear past this never render, which also
// keeps the globe visually clean.
const GLOBE_MAX_ZOOM = 9.5;

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
          "circle-color": SILVER_HALO,
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
          "circle-color": SILVER_GLOW,
          "circle-blur": isGlobal ? 0.34 : 0.15,
          "circle-opacity": 0,
          "circle-stroke-width": isGlobal ? 1.2 : 2.5,
          "circle-stroke-color": SILVER_RING,
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
          "circle-color": SILVER_HALO,
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
          "circle-stroke-color": SILVER_RING,
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
    const selIconId = isGlobal ? GLOBAL_PIN_SEL_ICON_ID : PIN_SEL_ICON_ID;
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
          "icon-image": selIconId,
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
const FOCUS_MARKER_ANIM_MS = 1500;

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
// ---------------------------------------------------------------------------
// MapLibre's accepted appearance is the premium Luxe-inspired style: glowing
// red coastlines, silver detail, deep obsidian space, and an atmosphere halo.
// It is intentionally unconditional; the renderer switch in AppShell chooses
// between Luxe (Three.js) and MapLibre, not between two MapLibre themes.
// --- Premium MapLibre palette ----------------------------------------------
// Deep obsidian space behind the globe, near-black land, silver-grey borders,
// and the bright/dark red coastline endpoints from the reference.
const LUXE_PANEL_BG = "#0B0C0E";
const LUXE_LAND_FILL = "#050506";
const LUXE_LAND_OVERLAY = "#0d0e10";
const LUXE_WATER_FILL = "#040405";
const LUXE_WATERWAY_FILL = "rgba(120, 130, 146, 0.30)";
const LUXE_BORDER_COUNTRY = "rgba(255, 43, 61, 0.78)";
// Intra-country (state/province) borders. Kept clearly visible but still
// subordinate to the solid national border — dashed crimson at a higher
// alpha so provinces read on the dark globe.
const LUXE_BORDER_ADMIN = "rgba(255, 43, 61, 0.52)";

// Luxe outline source/layer — each country's polygon rings are converted into
// independent line pieces. This avoids a topology mesh that "walks" around the
// world as one continuous pen path and then visually connects unrelated ends.
const LUXE_OUTLINE_SOURCE = "echis-luxe-outline";
const LUXE_OUTLINE_LAYER = "echis-luxe-outline";
const LUXE_ANTIMERIDIAN_JUMP_DEG = 180;
const LUXE_POLAR_ARTIFACT_LAT = 88;
const LUXE_MAX_EDGE_DEG = 0.75;

let luxeOutlineGeoJsonCache: GeoJSON.FeatureCollection | null = null;

function isAntimeridianClosure(
  previous: GeoJSON.Position,
  current: GeoJSON.Position,
): boolean {
  return Math.abs(previous[0] - current[0]) >= LUXE_ANTIMERIDIAN_JUMP_DEG;
}

function isPolarArtifactLine(line: GeoJSON.Position[]): boolean {
  return (
    line.length > 3 &&
    line.every((coordinate) => Math.abs(coordinate[1]) >= LUXE_POLAR_ARTIFACT_LAT)
  );
}

function isDrawableOutlineEdge(
  previous: GeoJSON.Position,
  current: GeoJSON.Position,
): boolean {
  if (isAntimeridianClosure(previous, current)) return false;
  const deltaLng = Math.abs(previous[0] - current[0]);
  const deltaLat = Math.abs(previous[1] - current[1]);
  return Math.hypot(deltaLng, deltaLat) <= LUXE_MAX_EDGE_DEG;
}

function appendLineAsOutlineSegments(
  line: GeoJSON.Position[],
  lines: GeoJSON.Position[][],
): void {
  if (isPolarArtifactLine(line)) return;

  for (let index = 1; index < line.length; index += 1) {
    const previous = line[index - 1];
    const current = line[index];
    if (!previous || !current) continue;
    if (isDrawableOutlineEdge(previous, current)) lines.push([previous, current]);
  }
}

function appendGeometryAsOutlineSegments(
  geometry: GeoJSON.Geometry | null,
  lines: GeoJSON.Position[][],
): void {
  if (!geometry) return;

  if (geometry.type === "LineString") {
    appendLineAsOutlineSegments(geometry.coordinates, lines);
    return;
  }

  if (geometry.type === "MultiLineString") {
    geometry.coordinates.forEach((line) => appendLineAsOutlineSegments(line, lines));
    return;
  }

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => appendLineAsOutlineSegments(ring, lines));
    return;
  }

  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => appendLineAsOutlineSegments(ring, lines));
    });
    return;
  }

  if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach((child) => appendGeometryAsOutlineSegments(child, lines));
  }
}

function buildLuxeOutlineGeoJson(): GeoJSON.FeatureCollection {
  const topology = countriesAtlas as unknown as TopoJSON.Topology;
  const countriesGeoJson = feature(
    topology,
    topology.objects.countries as TopoJSON.GeometryCollection,
  ) as GeoJSON.FeatureCollection;
  const lines: GeoJSON.Position[][] = [];

  countriesGeoJson.features.forEach((country) => {
    appendGeometryAsOutlineSegments(country.geometry, lines);
  });

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "outline" },
        geometry: { type: "MultiLineString", coordinates: lines },
      },
    ],
  };
}

function getLuxeOutlineGeoJson(): GeoJSON.FeatureCollection {
  if (luxeOutlineGeoJsonCache) {
    return luxeOutlineGeoJsonCache;
  }
  luxeOutlineGeoJsonCache = buildLuxeOutlineGeoJson();
  return luxeOutlineGeoJsonCache;
}

function setupLuxeOutline(map: maplibregl.Map): void {
  try {
    if (!map.getSource(LUXE_OUTLINE_SOURCE)) {
      map.addSource(LUXE_OUTLINE_SOURCE, {
        type: "geojson",
        data: getLuxeOutlineGeoJson(),
        maxzoom: 6,
        tolerance: 0,
      });
    }
    const beforeId = [
      "water_name",
      "place_country_label",
      "place_region_label",
    ].find((id) => map.getLayer(id));
    if (!map.getLayer(LUXE_OUTLINE_LAYER)) {
      map.addLayer(
        {
          id: LUXE_OUTLINE_LAYER,
          type: "line",
          source: LUXE_OUTLINE_SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": LUXE_BORDER_COUNTRY,
            "line-width": 0.62,
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 6, 0.95],
          },
        } as unknown as maplibregl.LayerSpecification,
        beforeId,
      );
    }
  } catch (e) {
    console.warn("[MapLibreGlobe] luxe outline setup failed:", e);
  }
}

const ACTIVE_PANEL_BG = LUXE_PANEL_BG;
// These aliases keep the CARTO diagnostic fallback on the same accepted
// premium palette instead of silently reverting MapLibre to the legacy look.
const LAND_FILL = LUXE_LAND_FILL;
const LAND_OVERLAY = LUXE_LAND_OVERLAY;
const WATER_FILL = LUXE_WATER_FILL;
const WATERWAY_FILL = LUXE_WATERWAY_FILL;
const BORDER_COUNTRY = LUXE_BORDER_COUNTRY;
const BORDER_ADMIN = LUXE_BORDER_ADMIN;

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
const MAPLIBRE_LOADING_ANIMATION_ENABLED = true;

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
      globalMarkersLoading = false,
      onReady,
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
    const globalMarkerSyncPendingRef = useRef(
      markerDataSignature(globalMarkers ?? []) !== "",
    );
    const globalMarkersLoadingRef = useRef(globalMarkersLoading);
    const activeViewRef = useRef(activeView);
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

    const onReadyRef = useRef(onReady);
    useEffect(() => {
      onReadyRef.current = onReady;
    }, [onReady]);

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

    useEffect(() => {
      activeViewRef.current = activeView;
    }, [activeView]);

    useEffect(() => {
      globalMarkersLoadingRef.current = globalMarkersLoading;
      globalMarkerSyncPendingRef.current =
        markerDataSignature(globalMarkers ?? []) !==
        globalMarkerTargetSignatureRef.current;
    }, [globalMarkers, globalMarkersLoading]);

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
              duration: FOCUS_MARKER_ANIM_MS,
              easing: easeInOutCubic,
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
            ? createEchisOsmGlobeStyle(
                {
                  landFill: LUXE_LAND_FILL,
                  landOverlay: LUXE_LAND_OVERLAY,
                  waterFill: LUXE_WATER_FILL,
                  waterwayFill: LUXE_WATERWAY_FILL,
                  borderCountry: LUXE_BORDER_COUNTRY,
                  borderAdmin: LUXE_BORDER_ADMIN,
                  showBoundaries: false,
                  // National border comes from the luxe outline; turn the OSM
                  // sub-national (state/province) admin lines back on so
                  // intra-country borders are visible on the globe.
                  showAdminBoundaries: true,
                  labelHalo: LABEL_HALO,
                },
              )
            : CARTO_DARK_MATTER_STYLE_URL,
          center: DEFAULT_GLOBE_VIEW.center,
          zoom: DEFAULT_GLOBE_VIEW.zoom,
          bearing: DEFAULT_GLOBE_VIEW.bearing,
          pitch: DEFAULT_GLOBE_VIEW.pitch,
          maxZoom: GLOBE_MAX_ZOOM,
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
      // Use non-delegated map events and one guarded hit-test. MapLibre's
      // layer-bound event overload performs its own unguarded feature query
      // before calling our listener, so a transient empty vector tile can
      // otherwise surface as a global DictionaryCoder runtime error.
      const cursorEnter = () => {
        try { map.getCanvas().style.cursor = "pointer"; } catch { /* noop */ }
      };
      const cursorLeave = () => {
        try { map.getCanvas().style.cursor = ""; } catch { /* noop */ }
      };
      const clearMarkerHover = () => {
        cursorLeave();
        applyMarkerHover(map, "global", null);
        applyMarkerHover(map, "signals", null);
      };
      const markerClick = (e: maplibregl.MapMouseEvent) => {
        const hit = queryMarkerAtPoint(map, e.point);
        if (!hit?.feature.properties) return;
        const id = String(hit.feature.properties.id ?? "");
        if (id) {
          onMarkerClickRef.current?.(id, hit.kind, {
            x: e.point.x,
            y: e.point.y,
          });
        }
      };
      const markerMouseMove = (e: maplibregl.MapMouseEvent) => {
        const hit = queryMarkerAtPoint(map, e.point);
        if (!hit?.feature.properties) {
          clearMarkerHover();
          return;
        }

        cursorEnter();
        const id = String(hit.feature.properties.id ?? "");
        const selectedId =
          hit.kind === "global"
            ? selectedGlobalIdRef.current
            : selectedSignalsIdRef.current;
        applyMarkerHover(map, hit.kind, id && id !== selectedId ? id : null);
        applyMarkerHover(
          map,
          hit.kind === "global" ? "signals" : "global",
          null,
        );
      };
      const markerMouseOut = () => {
        clearMarkerHover();
      };
      map.on("click", markerClick);
      map.on("mousemove", markerMouseMove);
      map.on("mouseout", markerMouseOut);

      let resolved = false;
      let styleReady = false;

      const markMapUiReady = () => {
        if (resolved) return;
        resolved = true;
        setLoadState("ready");
        onReadyRef.current?.();
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

        // Premium atmosphere halo — a faint reddish glow at the globe's edge
        // over obsidian space. Wrapped defensively for older MapLibre builds.
        try {
          (map as unknown as {
            setSky?: (sky: Record<string, unknown>) => void;
          }).setSky?.({
            "sky-color": "#0B0C0E",
            "sky-horizon-blend": 0.6,
            "horizon-color": "#2a0a0d",
            "horizon-fog-blend": 0.7,
            "fog-color": "#1a0608",
            "fog-ground-blend": 0.85,
            "atmosphere-blend": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              0.7,
              4,
              0.45,
              6,
              0,
            ],
          });
        } catch (e) {
          console.warn("[MapLibreGlobe] setSky unsupported — skipping halo:", e);
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
        setupLuxeOutline(map);
        // Register the shared pin icons before adding the symbol layers that
        // reference them; styleimagemissing is a safety net for image races.
        registerPinIcons(map);
        // Marker foundation — empty sources + symbol layers for Global View
        // and SOCMINT.  Visibility/data driven by props via useEffects below.
        setupMarkerLayers(map);

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
        !(
          activeViewRef.current === "global" &&
          (globalMarkersLoadingRef.current ||
            globalMarkerSyncPendingRef.current)
        ) &&
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
          map.off("click", markerClick);
          map.off("mousemove", markerMouseMove);
          map.off("mouseout", markerMouseOut);
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
        if (nextSignature === globalMarkerTargetSignatureRef.current) {
          globalMarkerSyncPendingRef.current = false;
          return;
        }
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
        globalMarkerSyncPendingRef.current = false;
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
        globalMarkerSyncPendingRef.current = false;
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
          background: ACTIVE_PANEL_BG,
          overflow: "hidden",
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            background: ACTIVE_PANEL_BG,
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            // Camera-fixed atmosphere / key-light. Reworked from two competing
            // bright blobs (a salmon spot + a separate white spot) into a single
            // coherent soft key light: a warm-neutral core that reads as light
            // (not red paint), feathered far out so there is no hard circular
            // edge, plus a whisper of cool ambient bounce to round the sphere
            // without reading as a second highlight. Restrained and premium.
            background:
              "radial-gradient(78% 72% at 36% 24%, rgba(255,240,235,0.085) 0%, rgba(240,122,112,0.05) 32%, rgba(120,12,20,0.02) 58%, transparent 80%), " +
              "radial-gradient(95% 88% at 66% 74%, rgba(176,196,224,0.022) 0%, transparent 66%), " +
              "linear-gradient(132deg, rgba(255,255,255,0.03) 0%, transparent 26%, rgba(0,0,0,0.13) 74%, rgba(0,0,0,0.32) 100%)",
            mixBlendMode: "screen",
            opacity: 0.62,
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 46%, transparent 0%, transparent 44%, rgba(11,12,14,0.45) 72%, rgba(11,12,14,0.92) 100%)",
          }}
        />

        {MAPLIBRE_LOADING_ANIMATION_ENABLED && (
          <GlobeLoadingAnimation visible={loadState === "loading"} />
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
              background: ACTIVE_PANEL_BG,
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
