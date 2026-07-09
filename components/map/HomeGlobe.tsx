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
import countriesAtlas from "world-atlas/countries-50m.json";
import {
  DEFAULT_GLOBE_VIEW,
  LUXE_BORDER_COUNTRY,
  LUXE_LAND_FILL,
  LUXE_PANEL_BG,
  LUXE_WATER_FILL,
  applyEchisGlobeAtmosphere,
  type MapLibreGlobeHandle,
} from "@/components/maplibre/MapLibreGlobe";

// ---------------------------------------------------------------------------
// HomeGlobe — the opening-screen globe, fully offline.
//
// Unlike MapLibreGlobe (the Global View / SOCMINT work globe, which streams
// OpenFreeMap vector tiles and remote glyphs), this globe is built entirely
// from data already bundled with the app:
//   • land polygons + country/coast outlines — world-atlas countries-50m
//   • atmosphere halo — applyEchisGlobeAtmosphere (shared)
//
// Resolution note: the work globe's luxe outline uses countries-10m with
// tolerance 0, which is right for its deep-zoom cartography but takes the
// GeoJSON worker seconds to index — borders would pop in late, tile by tile.
// The home globe is capped at z6, where the 50m dataset (5x smaller, default
// simplification) is visually identical and indexes near-instantly, so land
// and borders appear together with the sphere in the first painted frame.
// Both land and outline are part of the initial style (not added on
// style.load) for the same reason: one commit, no progressive layering.
//
// No tile requests, no glyph requests, no loading animation.  Labels are
// intentionally absent for now — text would require locally hosted glyphs,
// which is a separate step.
//
// Camera contract: DEFAULT_GLOBE_VIEW stays the single source of truth for
// initial paint and Center View, and auto-rotate is longitude-based jumpTo,
// exactly like the work globe (AGENTS.md §6).
// ---------------------------------------------------------------------------

const HOME_LAND_SOURCE = "echis-home-land";
const HOME_LAND_LAYER = "echis-home-land-fill";
const HOME_OUTLINE_SOURCE = "echis-home-outline";
const HOME_OUTLINE_LAYER = "echis-home-outline";

// Offline data is meaningful to roughly z6; past that there is no detail to
// reveal, so the cap keeps the globe from zooming into emptiness.
const HOME_GLOBE_MAX_ZOOM = 6;
const ZOOM_STEP = 0.75;

// Auto-rotate constants mirror MapLibreGlobe so the two globes feel identical.
const AUTO_ROTATE_DEG_PER_SEC = 1.5;
const AUTO_ROTATE_MAX_DT_S = 0.05;
const AUTO_ROTATE_EVENT_TAG = "echisAutoRotate";
const CENTRAL_VIEW_IDLE_DELAY_MS = 3_000;
const INTERACTION_IDLE_DELAY_MS = 15_000;
const CENTRAL_VIEW_ANIM_MS = 1200;
const FOCUS_MARKER_ANIM_MS = 1500;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Outline segments — same ring-splitting approach as the work globe's luxe
// outline (independent 2-point pieces so no continuous pen path can connect
// unrelated ends), with two artifact filters:
//   • antimeridian closures — the vertical jump edge where a clipped polygon
//     (Russia, Fiji, Antarctica) wraps from +180 to -180
//   • polar closure lines — the straight edge polygons use to close along
//     the poles; never a real border
// The 10m-specific max-edge-length filter is intentionally NOT applied: 50m
// data legitimately has long straight border edges (deserts, the 49th
// parallel) that the 0.75° cap would punch holes into.
const ANTIMERIDIAN_JUMP_DEG = 180;
const POLAR_ARTIFACT_LAT = 85;

function isDrawableOutlineEdge(
  previous: GeoJSON.Position,
  current: GeoJSON.Position,
): boolean {
  if (Math.abs(previous[0] - current[0]) >= ANTIMERIDIAN_JUMP_DEG) return false;
  if (
    Math.abs(previous[1]) >= POLAR_ARTIFACT_LAT &&
    Math.abs(current[1]) >= POLAR_ARTIFACT_LAT
  ) {
    return false;
  }
  return true;
}

function appendRingSegments(
  ring: GeoJSON.Position[],
  lines: GeoJSON.Position[][],
): void {
  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (!previous || !current) continue;
    if (isDrawableOutlineEdge(previous, current)) lines.push([previous, current]);
  }
}

function collectOutlineSegments(
  geometry: GeoJSON.Geometry | null,
  lines: GeoJSON.Position[][],
): void {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => appendRingSegments(ring, lines));
    return;
  }
  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => appendRingSegments(ring, lines));
    });
  }
}

type HomeGlobeData = {
  land: GeoJSON.FeatureCollection;
  outline: GeoJSON.FeatureCollection;
};

let homeGlobeDataCache: HomeGlobeData | null = null;

function getHomeGlobeData(): HomeGlobeData {
  if (homeGlobeDataCache) return homeGlobeDataCache;
  const topology = countriesAtlas as unknown as TopoJSON.Topology;
  const land = feature(
    topology,
    topology.objects.countries as TopoJSON.GeometryCollection,
  ) as GeoJSON.FeatureCollection;
  const lines: GeoJSON.Position[][] = [];
  land.features.forEach((country) => {
    collectOutlineSegments(country.geometry, lines);
  });
  homeGlobeDataCache = {
    land,
    outline: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "outline" },
          geometry: { type: "MultiLineString", coordinates: lines },
        },
      ],
    },
  };
  return homeGlobeDataCache;
}

function createHomeGlobeStyle(): maplibregl.StyleSpecification {
  const { land, outline } = getHomeGlobeData();
  return {
    version: 8,
    name: "ECHIS Home Offline",
    sources: {
      [HOME_LAND_SOURCE]: {
        type: "geojson",
        data: land,
        maxzoom: 6,
      },
      [HOME_OUTLINE_SOURCE]: {
        type: "geojson",
        data: outline,
        maxzoom: 6,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": LUXE_WATER_FILL },
      },
      {
        id: HOME_LAND_LAYER,
        type: "fill",
        source: HOME_LAND_SOURCE,
        paint: { "fill-color": LUXE_LAND_FILL, "fill-opacity": 1 },
      },
      {
        id: HOME_OUTLINE_LAYER,
        type: "line",
        source: HOME_OUTLINE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": LUXE_BORDER_COUNTRY,
          "line-width": 0.62,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.9,
            6,
            0.95,
          ],
        },
      } as unknown as maplibregl.LayerSpecification,
    ],
  };
}

interface HomeGlobeProps {
  autoRotatePaused?: boolean;
}

export const HomeGlobe = forwardRef<MapLibreGlobeHandle, HomeGlobeProps>(
  function HomeGlobe({ autoRotatePaused = false }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const autoRotatePausedPropRef = useRef(autoRotatePaused);
    const setAutoRotatePausedRef = useRef<(paused: boolean) => void>(() => {});
    const pauseAutoRotateRef = useRef<(delayMs: number) => void>(() => {});
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
      autoRotatePausedPropRef.current = autoRotatePaused;
      setAutoRotatePausedRef.current(autoRotatePaused);
    }, [autoRotatePaused]);

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
          pauseAutoRotateRef.current(
            CENTRAL_VIEW_ANIM_MS + CENTRAL_VIEW_IDLE_DELAY_MS,
          );
          try {
            m.easeTo({
              center: DEFAULT_GLOBE_VIEW.center,
              zoom: DEFAULT_GLOBE_VIEW.zoom,
              bearing: DEFAULT_GLOBE_VIEW.bearing,
              pitch: DEFAULT_GLOBE_VIEW.pitch,
              duration: CENTRAL_VIEW_ANIM_MS,
              easing: easeOutCubic,
            });
          } catch {
            /* map mid-teardown — ignore */
          }
        },
        focusMarker: (lng: number, lat: number) => {
          const m = mapRef.current;
          if (!m) return;
          pauseAutoRotateRef.current(INTERACTION_IDLE_DELAY_MS);
          try {
            m.easeTo({
              center: [lng, lat],
              duration: FOCUS_MARKER_ANIM_MS,
              easing: easeOutCubic,
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

      // WebGL probe — WebGL2 is required for globe projection; WebGL1 still
      // renders mercator.  Same check as MapLibreGlobe.
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
        return;
      }

      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map({
          container,
          style: createHomeGlobeStyle(),
          center: DEFAULT_GLOBE_VIEW.center,
          zoom: DEFAULT_GLOBE_VIEW.zoom,
          bearing: DEFAULT_GLOBE_VIEW.bearing,
          pitch: DEFAULT_GLOBE_VIEW.pitch,
          maxZoom: HOME_GLOBE_MAX_ZOOM,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 0,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "MapLibre constructor threw.";
        setErrorMsg(msg);
        console.error("[HomeGlobe] init failed:", err);
        return;
      }
      mapRef.current = map;

      map.doubleClickZoom.disable();

      const handleStyleLoad = () => {
        if (hasWebGL2) {
          try {
            map.setProjection({ type: "globe" });
          } catch (e) {
            console.warn(
              "[HomeGlobe] setProjection(globe) failed — using mercator:",
              e,
            );
          }
        }
        applyEchisGlobeAtmosphere(map);
        try {
          map.resize();
        } catch {
          /* noop */
        }
      };
      map.on("style.load", handleStyleLoad);

      const ro = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          /* noop */
        }
      });
      ro.observe(container);

      // ── Auto-rotate — longitude-based jumpTo, mirroring MapLibreGlobe ────
      let rafId = 0;
      let lastFrameTime: number | null = null;
      let resumeTimerId: number | null = null;
      let mapLoaded = false;
      let userInteracting = false;
      let disposed = false;
      let overlayPaused = autoRotatePausedPropRef.current;

      const canRotate = () =>
        mapLoaded && !overlayPaused && !userInteracting && !disposed;

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

      const pauseAutoRotate = (delayMs: number) => {
        userInteracting = true;
        lastFrameTime = null;
        clearResumeTimer();
        resumeTimerId = window.setTimeout(() => {
          resumeTimerId = null;
          userInteracting = false;
          lastFrameTime = null;
        }, delayMs);
      };

      pauseAutoRotateRef.current = pauseAutoRotate;
      setAutoRotatePausedRef.current = (paused: boolean) => {
        overlayPaused = paused;
        lastFrameTime = null;
      };
      setAutoRotatePausedRef.current(autoRotatePausedPropRef.current);

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

      const canvas = map.getCanvasContainer();
      const onDomUserInput = () => pauseAutoRotate(INTERACTION_IDLE_DELAY_MS);
      canvas.addEventListener("mousedown", onDomUserInput, { passive: true });
      canvas.addEventListener("pointerdown", onDomUserInput, { passive: true });
      canvas.addEventListener("touchstart", onDomUserInput, { passive: true });
      canvas.addEventListener("wheel", onDomUserInput, { passive: true });

      // Local style + local GeoJSON commit within a frame or two, so "load"
      // fires almost immediately — no loading overlay needed.
      const onLoadInternal = () => {
        mapLoaded = true;
        lastFrameTime = null;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(animate);
      };
      map.on("load", onLoadInternal);

      return () => {
        disposed = true;
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
          map.remove();
        } catch {
          // Defensive: removal during HMR can race with internal teardown.
        }
      };
    }, []);

    return (
      <div
        aria-label="Home globe"
        style={{
          position: "absolute",
          inset: 0,
          background: LUXE_PANEL_BG,
          overflow: "hidden",
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            background: LUXE_PANEL_BG,
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

        {errorMsg && (
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
              background: LUXE_PANEL_BG,
              padding: 16,
              textAlign: "center",
            }}
          >
            <div>Globe failed to load</div>
            <div style={{ color: "#4e5762", fontSize: 11 }}>{errorMsg}</div>
          </div>
        )}
      </div>
    );
  },
);
