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
  DEFAULT_GLOBE_VIEW,
  GLOBE_MAX_ZOOM,
  applyCountryLabelWhitelist,
  applyDarkTone,
  applyEchisGlobeAtmosphere,
  createEchisGlobeStyle,
  setupEchisOutline,
} from "@/components/maplibre/MapLibreGlobe";
import { USE_ECHIS_OSM_BASEMAP } from "@/components/map/styles/echisOsmGlobeStyle";
import { GlobeLoadingAnimation } from "@/components/map/GlobeLoadingAnimation";
import type { AirTrackContact } from "@/types/airtrack";

// ---------------------------------------------------------------------------
// AirTrackGlobe — an independent MapLibre globe instance for the Air Track
// screen.  Cartography (style, atmosphere, outline, labels, camera) is
// consumed from MapLibreGlobe's exported foundation so this globe always
// matches the Monitor Home globe; only the data layer differs: live aircraft
// rendered as heading-rotated symbols from one GeoJSON source, refreshed via
// setData (no DOM markers).
// ---------------------------------------------------------------------------

export interface AirTrackGlobeHandle {
  centerView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Pan to an aircraft, keeping the current zoom. */
  focusContact: (lon: number, lat: number) => void;
  /** Current camera center + zoom — drives the regional fast lane. */
  getView: () => { lat: number; lon: number; zoom: number } | null;
}

interface AirTrackGlobeProps {
  contacts: AirTrackContact[];
  selectedId: string | null;
  onSelect: (contact: AirTrackContact | null) => void;
}

const AIRCRAFT_SOURCE = "echis-airtrack-contacts";
const AIRCRAFT_LAYER = "echis-airtrack-aircraft";
const CIVIL_SYMBOL_LAYER = "echis-airtrack-civil-aircraft";
const AIRCRAFT_SELECTED_RING = "echis-airtrack-selected-ring";
const AIRCRAFT_EMERGENCY_PULSE = "echis-airtrack-emergency-pulse";
const TRAIL_SOURCE = "echis-airtrack-trail";
const TRAIL_LAYER = "echis-airtrack-trail";
const AIRCRAFT_ICON_ID = "echis-airtrack-plane";
const AIRCRAFT_ICON_PRIORITY_ID = "echis-airtrack-plane-priority";
const AIRCRAFT_ICON_CIVIL_ID = "echis-airtrack-plane-civil";

// Warm amber from the Defense Industry palette — military air activity reads
// in the same color family as the defense screen's buyer/operator coding.
// Priority watchlist hits use the steel-blue family (CyberMap "origin" /
// defense "supplier" color) so they pop against both amber traffic and the
// crimson basemap.  Civil traffic (OpenSky) renders in the quiet silver of
// the text ladder so the global background never competes with the military
// layer.
const AIRCRAFT_AMBER = "#f0a75a";
const AIRCRAFT_STEEL = "#a8c6de";
const AIRCRAFT_CIVIL = "#93a1ad";
const AIRCRAFT_RING = "rgba(255, 196, 110, 0.55)";
const EMERGENCY_RED = "#ff2b3d";
const TRAIL_COLOR = "rgba(255, 196, 110, 0.65)";

// Top-view aircraft silhouette, nose up, so icon-rotate maps 1:1 to the
// track angle (0° = north).  Colored at build time — MapLibre SDF coloring
// is avoided to keep the icon crisp at small sizes.
const buildAircraftSvg = (fill: string): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none">' +
  `<path d="M12 1.6c.55 0 1.05 1 1.05 2.3v4.9l8.45 4.9v2.1l-8.45-2.5v4.8l2.3 1.85v1.75L12 20.55l-3.35 1.15v-1.75l2.3-1.85v-4.8L2.5 15.8v-2.1l8.45-4.9V3.9c0-1.3.5-2.3 1.05-2.3z" ` +
  `fill="${fill}" stroke="rgba(8,6,8,0.7)" stroke-width="0.55"/>` +
  "</svg>";

const LOAD_TIMEOUT_MS = 9000;
const ZOOM_STEP = 0.75;

// Auto-rotate — same ambient behaviour as the main globe: longitude stepping
// via jumpTo (never bearing animation), paused while the operator interacts.
// It is a globe-view ambience feature: past this zoom the operator is
// inspecting a region, and drifting the camera would both disorient and
// churn the regional fast-lane query center.
const AUTO_ROTATE_MAX_ZOOM = 4;
const AUTO_ROTATE_DEG_PER_SEC = 1.5;
const INTERACTION_IDLE_DELAY_MS = 15_000;
const AUTO_ROTATE_MAX_DT_S = 0.05;
const AUTO_ROTATE_EVENT_TAG = "echisAirTrackAutoRotate";

type LoadState = "loading" | "ready" | "error";

function registerAircraftIcons(map: maplibregl.Map): void {
  const icons: Array<[string, string]> = [
    [AIRCRAFT_ICON_ID, buildAircraftSvg(AIRCRAFT_AMBER)],
    [AIRCRAFT_ICON_PRIORITY_ID, buildAircraftSvg(AIRCRAFT_STEEL)],
    [AIRCRAFT_ICON_CIVIL_ID, buildAircraftSvg(AIRCRAFT_CIVIL)],
  ];
  const tryLoad = (iconId: string, svg: string) => {
    if (map.hasImage(iconId)) return;
    const img = new Image();
    img.onload = () => {
      try {
        if (!map.hasImage(iconId)) {
          map.addImage(iconId, img, { pixelRatio: 1 });
        }
      } catch {
        /* style mid-teardown — ignore */
      }
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  for (const [iconId, svg] of icons) tryLoad(iconId, svg);
  map.on("styleimagemissing", (e: { id: string }) => {
    const icon = icons.find(([iconId]) => iconId === e.id);
    if (icon) tryLoad(icon[0], icon[1]);
  });
}

function setupAircraftLayers(map: maplibregl.Map): void {
  const emptyFC: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  try {
    if (!map.getSource(AIRCRAFT_SOURCE)) {
      map.addSource(AIRCRAFT_SOURCE, { type: "geojson", data: emptyFC });
    }
    if (!map.getSource(TRAIL_SOURCE)) {
      map.addSource(TRAIL_SOURCE, { type: "geojson", data: emptyFC });
    }
    // Selected-aircraft trail — under every point layer.
    if (!map.getLayer(TRAIL_LAYER)) {
      map.addLayer({
        id: TRAIL_LAYER,
        type: "line",
        source: TRAIL_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": TRAIL_COLOR,
          "line-width": 1.6,
          "line-dasharray": [1.4, 1.6],
        },
      } as unknown as maplibregl.LayerSpecification);
    }
    // Emergency pulse — animated ring under aircraft squawking 7500/7600/7700.
    if (!map.getLayer(AIRCRAFT_EMERGENCY_PULSE)) {
      map.addLayer({
        id: AIRCRAFT_EMERGENCY_PULSE,
        type: "circle",
        source: AIRCRAFT_SOURCE,
        filter: ["==", ["get", "em"], 1],
        paint: {
          "circle-radius": 12,
          "circle-color": "rgba(255,43,61,0.16)",
          "circle-stroke-width": 1.6,
          "circle-stroke-color": EMERGENCY_RED,
          "circle-stroke-opacity": 0.9,
          "circle-blur": 0.2,
        },
      } as unknown as maplibregl.LayerSpecification);
    }
    // Selection ring below the plane symbols so the highlighted aircraft
    // keeps a clean silhouette.
    if (!map.getLayer(AIRCRAFT_SELECTED_RING)) {
      map.addLayer({
        id: AIRCRAFT_SELECTED_RING,
        type: "circle",
        source: AIRCRAFT_SOURCE,
        filter: ["==", ["get", "id"], "__none__"],
        paint: {
          "circle-radius": 13,
          "circle-color": "rgba(255,196,110,0.14)",
          "circle-stroke-width": 1.3,
          "circle-stroke-color": AIRCRAFT_RING,
          "circle-blur": 0.25,
        },
      } as unknown as maplibregl.LayerSpecification);
    }
    // Civil traffic (OpenSky) — always heading-rotated silhouettes, scaled
    // small and faded on the wide view so the global frame (8–15k aircraft)
    // reads as texture without competing with the military layer above it.
    if (!map.getLayer(CIVIL_SYMBOL_LAYER)) {
      map.addLayer({
        id: CIVIL_SYMBOL_LAYER,
        type: "symbol",
        source: AIRCRAFT_SOURCE,
        filter: ["==", ["get", "civ"], 1],
        layout: {
          "icon-image": AIRCRAFT_ICON_CIVIL_ID,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.5,
            0.34,
            4.2,
            0.55,
            7,
            0.9,
          ],
          "icon-rotate": ["coalesce", ["get", "track"], 0],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.5,
            0.62,
            4.2,
            0.85,
          ],
        },
      });
    }
    if (!map.getLayer(AIRCRAFT_LAYER)) {
      map.addLayer({
        id: AIRCRAFT_LAYER,
        type: "symbol",
        source: AIRCRAFT_SOURCE,
        filter: ["==", ["get", "civ"], 0],
        layout: {
          // Priority watchlist hits render in steel; the rest in amber.
          "icon-image": [
            "case",
            ["==", ["get", "wl"], 2],
            AIRCRAFT_ICON_PRIORITY_ID,
            AIRCRAFT_ICON_ID,
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.5,
            0.5,
            4,
            0.72,
            7,
            1,
          ],
          "icon-rotate": ["coalesce", ["get", "track"], 0],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 0.95,
        },
      });
    }
  } catch (e) {
    console.warn("[AirTrackGlobe] aircraft layer setup failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Dead reckoning — between feed frames every airborne contact is projected
// forward along its last known track at its last known ground speed, so the
// picture moves continuously even though the military layer refreshes every
// 10 s and the civil layer every ~95 s.
//
// The anchor is per aircraft, not per frame: a base position is timestamped
// only when the reported position actually changes.  This matters because
// the two layers poll at different cadences — anchoring at frame arrival
// would snap every civil aircraft backwards on each military frame.
// ---------------------------------------------------------------------------

/**
 * Last reported position per aircraft.  `from*`/`blendStart` drive the
 * correction lerp: when a new real fix arrives, the symbol is eased from
 * where it was last drawn (`last*`) to the new projected track instead of
 * snapping — turning aircraft correct smoothly.
 */
type DrBase = {
  lon: number;
  lat: number;
  at: number;
  fromLon: number | null;
  fromLat: number | null;
  blendStart: number;
  lastLon: number;
  lastLat: number;
};
type DrBaseStore = Map<string, DrBase>;

const KT_TO_MPS = 0.514444;
const METERS_PER_DEG_LAT = 111_320;
// If the feed stalls, stop projecting after this long — a frozen (and
// HUD-flagged stale) picture is honest; aircraft flying on forever is not.
const DR_MAX_EXTRAPOLATION_MS = 120_000;
// Below this speed (taxi / holding) heading data is noisy; hold position.
const DR_MIN_SPEED_KT = 40;
// Re-render cadence for the projected positions.  2 Hz keeps motion visibly
// continuous at every zoom (a full 13k-feature setData is a few ms) and
// gives the correction lerp enough frames to read as smooth.
const DR_TICK_MS = 500;
// Correction lerp duration — a new fix pulls the symbol over ~2 ticks.
const DR_BLEND_MS = 1_200;

function updateDrBases(
  store: DrBaseStore,
  contacts: AirTrackContact[],
  now: number,
): void {
  const seen = new Set<string>();
  for (const c of contacts) {
    seen.add(c.icao24);
    const base = store.get(c.icao24);
    if (!base) {
      store.set(c.icao24, {
        lon: c.lon,
        lat: c.lat,
        at: now,
        fromLon: null,
        fromLat: null,
        blendStart: 0,
        lastLon: c.lon,
        lastLat: c.lat,
      });
    } else if (base.lon !== c.lon || base.lat !== c.lat) {
      // New real fix: re-anchor, and ease from the last drawn position.
      base.fromLon = base.lastLon;
      base.fromLat = base.lastLat;
      base.blendStart = now;
      base.lon = c.lon;
      base.lat = c.lat;
      base.at = now;
    }
  }
  for (const key of store.keys()) {
    if (!seen.has(key)) store.delete(key);
  }
}

function wrapLon(lon: number): number {
  if (lon > 180) return lon - 360;
  if (lon < -180) return lon + 360;
  return lon;
}

/**
 * Where to draw an aircraft right now: dead-reckoned from its anchor, then
 * blended from the previously drawn position while a correction is active.
 * Records the result on the base (`last*`) so the next correction can start
 * from what the user actually saw.
 */
function projectedPosition(
  c: AirTrackContact,
  base: DrBase | undefined,
  now: number,
): [number, number] {
  if (!base) return [c.lon, c.lat];

  let lon = base.lon;
  let lat = base.lat;
  const airborne =
    !c.onGround &&
    c.groundSpeedKt !== null &&
    c.track !== null &&
    c.groundSpeedKt >= DR_MIN_SPEED_KT;
  if (airborne) {
    const dtSec =
      Math.min(Math.max(now - base.at, 0), DR_MAX_EXTRAPOLATION_MS) / 1000;
    const latRad = (base.lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    // Longitude degenerates near the poles; polar traffic is vanishingly
    // rare, so simply hold the reported fix there.
    if (dtSec > 0 && Math.abs(cosLat) >= 0.05) {
      const distM = (c.groundSpeedKt as number) * KT_TO_MPS * dtSec;
      const trackRad = ((c.track as number) * Math.PI) / 180;
      lat = Math.max(
        -85,
        Math.min(85, base.lat + (distM * Math.cos(trackRad)) / METERS_PER_DEG_LAT),
      );
      lon = wrapLon(
        base.lon + (distM * Math.sin(trackRad)) / (METERS_PER_DEG_LAT * cosLat),
      );
    }
  }

  // Correction lerp — ease-out from the last drawn position to the new track.
  if (base.fromLon !== null && base.fromLat !== null) {
    const elapsed = now - base.blendStart;
    if (elapsed < DR_BLEND_MS) {
      const t = elapsed / DR_BLEND_MS;
      const eased = 1 - (1 - t) * (1 - t);
      // Blend the short way around the antimeridian.
      let fromLon = base.fromLon;
      if (Math.abs(fromLon - lon) > 180) {
        fromLon += fromLon < lon ? 360 : -360;
      }
      lon = wrapLon(fromLon + (lon - fromLon) * eased);
      lat = base.fromLat + (lat - base.fromLat) * eased;
    } else {
      base.fromLon = null;
      base.fromLat = null;
    }
  }

  base.lastLon = lon;
  base.lastLat = lat;
  return [lon, lat];
}

function contactsToFeatureCollection(
  contacts: AirTrackContact[],
  drBases: DrBaseStore,
  now: number,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: contacts.map((c) => ({
      type: "Feature",
      id: c.icao24,
      geometry: {
        type: "Point",
        coordinates: projectedPosition(c, drBases.get(c.icao24), now),
      },
      properties: {
        id: c.icao24,
        track: c.track ?? 0,
        // wl: 0 none · 1 watchlist · 2 priority watchlist
        wl: c.watchlist ? (c.watchlist.priority ? 2 : 1) : 0,
        em: c.emergency ? 1 : 0,
        // civ: 1 = civil background traffic (silver dot/symbol layers);
        // 0 = military/watchlist (amber/steel symbol layer).
        civ: c.military || c.watchlist ? 0 : 1,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Trail history — per-aircraft position rings kept module-locally per globe
// instance (in a ref).  Positions are appended once per feed frame and only
// when the aircraft actually moved; the line layer renders the selected
// aircraft's history.
// ---------------------------------------------------------------------------
const TRAIL_MAX_POINTS = 60;

type TrailStore = Map<string, [number, number][]>;

function appendTrailPositions(store: TrailStore, contacts: AirTrackContact[]) {
  const seen = new Set<string>();
  for (const c of contacts) {
    seen.add(c.icao24);
    const points = store.get(c.icao24);
    if (!points) {
      store.set(c.icao24, [[c.lon, c.lat]]);
      continue;
    }
    const last = points[points.length - 1];
    if (last[0] !== c.lon || last[1] !== c.lat) {
      points.push([c.lon, c.lat]);
      if (points.length > TRAIL_MAX_POINTS) points.shift();
    }
  }
  // Drop aircraft that left the feed so the store cannot grow unbounded.
  for (const key of store.keys()) {
    if (!seen.has(key)) store.delete(key);
  }
}

function trailFeatureCollection(
  store: TrailStore,
  selectedId: string | null,
  // Current dead-reckoned position — appended as the line's head so the
  // trail stays glued to the moving symbol between real fixes.
  projectedHead?: [number, number],
): GeoJSON.FeatureCollection {
  const points = selectedId ? store.get(selectedId) : undefined;
  if (!points || points.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }
  const coordinates = projectedHead ? [...points, projectedHead] : points;
  if (coordinates.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      },
    ],
  };
}

export const AirTrackGlobe = forwardRef<AirTrackGlobeHandle, AirTrackGlobeProps>(
  function AirTrackGlobe({ contacts, selectedId, onSelect }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const styleReadyRef = useRef(false);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Latest contacts by id — the click handler resolves the full contact
    // from the feature id without re-binding map listeners on every frame.
    const contactsByIdRef = useRef<Map<string, AirTrackContact>>(new Map());
    // Dead-reckoning anchors: last reported position per aircraft.
    const drBasesRef = useRef<DrBaseStore>(new Map());
    // Position history per aircraft for the selected-trail line.
    const trailStoreRef = useRef<TrailStore>(new Map());
    // True while at least one aircraft in the frame squawks an emergency —
    // gates the per-frame pulse animation so idle frames cost nothing.
    const hasEmergencyRef = useRef(false);
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);
    // Mirrors the selectedId prop for the DR tick, which lives in a
    // mount-once effect and cannot see prop updates directly.
    const selectedIdRef = useRef(selectedId);
    useEffect(() => {
      selectedIdRef.current = selectedId;
    }, [selectedId]);

    // Auto-rotate pause bookkeeping (shared by handlers + RAF loop).
    const rotatePausedUntilRef = useRef(0);

    useImperativeHandle(
      ref,
      () => ({
        centerView: () => {
          const m = mapRef.current;
          if (!m) return;
          rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
          try {
            m.easeTo({
              center: DEFAULT_GLOBE_VIEW.center,
              zoom: DEFAULT_GLOBE_VIEW.zoom,
              bearing: DEFAULT_GLOBE_VIEW.bearing,
              pitch: DEFAULT_GLOBE_VIEW.pitch,
              duration: 1200,
              easing: (t) => 1 - Math.pow(1 - t, 3),
            });
          } catch {
            /* map mid-teardown — ignore */
          }
        },
        zoomIn: () => {
          rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
          try {
            mapRef.current?.zoomTo(
              Math.min(
                (mapRef.current?.getZoom() ?? 0) + ZOOM_STEP,
                GLOBE_MAX_ZOOM,
              ),
              { duration: 320 },
            );
          } catch {
            /* noop */
          }
        },
        zoomOut: () => {
          rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
          try {
            mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 0) - ZOOM_STEP, {
              duration: 320,
            });
          } catch {
            /* noop */
          }
        },
        focusContact: (lon: number, lat: number) => {
          const m = mapRef.current;
          if (!m) return;
          rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
          try {
            m.easeTo({
              center: [lon, lat],
              duration: 1100,
              easing: (t) => 1 - Math.pow(1 - t, 3),
            });
          } catch {
            /* map mid-teardown — ignore */
          }
        },
        getView: () => {
          const m = mapRef.current;
          if (!m) return null;
          try {
            const center = m.getCenter();
            return { lat: center.lat, lon: center.lng, zoom: m.getZoom() };
          } catch {
            return null;
          }
        },
      }),
      [],
    );

    // ── Map lifecycle — one instance, full teardown on unmount ─────────────
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // WebGL2 is required for globe projection; WebGL1 falls back to mercator.
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

      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map({
          container,
          style: createEchisGlobeStyle(),
          center: DEFAULT_GLOBE_VIEW.center,
          zoom: DEFAULT_GLOBE_VIEW.zoom,
          bearing: DEFAULT_GLOBE_VIEW.bearing,
          pitch: DEFAULT_GLOBE_VIEW.pitch,
          maxZoom: GLOBE_MAX_ZOOM,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 200,
        });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "MapLibre init failed.");
        setLoadState("error");
        return;
      }
      mapRef.current = map;

      if (USE_ECHIS_OSM_BASEMAP) {
        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-left",
        );
      }
      map.doubleClickZoom.disable();

      let resolved = false;
      const markReady = () => {
        if (resolved) return;
        resolved = true;
        setLoadState("ready");
      };

      const handleStyleLoad = () => {
        styleReadyRef.current = true;
        if (hasWebGL2) {
          try {
            map.setProjection({ type: "globe" });
          } catch (e) {
            console.warn("[AirTrackGlobe] globe projection failed:", e);
          }
        }
        applyEchisGlobeAtmosphere(map);
        if (!USE_ECHIS_OSM_BASEMAP) applyDarkTone(map);
        applyCountryLabelWhitelist(map);
        setupEchisOutline(map);
        registerAircraftIcons(map);
        setupAircraftLayers(map);
        // Push whatever contacts arrived before the style finished loading.
        const source = map.getSource(AIRCRAFT_SOURCE);
        if (source?.type === "geojson") {
          (source as maplibregl.GeoJSONSource).setData(
            contactsToFeatureCollection(
              Array.from(contactsByIdRef.current.values()),
              drBasesRef.current,
              Date.now(),
            ),
          );
        }
        try {
          map.resize();
        } catch {
          /* noop */
        }
        window.requestAnimationFrame(markReady);
      };
      map.on("style.load", handleStyleLoad);
      map.on("error", (e) => {
        // Tile-level errors are non-fatal; only surface a hard failure while
        // the first style is still pending.
        if (!resolved && !styleReadyRef.current) {
          console.warn("[AirTrackGlobe] map error before ready:", e?.error);
        }
      });

      const loadTimeout = window.setTimeout(() => {
        if (!resolved) {
          setErrorMsg("Globe tiles did not load in time.");
          setLoadState("error");
        }
      }, LOAD_TIMEOUT_MS);

      // ── Aircraft interaction ────────────────────────────────────────────
      // Military symbols first so an overlapping amber contact wins the
      // click over background civil traffic.
      const interactiveLayers = () =>
        [AIRCRAFT_LAYER, CIVIL_SYMBOL_LAYER].filter((id) => map.getLayer(id));
      const handleClick = (e: maplibregl.MapMouseEvent) => {
        rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
        const layers = interactiveLayers();
        if (layers.length === 0) return;
        try {
          const hit = map
            .queryRenderedFeatures(e.point, { layers })
            .find((f) => f.properties?.id);
          if (!hit) {
            onSelectRef.current(null);
            return;
          }
          const contact =
            contactsByIdRef.current.get(String(hit.properties!.id)) ?? null;
          onSelectRef.current(contact);
        } catch {
          /* transient tile race — ignore */
        }
      };
      const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
        const layers = interactiveLayers();
        if (layers.length === 0) return;
        try {
          const hit = map.queryRenderedFeatures(e.point, { layers });
          map.getCanvas().style.cursor = hit.length > 0 ? "pointer" : "";
        } catch {
          /* noop */
        }
      };
      map.on("click", handleClick);
      map.on("mousemove", handleMouseMove);

      // ── Auto-rotate (longitude stepping, AGENTS §6) ─────────────────────
      const pauseRotate = () => {
        rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
      };
      map.on("mousedown", pauseRotate);
      map.on("touchstart", pauseRotate);
      map.on("wheel", pauseRotate);

      let rafId: number | null = null;
      let lastFrame = performance.now();
      const rotateFrame = (now: number) => {
        rafId = window.requestAnimationFrame(rotateFrame);
        const dt = Math.min((now - lastFrame) / 1000, AUTO_ROTATE_MAX_DT_S);
        lastFrame = now;
        if (!styleReadyRef.current) return;
        // Emergency pulse — breathing ring, ~1.6s period.  Runs regardless of
        // rotate pause but only while an emergency contact is on the globe.
        if (hasEmergencyRef.current) {
          try {
            if (map.getLayer(AIRCRAFT_EMERGENCY_PULSE)) {
              const phase = (now % 1600) / 1600;
              const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
              map.setPaintProperty(
                AIRCRAFT_EMERGENCY_PULSE,
                "circle-radius",
                10 + 10 * wave,
              );
              map.setPaintProperty(
                AIRCRAFT_EMERGENCY_PULSE,
                "circle-stroke-opacity",
                0.95 - 0.65 * wave,
              );
            }
          } catch {
            /* layer mid-teardown — ignore */
          }
        }
        if (Date.now() < rotatePausedUntilRef.current) return;
        try {
          if (map.getZoom() >= AUTO_ROTATE_MAX_ZOOM) return;
          const center = map.getCenter();
          map.jumpTo(
            { center: [center.lng - AUTO_ROTATE_DEG_PER_SEC * dt, center.lat] },
            { [AUTO_ROTATE_EVENT_TAG]: true },
          );
        } catch {
          /* map mid-teardown — ignore */
        }
      };
      rafId = window.requestAnimationFrame(rotateFrame);

      const resizeObserver = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          /* noop */
        }
      });
      resizeObserver.observe(container);

      return () => {
        window.clearTimeout(loadTimeout);
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        styleReadyRef.current = false;
        map.remove();
        mapRef.current = null;
      };
      // The map instance is created once per mount; data/selection flow in
      // through the effects below.
    }, []);

    // ── Contacts → GeoJSON setData (+ dead-reckoning anchors) ──────────────
    useEffect(() => {
      const now = Date.now();
      contactsByIdRef.current = new Map(
        contacts.map((c) => [c.icao24, c] as const),
      );
      // Anchors must be refreshed before rendering so a changed position is
      // drawn at its new reported fix, not projected from the stale one.
      updateDrBases(drBasesRef.current, contacts, now);
      appendTrailPositions(trailStoreRef.current, contacts);
      hasEmergencyRef.current = contacts.some((c) => c.emergency);
      const map = mapRef.current;
      if (!map || !styleReadyRef.current) return;
      const source = map.getSource(AIRCRAFT_SOURCE);
      if (!source || source.type !== "geojson") return;
      try {
        (source as maplibregl.GeoJSONSource).setData(
          contactsToFeatureCollection(contacts, drBasesRef.current, now),
        );
      } catch {
        /* mid-teardown — ignore */
      }
    }, [contacts, loadState]);

    // ── Dead-reckoning tick — re-project all airborne contacts at 1 Hz ─────
    useEffect(() => {
      const timer = window.setInterval(() => {
        const map = mapRef.current;
        if (!map || !styleReadyRef.current) return;
        // A hidden tab neither renders nor polls; skip the work.
        if (document.visibilityState === "hidden") return;
        const source = map.getSource(AIRCRAFT_SOURCE);
        if (!source || source.type !== "geojson") return;
        const now = Date.now();
        try {
          (source as maplibregl.GeoJSONSource).setData(
            contactsToFeatureCollection(
              Array.from(contactsByIdRef.current.values()),
              drBasesRef.current,
              now,
            ),
          );
          // Keep the selected trail's head glued to the moving symbol.
          const selId = selectedIdRef.current;
          const trailSource = map.getSource(TRAIL_SOURCE);
          if (selId && trailSource?.type === "geojson") {
            const selected = contactsByIdRef.current.get(selId);
            (trailSource as maplibregl.GeoJSONSource).setData(
              trailFeatureCollection(
                trailStoreRef.current,
                selId,
                selected
                  ? projectedPosition(selected, drBasesRef.current.get(selId), now)
                  : undefined,
              ),
            );
          }
        } catch {
          /* mid-teardown — ignore */
        }
      }, DR_TICK_MS);
      return () => window.clearInterval(timer);
    }, []);

    // ── Selected-aircraft trail ─────────────────────────────────────────────
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleReadyRef.current) return;
      const source = map.getSource(TRAIL_SOURCE);
      if (!source || source.type !== "geojson") return;
      const selected = selectedId
        ? contactsByIdRef.current.get(selectedId)
        : undefined;
      try {
        (source as maplibregl.GeoJSONSource).setData(
          trailFeatureCollection(
            trailStoreRef.current,
            selectedId,
            selected
              ? projectedPosition(
                  selected,
                  drBasesRef.current.get(selectedId as string),
                  Date.now(),
                )
              : undefined,
          ),
        );
      } catch {
        /* mid-teardown — ignore */
      }
    }, [contacts, selectedId, loadState]);

    // ── Selection ring ──────────────────────────────────────────────────────
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleReadyRef.current || !map.getLayer(AIRCRAFT_SELECTED_RING))
        return;
      try {
        map.setFilter(AIRCRAFT_SELECTED_RING, [
          "==",
          ["get", "id"],
          selectedId ?? "__none__",
        ] as unknown as maplibregl.FilterSpecification);
      } catch {
        /* noop */
      }
    }, [selectedId, loadState]);

    // Render — inline styles only, mirroring MapLibreGlobe: MapLibre adds its
    // own .maplibregl-map class (position: relative) to the container, which
    // can override a Tailwind `absolute` class and collapse the container to
    // zero height.  Explicit inline position/inset always wins.
    return (
      <div
        aria-label="Air Track globe"
        style={{
          position: "absolute",
          inset: 0,
          background: "#0B0C0E",
          overflow: "hidden",
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            background: "#0B0C0E",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 46%, transparent 0%, transparent 42%, rgba(4,4,5,0.6) 70%, rgba(4,4,5,0.98) 100%)",
          }}
        />
        {loadState === "loading" && (
          <GlobeLoadingAnimation visible />
        )}
        {loadState === "error" && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "#0B0C0E" }}
          >
            <div
              className="px-4 py-3 rounded-lg text-center"
              style={{
                background: "rgba(7,8,10,0.85)",
                border: "1px solid var(--c-border-2)",
                color: "var(--c-t4)",
                fontSize: "12px",
                maxWidth: "320px",
              }}
            >
              Globe failed to load{errorMsg ? ` — ${errorMsg}` : "."} Refresh the
              page to retry.
            </div>
          </div>
        )}
      </div>
    );
  },
);
