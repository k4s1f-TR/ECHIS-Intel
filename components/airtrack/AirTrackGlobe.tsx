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
  setupLuxeOutline,
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
}

interface AirTrackGlobeProps {
  contacts: AirTrackContact[];
  selectedId: string | null;
  onSelect: (contact: AirTrackContact | null) => void;
}

const AIRCRAFT_SOURCE = "echis-airtrack-contacts";
const AIRCRAFT_LAYER = "echis-airtrack-aircraft";
const AIRCRAFT_SELECTED_RING = "echis-airtrack-selected-ring";
const AIRCRAFT_ICON_ID = "echis-airtrack-plane";

// Warm amber from the Defense Industry palette — military air activity reads
// in the same color family as the defense screen's buyer/operator coding.
const AIRCRAFT_AMBER = "#f0a75a";
const AIRCRAFT_RING = "rgba(255, 196, 110, 0.55)";

// Top-view aircraft silhouette, nose up, so icon-rotate maps 1:1 to the
// track angle (0° = north).  Colored at build time — MapLibre SDF coloring
// is avoided to keep the icon crisp at small sizes.
const AIRCRAFT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none">' +
  `<path d="M12 1.6c.55 0 1.05 1 1.05 2.3v4.9l8.45 4.9v2.1l-8.45-2.5v4.8l2.3 1.85v1.75L12 20.55l-3.35 1.15v-1.75l2.3-1.85v-4.8L2.5 15.8v-2.1l8.45-4.9V3.9c0-1.3.5-2.3 1.05-2.3z" ` +
  `fill="${AIRCRAFT_AMBER}" stroke="rgba(8,6,8,0.7)" stroke-width="0.55"/>` +
  "</svg>";

const LOAD_TIMEOUT_MS = 9000;
const ZOOM_STEP = 0.75;

// Auto-rotate — same ambient behaviour as the main globe: longitude stepping
// via jumpTo (never bearing animation), paused while the operator interacts.
const AUTO_ROTATE_DEG_PER_SEC = 1.5;
const INTERACTION_IDLE_DELAY_MS = 15_000;
const AUTO_ROTATE_MAX_DT_S = 0.05;
const AUTO_ROTATE_EVENT_TAG = "echisAirTrackAutoRotate";

type LoadState = "loading" | "ready" | "error";

function registerAircraftIcon(map: maplibregl.Map): void {
  const tryLoad = () => {
    if (map.hasImage(AIRCRAFT_ICON_ID)) return;
    const img = new Image();
    img.onload = () => {
      try {
        if (!map.hasImage(AIRCRAFT_ICON_ID)) {
          map.addImage(AIRCRAFT_ICON_ID, img, { pixelRatio: 1 });
        }
      } catch {
        /* style mid-teardown — ignore */
      }
    };
    img.src =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(AIRCRAFT_SVG);
  };
  tryLoad();
  map.on("styleimagemissing", (e: { id: string }) => {
    if (e.id === AIRCRAFT_ICON_ID) tryLoad();
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
    if (!map.getLayer(AIRCRAFT_LAYER)) {
      map.addLayer({
        id: AIRCRAFT_LAYER,
        type: "symbol",
        source: AIRCRAFT_SOURCE,
        layout: {
          "icon-image": AIRCRAFT_ICON_ID,
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

function contactsToFeatureCollection(
  contacts: AirTrackContact[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: contacts.map((c) => ({
      type: "Feature",
      id: c.icao24,
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      properties: {
        id: c.icao24,
        track: c.track ?? 0,
      },
    })),
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
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);

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
        setupLuxeOutline(map);
        registerAircraftIcon(map);
        setupAircraftLayers(map);
        // Push whatever contacts arrived before the style finished loading.
        const source = map.getSource(AIRCRAFT_SOURCE);
        if (source?.type === "geojson") {
          (source as maplibregl.GeoJSONSource).setData(
            contactsToFeatureCollection(
              Array.from(contactsByIdRef.current.values()),
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
      const handleClick = (e: maplibregl.MapMouseEvent) => {
        rotatePausedUntilRef.current = Date.now() + INTERACTION_IDLE_DELAY_MS;
        if (!map.getLayer(AIRCRAFT_LAYER)) return;
        try {
          const hit = map
            .queryRenderedFeatures(e.point, { layers: [AIRCRAFT_LAYER] })
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
        if (!map.getLayer(AIRCRAFT_LAYER)) return;
        try {
          const hit = map.queryRenderedFeatures(e.point, {
            layers: [AIRCRAFT_LAYER],
          });
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
        if (Date.now() < rotatePausedUntilRef.current) return;
        if (!styleReadyRef.current) return;
        try {
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

    // ── Contacts → GeoJSON setData ──────────────────────────────────────────
    useEffect(() => {
      contactsByIdRef.current = new Map(
        contacts.map((c) => [c.icao24, c] as const),
      );
      const map = mapRef.current;
      if (!map || !styleReadyRef.current) return;
      const source = map.getSource(AIRCRAFT_SOURCE);
      if (!source || source.type !== "geojson") return;
      try {
        (source as maplibregl.GeoJSONSource).setData(
          contactsToFeatureCollection(contacts),
        );
      } catch {
        /* mid-teardown — ignore */
      }
    }, [contacts, loadState]);

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
