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
  // Tuned visually: full globe comfortably visible with black margin while
  // keeping Europe / Türkiye / Middle East / Africa / Asia in a balanced
  // frame.  Equivalent to the prior Central View (zoom 2.9) minus one
  // zoom-out button step (ZOOM_STEP = 0.75).  Single source of truth —
  // initial paint and Central View consume this same value.
  zoom: 2.15,
  bearing: 0,
  pitch: 0,
} as const;
const ZOOM_STEP = 0.75;

// ---------------------------------------------------------------------------
// applyDefaultGlobeView — the only function that may set the canonical
// default camera.  Both the initial load (animated=false) and the Central
// View reset (animated=true) MUST go through here so the two views can
// never drift apart.
// ---------------------------------------------------------------------------
function applyDefaultGlobeView(
  map: maplibregl.Map,
  animated: boolean,
): void {
  const camera = {
    center: DEFAULT_GLOBE_VIEW.center,
    zoom: DEFAULT_GLOBE_VIEW.zoom,
    bearing: DEFAULT_GLOBE_VIEW.bearing,
    pitch: DEFAULT_GLOBE_VIEW.pitch,
  };
  if (animated) {
    map.easeTo({
      ...camera,
      duration: 1200,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  } else {
    map.jumpTo(camera);
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
// 0.6°/sec → one full revolution every 10 minutes.  Calm and operational.
// 75 seconds is the idle window after the last real user input before
// rotation resumes.
// ---------------------------------------------------------------------------
const AUTO_ROTATE_DEG_PER_SEC = 0.6;
const AUTO_ROTATE_RESUME_DELAY_MS = 75_000;
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

export const MapLibreGlobe = forwardRef<MapLibreGlobeHandle>(
  function MapLibreGlobe(_props, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    // Imperative pause-rotate hook — wired by the useEffect below and called
    // from the imperative handle (button-driven zoom/center) and from real
    // user input listeners on the canvas.  Stored as a ref so it remains
    // available without re-binding the imperative handle on every render.
    const pauseAutoRotateRef = useRef<() => void>(() => {});

    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const m = mapRef.current;
          if (!m) return;
          pauseAutoRotateRef.current();
          m.zoomTo(m.getZoom() + ZOOM_STEP, { duration: 350 });
        },
        zoomOut: () => {
          const m = mapRef.current;
          if (!m) return;
          pauseAutoRotateRef.current();
          m.zoomTo(m.getZoom() - ZOOM_STEP, { duration: 350 });
        },
        centerView: () => {
          const m = mapRef.current;
          if (!m) return;
          // Pause auto-rotate immediately so it can't fight the animation
          // or mutate the camera mid-reset.  The pause schedules the normal
          // idle-delay resume; nothing else needs to be done here.
          pauseAutoRotateRef.current();
          applyDefaultGlobeView(m, true);
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

      const scheduleResume = () => {
        clearResumeTimer();
        resumeTimerId = window.setTimeout(() => {
          resumeTimerId = null;
          userInteracting = false;
          // Reset frame clock so the first post-resume frame computes a
          // small dt instead of catching up missed seconds in one jump.
          lastFrameTime = null;
        }, AUTO_ROTATE_RESUME_DELAY_MS);
      };

      const pauseAutoRotate = () => {
        userInteracting = true;
        lastFrameTime = null;
        scheduleResume();
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
        pauseAutoRotate();
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
      const onDomUserInput = () => pauseAutoRotate();
      canvas.addEventListener("mousedown", onDomUserInput, { passive: true });
      canvas.addEventListener("pointerdown", onDomUserInput, { passive: true });
      canvas.addEventListener("touchstart", onDomUserInput, { passive: true });
      canvas.addEventListener("wheel", onDomUserInput, { passive: true });

      // ── visibilitychange ────────────────────────────────────────────────
      // Hidden: loop self-gates via document.hidden.  Visible: route through
      // the normal idle-delay path so we don't jump on return.
      const onVisibility = () => {
        if (document.hidden) {
          lastFrameTime = null;
        } else {
          pauseAutoRotate();
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
