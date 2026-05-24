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

// ---------------------------------------------------------------------------
// Public handle — imperative API consumed by MapControls.
// Mirrors the API the previous Three.js GlobeMap exposed so the rest of the
// UI keeps working without changes.
// ---------------------------------------------------------------------------
export interface MapLibreGlobeHandle {
  centerView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
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
};

interface MapLibreGlobeProps {
  activeView?: GlobeViewMode;
  globalMarkers?: MarkerFeature[];
  signalsMarkers?: MarkerFeature[];
}

const MARKER_SOURCE_GLOBAL = "taipan-markers-global";
const MARKER_SOURCE_SIGNALS = "taipan-markers-signals";
const MARKER_LAYER_GLOBAL = "taipan-markers-global-layer";
const MARKER_LAYER_SIGNALS = "taipan-markers-signals-layer";

// ---------------------------------------------------------------------------
// Style source — CARTO dark-matter (public, no token).
//
// Chosen for OSIRIS-adjacent dark cartography quality: crisp muted labels,
// thin neutral borders, near-black water/land contrast.  Suitable for a PoC.
// Production should replace with first-party tile hosting or a contracted
// provider before shipping.
// ---------------------------------------------------------------------------
const STYLE_URL =
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
  signals: { top: 16, bottom: 16, left: 220, right: 400 },
};

const VIEW_TRANSITION_MS = 1400;

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

function setMarkerVisibility(
  map: maplibregl.Map,
  kind: MarkerKind,
  visible: boolean,
): void {
  const layerId = kind === "global" ? MARKER_LAYER_GLOBAL : MARKER_LAYER_SIGNALS;
  try {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        visible ? "visible" : "none",
      );
    }
  } catch {
    /* layer not yet added — skip */
  }
}

// Idempotent setup — adds the empty marker sources + circle layers once.
// Called after style.load so the layers sit above the dark-tone style.
function setupMarkerLayers(map: maplibregl.Map): void {
  const emptyFC: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  try {
    if (!map.getSource(MARKER_SOURCE_GLOBAL)) {
      map.addSource(MARKER_SOURCE_GLOBAL, { type: "geojson", data: emptyFC });
    }
    if (!map.getLayer(MARKER_LAYER_GLOBAL)) {
      map.addLayer({
        id: MARKER_LAYER_GLOBAL,
        type: "circle",
        source: MARKER_SOURCE_GLOBAL,
        layout: { visibility: "none" },
        paint: {
          // Small, clamped — premium feel, no inflation on zoom.
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            3,
            4,
            4.5,
            8,
            6,
          ],
          "circle-color": [
            "match",
            ["coalesce", ["get", "severity"], "low"],
            "critical",
            "#dc2626",
            "high",
            "#ea580c",
            "medium",
            "#ca8a04",
            "#9ca3af",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255, 255, 255, 0.22)",
          "circle-opacity": 0.9,
          "circle-stroke-opacity": 0.6,
        },
      });
    }

    if (!map.getSource(MARKER_SOURCE_SIGNALS)) {
      map.addSource(MARKER_SOURCE_SIGNALS, { type: "geojson", data: emptyFC });
    }
    if (!map.getLayer(MARKER_LAYER_SIGNALS)) {
      map.addLayer({
        id: MARKER_LAYER_SIGNALS,
        type: "circle",
        source: MARKER_SOURCE_SIGNALS,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            3,
            4,
            4,
            8,
            5.5,
          ],
          "circle-color": [
            "match",
            ["coalesce", ["get", "confidence"], "low"],
            "high",
            "#22d3ee",
            "medium",
            "#a3a3a3",
            "#64748b",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255, 255, 255, 0.22)",
          "circle-opacity": 0.85,
          "circle-stroke-opacity": 0.55,
        },
      });
    }
  } catch (e) {
    console.warn("[MapLibreGlobe] marker layer setup failed:", e);
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
    features: features.map((f) => ({
      type: "Feature",
      id: f.id,
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: {
        id: f.id,
        severity: f.severity ?? null,
        confidence: f.confidence ?? null,
      },
    })),
  };
  try {
    (source as maplibregl.GeoJSONSource).setData(fc);
  } catch {
    /* mid-teardown — ignore */
  }
}

// Time after which a still-loading map is treated as failed.  Prevents the
// loading placeholder from sitting forever if the style/tiles never arrive.
const LOAD_TIMEOUT_MS = 9000;

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
const CENTRAL_VIEW_IDLE_DELAY_MS = 5_000;
const INTERACTION_IDLE_DELAY_MS = 15_000;
// Duration of the Central View easeTo (kept in sync with applyDefaultGlobeView).
const CENTRAL_VIEW_ANIM_MS = 1200;
// Cap on per-frame delta so a tab-throttle or long task can't make the
// globe leap forward; ~50ms ≈ one slow frame's worth.
const AUTO_ROTATE_MAX_DT_S = 0.05;
// eventData marker placed on every programmatic jumpTo so MapLibre move
// events triggered by auto-rotate can be distinguished from real user input.
const AUTO_ROTATE_EVENT_TAG = "taipanAutoRotate";

// ---------------------------------------------------------------------------
// Dark colour palette — tuned to integrate with the TaipanMonitor panel.
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
const PANEL_BG = "#030506";
const LAND_FILL = "#141817";
const LAND_OVERLAY = "#181C1A";
const WATER_FILL = "#070A0B";
const WATERWAY_FILL = "#0a0e10";

const BORDER_COUNTRY = "rgba(120, 132, 128, 0.34)";
const BORDER_ADMIN = "rgba(120, 132, 128, 0.22)";

const LABEL_MAJOR = "rgba(190, 198, 194, 0.72)";
const LABEL_MINOR = "rgba(150, 160, 156, 0.48)";
const LABEL_WATER = "rgba(120, 132, 138, 0.55)";
const LABEL_HALO = "rgba(5, 7, 8, 0.85)";

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
const WHITELIST_LAYER_ID = "taipan-country-whitelist";

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
  // globally-significant countries at low zoom.  Reuses CARTO's vector
  // source so the data is guaranteed to be present.  Auto-cleaned by
  // its own maxzoom once the native layers fade in.
  if (
    countrySource &&
    countrySourceLayer &&
    !map.getLayer(WHITELIST_LAYER_ID)
  ) {
    const fontProp = (countryFont as string[] | undefined) ?? [
      "Open Sans Regular",
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
            ["coalesce", ["get", "name:en"], ""],
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
            ["get", "name:en"],
            ["get", "name:latin"],
            ["get", "name_en"],
            ["get", "name"],
            "",
          ],
          "text-font": fontProp,
          "text-size": 12,
          "text-letter-spacing": 0.1,
          "text-transform": "uppercase",
          "text-padding": 4,
        },
        paint: {
          "text-color": LABEL_MAJOR,
          "text-halo-color": LABEL_HALO,
          "text-halo-width": 1.2,
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
    { activeView = "situation", globalMarkers, signalsMarkers },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    // Imperative pause-rotate hook — wired by the useEffect below and called
    // from the imperative handle (button-driven zoom/center) and from real
    // user input listeners on the canvas.  Accepts the idle delay (ms) so
    // Central View can use a shorter resume window than raw user input.
    const pauseAutoRotateRef = useRef<(delayMs: number) => void>(() => {});

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Tracks the last view actually applied to the map so we can tell
    // first-application (jumpTo, no auto-rotate pause) from a real user
    // navigation between views (easeTo + pause).
    const lastAppliedViewRef = useRef<GlobeViewMode | null>(null);

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
      }),
      [],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // ── WebGL probe ──────────────────────────────────────────────────────
      // MapLibre v5 removed the static .supported() helper, so check directly.
      // WebGL2 is required for globe projection; WebGL1 is enough for mercator.
      const probe = document.createElement("canvas");
      const hasWebGL2 = !!probe.getContext("webgl2");
      const hasWebGL1 = !!probe.getContext("webgl");
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
          style: STYLE_URL,
          center: DEFAULT_GLOBE_VIEW.center,
          zoom: DEFAULT_GLOBE_VIEW.zoom,
          bearing: DEFAULT_GLOBE_VIEW.bearing,
          pitch: DEFAULT_GLOBE_VIEW.pitch,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 200,
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

      // Disable consumer-y double-click zoom; keep wheel + drag + pinch.
      map.doubleClickZoom.disable();

      let resolved = false;

      // ── Style load → projection + dark tuning ────────────────────────────
      const handleStyleLoad = () => {
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

        // Dark refinement pass — walk every layer in the loaded style and
        // route it through the tuning categoriser.  Robust across style
        // versions: missing/renamed layers are silently skipped.
        applyDarkTone(map);
        // Default-view country label whitelist — keeps only continents +
        // whitelisted countries at default zoom; user zoom-in restores all.
        applyCountryLabelWhitelist(map);
        // Marker foundation — empty sources + circle layers for Global View
        // and SOCMINT.  Visibility/data driven by props via useEffects below.
        setupMarkerLayers(map);

        // Force a resize after style commit in case the container was sized
        // during a transition / mount race.
        try {
          map.resize();
        } catch {
          /* noop */
        }
      };

      // ── Load complete → flip UI to "ready" ───────────────────────────────
      const handleLoad = () => {
        resolved = true;
        setLoadState("ready");
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
      //     && !userInteracting && !disposed && !document.hidden
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

      const canRotate = () =>
        mapLoaded &&
        defaultViewApplied &&
        !mapErrored &&
        !userInteracting &&
        !disposed &&
        !document.hidden;

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
          map.jumpTo(
            {
              center: [nextLng, center.lat],
              bearing: 0,
              pitch: map.getPitch(),
              zoom: map.getZoom(),
            },
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

      // ── MapLibre interaction events ─────────────────────────────────────
      // dragstart / zoomstart / rotatestart / pitchstart carry originalEvent
      // only when the action originated from a user gesture.  Our own
      // rotateTo calls are tagged with AUTO_ROTATE_EVENT_TAG and skipped.
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

      // ── visibilitychange ────────────────────────────────────────────────
      // Hidden: loop self-gates via document.hidden.  Visible: route through
      // the interaction idle-delay path so we don't jump on return.
      const onVisibility = () => {
        if (document.hidden) {
          lastFrameTime = null;
        } else {
          pauseAutoRotate(INTERACTION_IDLE_DELAY_MS);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      // Promote mapLoaded once load resolves, apply the canonical default
      // framing with jumpTo (so refresh view == reset view), then unlock
      // auto-rotate via defaultViewApplied.  Order matters: auto-rotate
      // must not run before applyDefaultGlobeView, otherwise it could
      // drift the longitude before the canonical frame is in place.
      const onLoadInternal = () => {
        mapLoaded = true;
        try {
          applyDefaultGlobeView(map, false);
        } catch {
          /* map may be mid-teardown — ignore */
        }
        defaultViewApplied = true;
        lastFrameTime = null;
      };
      map.on("load", onLoadInternal);

      // Cancel any stray prior frame before kicking off (defensive — no
      // prior loop exists in this scope, but keeps the invariant explicit).
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(animate);

      // ── Cleanup ──────────────────────────────────────────────────────────
      return () => {
        disposed = true;
        window.clearTimeout(timeoutId);
        clearResumeTimer();
        cancelAnimationFrame(rafId);
        rafId = 0;
        document.removeEventListener("visibilitychange", onVisibility);
        try {
          canvas.removeEventListener("mousedown", onDomUserInput);
          canvas.removeEventListener("pointerdown", onDomUserInput);
          canvas.removeEventListener("touchstart", onDomUserInput);
          canvas.removeEventListener("wheel", onDomUserInput);
        } catch {
          /* canvas may already be detached */
        }
        pauseAutoRotateRef.current = () => {};
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
          map.remove();
        } catch {
          // Defensive: removal during HMR can race with internal teardown.
        }
      };
    }, []);

    // ── View mode sync ──────────────────────────────────────────────────────
    // First application after load: silent (jumpTo), no auto-rotate pause —
    // the load handler already placed the globe at DEFAULT_GLOBE_VIEW.
    // Subsequent changes: smooth easeTo with auto-rotate paused for the
    // duration of the animation + the standard Central View idle delay.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      const previous = lastAppliedViewRef.current;
      if (previous === activeView) {
        // Still keep marker visibility in sync in case it desynced
        setMarkerVisibility(map, "global", activeView === "global");
        setMarkerVisibility(map, "signals", activeView === "signals");
        return;
      }
      const isFirstApply = previous === null;
      lastAppliedViewRef.current = activeView;
      if (isFirstApply) {
        applyViewMode(map, activeView, false);
        return;
      }
      pauseAutoRotateRef.current(VIEW_TRANSITION_MS + CENTRAL_VIEW_IDLE_DELAY_MS);
      applyViewMode(map, activeView, true);
    }, [activeView, loadState]);

    // ── Marker data sync ────────────────────────────────────────────────────
    // Push fresh feature sets into the GeoJSON sources whenever the parent
    // hands us new arrays.  applyMarkerData is a no-op if the source isn't
    // ready yet, so race conditions during initial load are harmless.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      applyMarkerData(map, "global", globalMarkers ?? []);
    }, [globalMarkers, loadState]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || loadState !== "ready") return;
      applyMarkerData(map, "signals", signalsMarkers ?? []);
    }, [signalsMarkers, loadState]);

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
