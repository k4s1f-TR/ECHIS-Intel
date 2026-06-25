"use client";

// ---------------------------------------------------------------------------
// LuxeGlobeMap — the Luxe Globe (Three.js) wired up as the dashboard's main,
// fully interactive globe. It reuses the approved Luxe rendering core (deep-red
// ocean, black continents, white borders, physical/clearcoat material) and
// layers on the data/interaction features the dashboard depends on:
//
//   • data-driven markers (minimal glowing dots) for Global View + SOCMINT
//   • far-side occlusion + per-frame screen projection
//   • selection highlight + multi-item count badge + click routing
//   • imperative handle (centerView / zoomIn / zoomOut / projectMarker /
//     focusMarker / setAutoRotatePaused) matching MapLibreGlobeHandle
//   • region / view framing (REGION_GLOBE_VIEWS) via globe-group rotation +
//     camera-distance tweens, with panel-aware horizontal offset
//
// It is a drop-in replacement for <MapLibreGlobe>: same ref handle, same props.
// ---------------------------------------------------------------------------

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { RegionKey } from "@/types/event";
import type {
  MapLibreGlobeHandle,
  MarkerFeature,
  GlobeViewMode,
  MarkerKind,
} from "@/components/maplibre/MapLibreGlobe";
import {
  calculatePanInertia,
  cameraDistanceForZoom,
  classifyWheelInput,
  clamp,
  createContinuousWheelEasing,
  mapEase,
  normalizeWheelDelta,
  panInertiaEase,
  radiansPerPixel,
  trimMotionSamples,
  WHEEL_CLASSIFICATION_DELAY_MS,
  wheelDeltaToZoomDelta,
  WHEEL_ZOOM_EASE_MS,
  WHEEL_ZOOM_TIME_ADJUSTMENT_MS,
  zoomForCameraDistance,
  type MotionSample,
  type WheelEaseState,
  type WheelInputType,
} from "@/components/luxe/luxeGlobeMotion";

// ---------------------------------------------------------------------------
// Framing constants — mirrored from MapLibreGlobe so behaviour matches.
// ---------------------------------------------------------------------------
const REGION_GLOBE_VIEWS: Record<RegionKey, { center: [number, number]; zoom: number }> = {
  "middle-east": { center: [35, 31], zoom: 2.45 },
  europe: { center: [15, 51], zoom: 2.45 },
  "asia-pacific": { center: [112, 18], zoom: 2.15 },
  americas: { center: [-74, 15], zoom: 2.05 },
};
// Türkiye / Eastern-Mediterranean canonical default (DEFAULT_GLOBE_VIEW).
const DEFAULT_CENTER: [number, number] = [35, 31];
const DEFAULT_MAP_ZOOM = 2.12;

// Camera distance band (from the Luxe design) and how MapLibre "zoom" maps to it.
const CAM_Z_DEFAULT = 3.65;
// Closest manual zoom-in distance. Lowered from 2.45 to allow a few extra
// scroll steps inward (default / region framing levels are unchanged).
const CAM_Z_MIN = 1.9;
const CAM_Z_MAX = 4.8;
// MapLibre parity: MapLibre zoom is logarithmic — each unit halves/doubles the
// scale and every wheel notch / button press is a constant *proportional* step
// at any zoom level. Mirror that here in camera-distance space (camZ *= 2^±Δz)
// instead of stepping the distance linearly, so Luxe zoom feels identical to
// the MapLibre globe. Values mirror MapLibreGlobe: ZOOM_STEP 0.75, wheel 1/450.
const MAP_ZOOM_STEP = 0.75;
const INTERACTION_IDLE_MS = 15_000;
const VIEW_TRANSITION_MS = 1_400;
const CENTRAL_VIEW_ANIM_MS = 1_200;
const CENTRAL_VIEW_IDLE_DELAY_MS = 3_000;
const FOCUS_MARKER_ANIM_MS = 1_500;
const BUTTON_ZOOM_ANIM_MS = 350;
const AUTO_ROTATE_DEG_PER_SEC = 1.5;
const AUTO_ROTATE_MAX_DT_S = 0.05;

const ECHIS_GRAD_DARK = "#3b0509";
const ECHIS_GRAD_BRIGHT = "#a80d18";
const ECHIS_GRAD_MID = "#6f0710";

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

const PIN_SVG_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`;
const GLOBAL_PIN_SVG_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(GLOBAL_PIN_SVG)}`;

// Screen framing — the dashboard's side panels. Globe shifts into the free
// zone between the left floating card and the right panel for global/signals.
const VIEW_FRAMING: Record<GlobeViewMode, { left: number; right: number }> = {
  situation: { left: 0, right: 0 },
  global: { left: 220, right: 422 },
  signals: { left: 220, right: 422 },
};

const DEG = Math.PI / 180;

function camZForMapZoom(z: number): number {
  return cameraDistanceForZoom(
    z,
    DEFAULT_MAP_ZOOM,
    CAM_Z_DEFAULT,
    CAM_Z_MIN,
    CAM_Z_MAX,
  );
}

// lat/lng → unit-sphere position matching THREE.SphereGeometry's equirectangular
// UV mapping (verified against the colour-texture projection used by the Luxe core).
function latLngToVector3(lat: number, lng: number, r = 1): THREE.Vector3 {
  return setLatLngVec(new THREE.Vector3(), lat, lng, r);
}

// Allocation-free variant: writes the unit-sphere position into `out`. Used on
// the per-frame projection paths (markers) where a fresh Vector3 per call would
// churn the GC and cause frame hitches.
function setLatLngVec(
  out: THREE.Vector3,
  lat: number,
  lng: number,
  r = 1,
): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return out.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// Globe-group Euler (x,y) that brings a lat/lng to front-centre (toward camera).
// Derived from the Euler-XYZ world matrix: rot.y = π/2 − θ, rot.x = lat.
function rotForLatLng(lat: number, lng: number): { x: number; y: number } {
  const theta = (lng + 180) * DEG;
  return {
    x: Math.max(-1.3, Math.min(1.3, lat * DEG)),
    y: Math.PI / 2 - theta,
  };
}

// Shift `target` by ±2π so it is the nearest equivalent angle to `current`,
// avoiding a multi-turn spin when easing rotation.
function nearestAngle(target: number, current: number): number {
  let t = target;
  while (t - current > Math.PI) t -= 2 * Math.PI;
  while (t - current < -Math.PI) t += 2 * Math.PI;
  return t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function markerItemCount(feature: MarkerFeature): number {
  const groupedItems = (feature as MarkerFeature & { items?: unknown[] }).items;
  return Math.max(
    1,
    feature.itemCount ?? (Array.isArray(groupedItems) ? groupedItems.length : 1),
  );
}

interface LuxeGlobeMapProps {
  activeView?: GlobeViewMode;
  activeRegion?: RegionKey;
  activeSignalsRegion?: RegionKey;
  globalMarkers?: MarkerFeature[];
  signalsMarkers?: MarkerFeature[];
  globalMarkersLoading?: boolean;
  onMarkerClick?: (id: string, kind: MarkerKind, point?: { x: number; y: number }) => void;
  autoRotatePaused?: boolean;
  onGlobalMarkerRevealStart?: () => void;
  selectedGlobalId?: string | null;
  selectedSignalsId?: string | null;
}

interface Pin {
  el: HTMLDivElement;
  badgeEl: HTMLDivElement;
  lng: number;
  lat: number;
  kind: MarkerKind;
  itemCount: number;
}

// Country-name label (README_LABELS addendum). `dir` is the unit direction on
// the globe's local sphere (rotates with the group); `rank` is NE LABELRANK
// (lower = more important) used for LOD + declutter priority.
interface LabelItem {
  el: HTMLDivElement;
  dir: THREE.Vector3;
  rank: number;
  w: number;
  h: number;
  shown: boolean;
}

interface Engine {
  disposed: boolean;
  raf: number;
  rot: { x: number; y: number };
  drag: { x: number; y: number; samples: MotionSample[] } | null;
  pinch: {
    distance: number;
    centerX: number;
    centerY: number;
  } | null;
  inertia: {
    startRot: { x: number; y: number };
    targetRot: { x: number; y: number };
    startAt: number;
    durationMs: number;
  } | null;
  // Cursor-anchored zoom (MapLibre parity): the globe-local surface point under
  // the pointer when a wheel zoom began (`local`) plus the canvas-space pixel it
  // must stay pinned to (`sx`,`sy`). Active until the camera distance settles.
  zoomAnchor: { local: THREE.Vector3; sx: number; sy: number } | null;
  camZ: number;
  zoomTween: {
    startZ: number;
    targetZ: number;
    startAt: number;
    durationMs: number;
  } | null;
  wheelZoom: {
    active: boolean;
    type: WheelInputType | null;
    pendingDelta: number;
    lastValue: number;
    lastEventAt: number;
    classificationTimer: number | null;
    startZoom: number | null;
    targetZoom: number | null;
    ease: WheelEaseState | null;
  };
  W: number;
  H: number;
  geo: Feature<Geometry>[] | null;
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  group: THREE.Group | null;
  colorCtx: CanvasRenderingContext2D | null;
  ormCtx: CanvasRenderingContext2D | null;
  heightCtx: CanvasRenderingContext2D | null;
  // framing / motion targets
  targetRot: { x: number; y: number };
  framing: boolean;
  frameStartRot: { x: number; y: number };
  frameStartAt: number;
  frameDurationMs: number;
  frameEasing: (t: number) => number;
  pausedUntil: number;
  lastAutoAt: number | null;
  hardPaused: boolean;
  offsetX: number; // current group x-offset (world units)
  offsetXTarget: number;
  // markers
  pins: Map<string, Pin>;
  // country-name labels
  labels: LabelItem[];
  labelLayer: HTMLDivElement | null;
  onResize: (() => void) | null;
  cleanup: (() => void) | null;
  _reconcile?: () => void;
  _applyView?: (animated: boolean) => void;
}

function stopWheelZoom(eng: Engine, clearAnchor = true) {
  if (eng.wheelZoom.classificationTimer !== null) {
    window.clearTimeout(eng.wheelZoom.classificationTimer);
  }
  eng.wheelZoom = {
    active: false,
    type: null,
    pendingDelta: 0,
    lastValue: 0,
    lastEventAt: 0,
    classificationTimer: null,
    startZoom: null,
    targetZoom: null,
    ease: null,
  };
  if (clearAnchor) eng.zoomAnchor = null;
}

function startRotationFrame(
  eng: Engine,
  target: { x: number; y: number },
  durationMs: number,
  pauseMs: number,
  easing: (t: number) => number = easeOutCubic,
) {
  eng.frameStartRot = { ...eng.rot };
  eng.targetRot = target;
  eng.frameStartAt = performance.now();
  eng.frameDurationMs = durationMs;
  eng.frameEasing = easing;
  eng.framing = true;
  eng.inertia = null;
  stopWheelZoom(eng);
  eng.pausedUntil = performance.now() + pauseMs;
  eng.lastAutoAt = null;
}

function startCameraZoom(eng: Engine, targetZ: number, durationMs: number) {
  stopWheelZoom(eng);
  eng.camZ = clamp(targetZ, CAM_Z_MIN, CAM_Z_MAX);
  eng.zoomTween = {
    startZ: eng.camera?.position.z ?? eng.camZ,
    targetZ: eng.camZ,
    startAt: performance.now(),
    durationMs,
  };
}

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();
const TMP3 = new THREE.Vector3();
const NDC2 = new THREE.Vector2();
const RAYCASTER = new THREE.Raycaster();

export const LuxeGlobeMap = forwardRef<MapLibreGlobeHandle, LuxeGlobeMapProps>(
  function LuxeGlobeMap(props, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<HTMLDivElement>(null);
    const labelLayerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const propsRef = useRef(props);

    useEffect(() => {
      propsRef.current = props;
    });

    // ----- projection helper (used by handle + per-frame marker update) -----
    const projectPoint = (
      eng: Engine,
      lng: number,
      lat: number,
    ): { x: number; y: number; visible: boolean } | null => {
      const cam = eng.camera;
      const g = eng.group;
      if (!cam || !g) return null;
      // World matrices are refreshed once per frame (renderer.render +
      // the animate loop), so this hot per-marker path neither updates the
      // matrix nor allocates — it reuses shared temps.
      setLatLngVec(TMP, lat, lng, 1);
      g.localToWorld(TMP); // TMP = marker world position
      // occlusion: surface normal (from globe centre) vs direction to camera
      TMP2.copy(TMP).sub(g.position).normalize();
      TMP3.copy(cam.position).sub(TMP).normalize();
      const visible = TMP2.dot(TMP3) > 0.02;
      TMP.project(cam); // TMP → NDC in place (world value no longer needed)
      const x = (TMP.x * 0.5 + 0.5) * eng.W;
      const y = (-TMP.y * 0.5 + 0.5) * eng.H;
      return { x, y, visible };
    };

    useEffect(() => {
      const eng: Engine = {
        disposed: false,
        raf: 0,
        rot: { ...rotForLatLng(DEFAULT_CENTER[1], DEFAULT_CENTER[0]) },
        drag: null,
        pinch: null,
        inertia: null,
        zoomAnchor: null,
        camZ: CAM_Z_DEFAULT,
        zoomTween: null,
        wheelZoom: {
          active: false,
          type: null,
          pendingDelta: 0,
          lastValue: 0,
          lastEventAt: 0,
          classificationTimer: null,
          startZoom: null,
          targetZoom: null,
          ease: null,
        },
        W: 4096,
        H: 2048,
        geo: null,
        renderer: null,
        scene: null,
        camera: null,
        group: null,
        colorCtx: null,
        ormCtx: null,
        heightCtx: null,
        targetRot: { ...rotForLatLng(DEFAULT_CENTER[1], DEFAULT_CENTER[0]) },
        framing: false,
        frameStartRot: { ...rotForLatLng(DEFAULT_CENTER[1], DEFAULT_CENTER[0]) },
        frameStartAt: 0,
        frameDurationMs: VIEW_TRANSITION_MS,
        frameEasing: easeOutCubic,
        pausedUntil: 0,
        lastAutoAt: null,
        hardPaused: false,
        offsetX: 0,
        offsetXTarget: 0,
        pins: new Map(),
        labels: [],
        labelLayer: null,
        onResize: null,
        cleanup: null,
      };
      engineRef.current = eng;

      // texture resolution for the country canvases
      const TEX_W = 4096;
      const TEX_H = 2048;

      // ---- geometry → equirectangular path helpers (from Luxe design) ----
      const project = (lon: number, lat: number, w: number, h: number): [number, number] => [
        ((lon + 180) / 360) * w,
        ((90 - lat) / 180) * h,
      ];
      const ringSubpaths = (ring: Position[], w: number, h: number): [number, number][][] => {
        const subs: [number, number][][] = [];
        let cur: [number, number][] = [];
        let prevLon: number | null = null;
        for (const pt of ring) {
          const lon = pt[0];
          const lat = pt[1];
          if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
            if (cur.length) subs.push(cur);
            cur = [];
          }
          cur.push(project(lon, lat, w, h));
          prevLon = lon;
        }
        if (cur.length) subs.push(cur);
        return subs;
      };
      const polygons = (feat: Feature<Geometry>): Position[][][] => {
        const g = feat.geometry;
        if (!g) return [];
        if (g.type === "Polygon") return [g.coordinates];
        if (g.type === "MultiPolygon") return g.coordinates;
        return [];
      };
      const fillLand = (ctx: CanvasRenderingContext2D, fill: string, w: number, h: number) => {
        ctx.fillStyle = fill;
        for (const feat of eng.geo!) {
          for (const poly of polygons(feat)) {
            const path = new Path2D();
            for (const ring of poly) {
              for (const sub of ringSubpaths(ring, w, h)) {
                if (sub.length < 2) continue;
                path.moveTo(sub[0][0], sub[0][1]);
                for (let i = 1; i < sub.length; i++) path.lineTo(sub[i][0], sub[i][1]);
                path.closePath();
              }
            }
            ctx.fill(path, "evenodd");
          }
        }
      };
      const strokeBorders = (
        ctx: CanvasRenderingContext2D,
        color: string,
        width: number,
        w: number,
        h: number,
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (const feat of eng.geo!) {
          for (const poly of polygons(feat)) {
            for (const ring of poly) {
              const subs = ringSubpaths(ring, w, h);
              const closed = subs.length === 1;
              for (const sub of subs) {
                if (sub.length < 2) continue;
                ctx.beginPath();
                ctx.moveTo(sub[0][0], sub[0][1]);
                for (let i = 1; i < sub.length; i++) ctx.lineTo(sub[i][0], sub[i][1]);
                if (closed) ctx.closePath();
                ctx.stroke();
              }
            }
          }
        }
      };
      const drawColor = (ctx: CanvasRenderingContext2D) => {
        ctx.clearRect(0, 0, TEX_W, TEX_H);
        ctx.fillStyle = "#bf1626";
        ctx.fillRect(0, 0, TEX_W, TEX_H);
        const og = ctx.createLinearGradient(0, 0, 0, TEX_H);
        og.addColorStop(0, "rgba(10,2,4,0.6)");
        og.addColorStop(0.5, "rgba(0,0,0,0)");
        og.addColorStop(1, "rgba(10,2,4,0.6)");
        ctx.fillStyle = og;
        ctx.fillRect(0, 0, TEX_W, TEX_H);
        fillLand(ctx, "#070708", TEX_W, TEX_H);
        strokeBorders(ctx, "#ffffff", 1.0, TEX_W, TEX_H);
      };
      const drawHeight = (ctx: CanvasRenderingContext2D) => {
        ctx.clearRect(0, 0, TEX_W, TEX_H);
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, TEX_W, TEX_H);
        ctx.save();
        ctx.filter = "blur(13px)";
        fillLand(ctx, "#ffffff", TEX_W, TEX_H);
        ctx.restore();
      };
      const drawORM = (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = "rgb(0,87,41)";
        ctx.fillRect(0, 0, TEX_W, TEX_H);
        fillLand(ctx, "rgb(0,143,20)", TEX_W, TEX_H);
      };
      const buildEnv = (renderer: THREE.WebGLRenderer): THREE.Texture => {
        const c = document.createElement("canvas");
        c.width = 1024;
        c.height = 512;
        const ctx = c.getContext("2d")!;
        const g = ctx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0.0, "#d6dde6");
        g.addColorStop(0.18, "#646c76");
        g.addColorStop(0.32, "#262b31");
        g.addColorStop(0.52, "#13161a");
        g.addColorStop(0.78, "#0d0f12");
        g.addColorStop(1.0, "#07080a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1024, 512);
        const tex = new THREE.CanvasTexture(c);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const rt = pmrem.fromEquirectangular(tex);
        tex.dispose();
        pmrem.dispose();
        return rt.texture;
      };

      const pauseAuto = (ms: number) => {
        eng.pausedUntil = performance.now() + ms;
        eng.lastAutoAt = null;
      };

      const startZoomTween = (targetZ: number, durationMs: number) => {
        startCameraZoom(eng, targetZ, durationMs);
      };

      const startFrame = (
        target: { x: number; y: number },
        durationMs: number,
        pauseMs: number,
      ) => {
        startRotationFrame(eng, target, durationMs, pauseMs);
      };

      const bindControls = (dom: HTMLCanvasElement) => {
        const touchGesture = (touches: TouchList) => {
          const first = touches[0];
          const second = touches[1];
          return {
            distance: Math.hypot(
              second.clientX - first.clientX,
              second.clientY - first.clientY,
            ),
            centerX: (first.clientX + second.clientX) / 2,
            centerY: (first.clientY + second.clientY) / 2,
          };
        };

        const onDown = (e: MouseEvent | TouchEvent) => {
          stopWheelZoom(eng);
          if ("touches" in e && e.touches.length >= 2) {
            eng.pinch = touchGesture(e.touches);
            eng.drag = null;
            eng.inertia = null;
            eng.framing = false;
            eng.zoomAnchor = null;
            eng.lastAutoAt = null;
            e.preventDefault();
            return;
          }
          const p = "touches" in e ? e.touches[0] : e;
          eng.drag = { x: p.clientX, y: p.clientY, samples: [] };
          eng.pinch = null;
          eng.inertia = null;
          eng.framing = false;
          eng.zoomAnchor = null;
          eng.lastAutoAt = null;
          dom.style.cursor = "grabbing";
        };
        const onMove = (e: MouseEvent | TouchEvent) => {
          if ("touches" in e && e.touches.length >= 2) {
            const next = touchGesture(e.touches);
            if (eng.pinch && eng.camera) {
              const dx = next.centerX - eng.pinch.centerX;
              const dy = next.centerY - eng.pinch.centerY;
              const k = radiansPerPixel(
                eng.camera.position.z,
                eng.camera.fov * DEG,
                eng.H,
              );
              eng.rot.y += dx * k;
              eng.rot.x = clamp(eng.rot.x + dy * k, -1.3, 1.3);

              if (eng.pinch.distance > 0 && next.distance > 0) {
                const targetZoom = zoomForCameraDistance(
                  eng.camZ,
                  DEFAULT_MAP_ZOOM,
                  CAM_Z_DEFAULT,
                );
                const zoomDelta = Math.log2(
                  next.distance / eng.pinch.distance,
                );
                startZoomTween(
                  camZForMapZoom(targetZoom + zoomDelta),
                  0,
                );
              }
            }
            eng.pinch = next;
            eng.drag = null;
            pauseAuto(INTERACTION_IDLE_MS);
            e.preventDefault();
            return;
          }
          if (!eng.drag) return;
          const p = "touches" in e ? e.touches[0] : e;
          const dx = p.clientX - eng.drag.x;
          const dy = p.clientY - eng.drag.y;
          if (eng.drag.samples.length === 0 && Math.hypot(dx, dy) < 3) {
            return;
          }
          eng.drag.x = p.clientX;
          eng.drag.y = p.clientY;
          // Geographically-anchored drag (MapLibre parity): rotation-per-pixel
          // derived from the camera fov + viewport height so the grabbed point
          // tracks the cursor ~1:1 at any zoom / resolution. The previous fixed
          // 0.0016*camZ ran roughly 2x hot, which is what made the globe feel
          // twitchy and quick to "fling". depth ≈ camZ − 1 = the near surface.
          const cam = eng.camera;
          const k = cam
            ? radiansPerPixel(cam.position.z, cam.fov * DEG, eng.H)
            : 0.0016 * eng.camZ;
          eng.rot.y += dx * k;
          eng.rot.x = clamp(eng.rot.x + dy * k, -1.3, 1.3);
          // Low-pass the inertia seed: blend recent motion rather than taking a
          // single frame's delta, so one fast frame can't fling the globe.
          const now = performance.now();
          eng.drag.samples.push({ x: dx, y: dy, time: now });
          eng.drag.samples = trimMotionSamples(eng.drag.samples, now);
          e.preventDefault();
        };
        const onUp = (e?: MouseEvent | TouchEvent) => {
          if (e && "touches" in e && e.touches.length === 1) {
            const touch = e.touches[0];
            eng.pinch = null;
            eng.drag = {
              x: touch.clientX,
              y: touch.clientY,
              samples: [],
            };
            pauseAuto(INTERACTION_IDLE_MS);
            return;
          }
          if (eng.drag) {
            // Bound the inertia so a flick can't send the globe spinning —
            // MapLibre's drag inertia is gentle and capped.
            const inertia = calculatePanInertia(eng.drag.samples);
            const cam = eng.camera;
            if (inertia && cam) {
              const k = radiansPerPixel(
                cam.position.z,
                cam.fov * DEG,
                eng.H,
              );
              eng.inertia = {
                startRot: { ...eng.rot },
                targetRot: {
                  x: clamp(eng.rot.x + inertia.y * k, -1.3, 1.3),
                  y: eng.rot.y + inertia.x * k,
                },
                startAt: performance.now(),
                durationMs: inertia.durationMs,
              };
            }
            pauseAuto(INTERACTION_IDLE_MS);
          }
          eng.drag = null;
          eng.pinch = null;
          dom.style.cursor = "grab";
        };
        const captureWheelAnchor = (e: WheelEvent) => {
          const cam = eng.camera;
          const g = eng.group;
          if (!cam || !g) return;
          const rect = dom.getBoundingClientRect();
          NDC2.set(
            ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
            -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
          );
          RAYCASTER.setFromCamera(NDC2, cam);
          const o = RAYCASTER.ray.origin;
          const d = RAYCASTER.ray.direction;
          const ocx = o.x - g.position.x;
          const ocy = o.y - g.position.y;
          const ocz = o.z - g.position.z;
          const b = ocx * d.x + ocy * d.y + ocz * d.z;
          const c = ocx * ocx + ocy * ocy + ocz * ocz - 1;
          const disc = b * b - c;
          const t = disc >= 0 ? -b - Math.sqrt(disc) : -1;
          if (t > 0) {
            const hit = new THREE.Vector3(
              o.x + d.x * t,
              o.y + d.y * t,
              o.z + d.z * t,
            );
            eng.zoomAnchor = {
              local: g.worldToLocal(hit),
              sx: e.clientX - rect.left,
              sy: e.clientY - rect.top,
            };
          } else {
            eng.zoomAnchor = null;
          }
        };

        const queueWheelDelta = (
          delta: number,
          type: WheelInputType,
          eventAt: number,
        ) => {
          const wheel = eng.wheelZoom;
          if (!wheel.active) {
            const currentDistance = eng.camera?.position.z ?? eng.camZ;
            const currentZoom = zoomForCameraDistance(
              currentDistance,
              DEFAULT_MAP_ZOOM,
              CAM_Z_DEFAULT,
            );
            wheel.active = true;
            wheel.startZoom = currentZoom;
            wheel.targetZoom = currentZoom;
            wheel.ease = null;
            eng.zoomTween = null;
          }
          wheel.type = type;
          wheel.pendingDelta += delta;
          wheel.lastEventAt = eventAt;
        };

        const onWheel = (e: WheelEvent) => {
          const now = performance.now();
          const wheel = eng.wheelZoom;
          const delta = normalizeWheelDelta(e);
          const timeDelta = now - (wheel.lastEventAt || 0);

          if (!wheel.active && wheel.classificationTimer === null) {
            captureWheelAnchor(e);
          }

          const type = classifyWheelInput(delta, timeDelta, wheel.type);
          wheel.lastEventAt = now;

          if (type === null) {
            wheel.lastValue = delta;
            if (wheel.classificationTimer !== null) {
              window.clearTimeout(wheel.classificationTimer);
            }
            wheel.classificationTimer = window.setTimeout(() => {
              wheel.classificationTimer = null;
              queueWheelDelta(wheel.lastValue, "wheel", wheel.lastEventAt);
              wheel.lastValue = 0;
            }, WHEEL_CLASSIFICATION_DELAY_MS);
          } else {
            let resolvedDelta = delta;
            if (wheel.classificationTimer !== null) {
              window.clearTimeout(wheel.classificationTimer);
              wheel.classificationTimer = null;
              resolvedDelta += wheel.lastValue;
              wheel.lastValue = 0;
            }
            queueWheelDelta(resolvedDelta, type, now);
          }

          pauseAuto(INTERACTION_IDLE_MS);
          e.preventDefault();
        };
        dom.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove, { passive: false });
        window.addEventListener("mouseup", onUp);
        dom.addEventListener("touchstart", onDown, { passive: false });
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onUp);
        window.addEventListener("touchcancel", onUp);
        dom.addEventListener("wheel", onWheel, { passive: false });
        eng.cleanup = () => {
          dom.removeEventListener("mousedown", onDown);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          dom.removeEventListener("touchstart", onDown);
          window.removeEventListener("touchmove", onMove);
          window.removeEventListener("touchend", onUp);
          window.removeEventListener("touchcancel", onUp);
          dom.removeEventListener("wheel", onWheel);
          stopWheelZoom(eng);
        };
      };

      // world units per screen pixel at the globe centre (z=0 plane).
      const worldPerPixel = (): number => {
        const cam = eng.camera!;
        const visH = 2 * Math.tan((cam.fov * DEG) / 2) * cam.position.z;
        return visH / Math.max(1, eng.H);
      };

      // ---- country-name label layer (README_LABELS addendum) ------------
      // Adds ONLY a DOM label overlay over the WebGL globe — no change to the
      // material / colour texture / lighting. Logic mirrors the design file:
      // NAME_TR from Natural Earth admin_0, 3D placement matching the sphere
      // texture, back-face cull + edge fade, LABELRANK-based LOD, declutter.
      const LABEL_BASE =
        "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/";

      // Bounding-box centre of the feature's largest ring (label fallback when
      // the curated LABEL_X / LABEL_Y anchor is missing).
      const featCenter = (feat: Feature<Geometry>): [number, number] | null => {
        const polys = polygons(feat);
        let best: Position[] | null = null;
        let bestLen = -1;
        for (const poly of polys) {
          const ring = poly[0];
          if (ring && ring.length > bestLen) {
            bestLen = ring.length;
            best = ring;
          }
        }
        if (!best) return null;
        let minX = 1e9;
        let maxX = -1e9;
        let minY = 1e9;
        let maxY = -1e9;
        for (const p of best) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        }
        return [(minX + maxX) / 2, (minY + maxY) / 2];
      };

      const addLabel = (text: string, lat: number, lon: number, rank: number) => {
        if (!eng.labelLayer) return;
        const el = document.createElement("div");
        el.className = "g-country";
        el.textContent = text;
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.opacity = "0";
        // Length-based font scaling: long names (e.g. BOSNA-HERSEK, KUZEY
        // MAKEDONYA) shrink so their box is narrower and crowded neighbours
        // (e.g. SIRBISTAN) still fit. Names up to 9 chars stay at full 8px.
        const len = text.length;
        const fontPx = Math.max(5.5, Math.min(8, 8 - (len - 9) * 0.45));
        el.style.fontSize = `${fontPx}px`;
        eng.labelLayer.appendChild(el);
        const dir = latLngToVector3(lat, lon, 1).normalize();
        const adv = fontPx * 0.58 + 0.4; // ≈ glyph advance at this font size
        eng.labels.push({
          el,
          dir,
          rank: isNaN(rank) ? 5 : rank,
          w: len * adv,
          h: fontPx + 2,
          shown: false,
        });
      };

      const loadLabels = () => {
        // Production note (per README): vendor this GeoJSON locally instead of
        // hot-linking jsDelivr. Kept as-is here to match the handoff exactly.
        fetch(LABEL_BASE + "ne_110m_admin_0_countries.geojson")
          .then((r) => r.json())
          .then((fc: FeatureCollection) => {
            if (eng.disposed || !fc || !fc.features) return;
            for (const f of fc.features) {
              const p = (f.properties ?? {}) as Record<string, unknown>;
              const name = (p.NAME_TR || p.NAME || p.ADMIN || p.name) as
                | string
                | undefined;
              if (!name) continue;
              let lon = p.LABEL_X != null ? Number(p.LABEL_X) : null;
              let lat = p.LABEL_Y != null ? Number(p.LABEL_Y) : null;
              if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) {
                const c = featCenter(f as Feature<Geometry>);
                if (!c) continue;
                lon = c[0];
                lat = c[1];
              }
              let rank = Number(p.LABELRANK);
              if (isNaN(rank)) rank = 5;
              addLabel(String(name).toUpperCase(), lat, lon, rank);
            }
            // Sort once by rank so the per-frame declutter pass can place
            // highest-priority labels first without re-sorting every frame.
            eng.labels.sort((a, b) => a.rank - b.rank);
          })
          .catch((err) => console.warn("country labels failed", err));
      };

      const labelNormal = new THREE.Vector3();
      const labelToCam = new THREE.Vector3();
      const labelWP = new THREE.Vector3();
      // Pooled declutter scratch — placed label boxes for the current frame,
      // reused so the per-frame label pass allocates nothing.
      const labelPlaced: { x: number; y: number; w: number; h: number }[] = [];

      const updateLabels = () => {
        const cam = eng.camera;
        const g = eng.group;
        if (!cam || !g || !eng.labels.length) return;
        // World matrix is already current (renderer.render refreshed it this
        // frame), so no per-call updateMatrixWorld here.
        const W = eng.W;
        const H = eng.H;
        // Zoom-based LOD: far view (t→1) shows only major countries; zooming in
        // (t→0) raises maxRank so more countries become eligible.
        const t = Math.max(
          0,
          Math.min(1, (eng.camZ - CAM_Z_MIN) / (CAM_Z_MAX - CAM_Z_MIN)),
        );
        // Zoom-in (t→0) reveals all ranks (incl. small countries, rank 9–12);
        // zoom-out (t→1) keeps only majors. Overlap is handled by the declutter
        // pass below, so a generous ceiling here is safe.
        const maxRank = Math.round(12 - 9 * t);
        // Hide labels nearer the limb when zoomed out (Central View): a higher
        // facing threshold keeps names off the globe's silhouette so they don't
        // stick out / clip at the edge. Zoomed in (t→0) it relaxes to the
        // design's original 0.14 since the limb is mostly off-screen anyway.
        const facingMin = 0.14 + 0.2 * t;
        const hide = (L: LabelItem) => {
          if (L.shown) {
            L.el.style.opacity = "0";
            L.shown = false;
          }
        };

        // Single allocation-free pass. eng.labels is pre-sorted by rank
        // (ascending) at load time, so iterating in order already places
        // highest-priority names first for the declutter check — no per-frame
        // candidate array, sort, or projection clone.
        let placedCount = 0;
        for (const L of eng.labels) {
          if (L.rank > maxRank) {
            hide(L);
            continue;
          }
          // surface point lifted slightly off the sphere, in world space
          labelWP.copy(L.dir).multiplyScalar(1.012);
          g.localToWorld(labelWP);
          labelNormal.copy(labelWP).sub(g.position).normalize();
          labelToCam.copy(cam.position).sub(labelWP).normalize();
          const facing = labelNormal.dot(labelToCam);
          if (facing <= facingMin) {
            hide(L);
            continue;
          }
          labelWP.project(cam); // → NDC in place (world value no longer needed)
          const sx = (labelWP.x * 0.5 + 0.5) * W;
          const sy = (-labelWP.y * 0.5 + 0.5) * H;
          // Drop labels whose text box would spill past the viewport edges so
          // nothing overflows / gets half-clipped.
          if (
            sx - L.w / 2 < 2 ||
            sx + L.w / 2 > W - 2 ||
            sy - L.h / 2 < 2 ||
            sy + L.h / 2 > H - 2
          ) {
            hide(L);
            continue;
          }
          // Declutter: skip any label whose box overlaps an already-placed one.
          const x0 = sx - L.w / 2;
          const y0 = sy - L.h / 2;
          let clash = false;
          for (let i = 0; i < placedCount; i++) {
            const r = labelPlaced[i];
            if (
              x0 < r.x + r.w + 1 &&
              x0 + L.w + 1 > r.x &&
              y0 < r.y + r.h + 1 &&
              y0 + L.h + 1 > r.y
            ) {
              clash = true;
              break;
            }
          }
          if (clash) {
            hide(L);
            continue;
          }
          let slot = labelPlaced[placedCount];
          if (!slot) {
            slot = { x: 0, y: 0, w: 0, h: 0 };
            labelPlaced[placedCount] = slot;
          }
          slot.x = x0;
          slot.y = y0;
          slot.w = L.w;
          slot.h = L.h;
          placedCount++;
          const fade = Math.min(1, (facing - facingMin) / 0.22);
          L.el.style.transform = `translate(-50%,-50%) translate(${sx.toFixed(
            1,
          )}px,${sy.toFixed(1)}px)`;
          L.el.style.opacity = fade.toFixed(2);
          L.shown = true;
        }
      };

      const updateMarkers = () => {
        const cam = eng.camera;
        if (!cam) return;
        const view = propsRef.current.activeView ?? "situation";
        const selGlobal = propsRef.current.selectedGlobalId ?? null;
        const selSignals = propsRef.current.selectedSignalsId ?? null;
        for (const [id, pin] of eng.pins) {
          const layerVisible =
            (pin.kind === "global" && view === "global") ||
            (pin.kind === "signals" && view === "signals");
          if (!layerVisible) {
            pin.el.style.display = "none";
            continue;
          }
          const p = projectPoint(eng, pin.lng, pin.lat);
          if (!p || !p.visible || p.x < -40 || p.x > eng.W + 40 || p.y < -40 || p.y > eng.H + 40) {
            pin.el.style.display = "none";
            continue;
          }
          const selected = pin.kind === "global" ? id === selGlobal : id === selSignals;
          pin.el.style.display = "block";
          pin.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
          pin.el.style.zIndex = selected ? "3" : "2";
          stylePin(pin, selected);
        }
      };

      const animate = () => {
        if (eng.disposed) return;
        eng.raf = requestAnimationFrame(animate);
        const now = performance.now();
        const wheel = eng.wheelZoom;

        if (eng.camera && wheel.active) {
          if (wheel.pendingDelta !== 0 && wheel.type) {
            const currentZoom = zoomForCameraDistance(
              eng.camera.position.z,
              DEFAULT_MAP_ZOOM,
              CAM_Z_DEFAULT,
            );
            const baseTarget = wheel.targetZoom ?? currentZoom;
            const targetDistance = camZForMapZoom(
              baseTarget +
                wheelDeltaToZoomDelta(wheel.pendingDelta, wheel.type),
            );
            wheel.targetZoom = zoomForCameraDistance(
              targetDistance,
              DEFAULT_MAP_ZOOM,
              CAM_Z_DEFAULT,
            );
            eng.camZ = targetDistance;
            wheel.pendingDelta = 0;

            if (wheel.type === "wheel") {
              wheel.startZoom = currentZoom;
              wheel.ease = createContinuousWheelEasing(wheel.ease, now);
            } else {
              eng.camera.position.z = targetDistance;
              wheel.startZoom = wheel.targetZoom;
              wheel.ease = null;
            }
          }

          if (
            wheel.type === "wheel" &&
            wheel.startZoom !== null &&
            wheel.targetZoom !== null &&
            wheel.ease
          ) {
            const t = Math.min(
              1,
              (now -
                wheel.lastEventAt +
                WHEEL_ZOOM_TIME_ADJUSTMENT_MS) /
                WHEEL_ZOOM_EASE_MS,
            );
            const eased = wheel.ease.easing(t);
            const zoom =
              wheel.startZoom +
              (wheel.targetZoom - wheel.startZoom) * eased;
            eng.camera.position.z = camZForMapZoom(zoom);
            if (
              t >= 1 &&
              now - wheel.lastEventAt >= WHEEL_ZOOM_EASE_MS + 16
            ) {
              stopWheelZoom(eng);
            }
          } else if (
            wheel.type === "trackpad" &&
            now - wheel.lastEventAt >= WHEEL_ZOOM_EASE_MS + 16
          ) {
            stopWheelZoom(eng);
          }
        }

        const renderingSuspended =
          eng.hardPaused &&
          !eng.drag &&
          !eng.pinch &&
          !eng.framing &&
          eng.inertia === null &&
          eng.zoomTween === null &&
          !eng.wheelZoom.active &&
          eng.zoomAnchor === null;
        if (renderingSuspended) {
          eng.lastAutoAt = null;
          return;
        }
        const auto =
          !eng.drag &&
          !eng.pinch &&
          !eng.framing &&
          eng.inertia === null &&
          eng.zoomTween === null &&
          !eng.wheelZoom.active &&
          !eng.hardPaused &&
          !(
            propsRef.current.activeView === "global" &&
            propsRef.current.globalMarkersLoading
          ) &&
          now > eng.pausedUntil;
        if (!auto) {
          eng.lastAutoAt = null;
        } else if (eng.lastAutoAt === null) {
          eng.lastAutoAt = now;
        } else {
          const dtSeconds = Math.min(
            (now - eng.lastAutoAt) / 1000,
            AUTO_ROTATE_MAX_DT_S,
          );
          eng.lastAutoAt = now;
          if (dtSeconds > 0) {
            eng.rot.y -= AUTO_ROTATE_DEG_PER_SEC * DEG * dtSeconds;
          }
        }

        if (eng.framing) {
          const t = Math.min(
            1,
            (now - eng.frameStartAt) / Math.max(1, eng.frameDurationMs),
          );
          const eased = eng.frameEasing(t);
          eng.rot.y =
            eng.frameStartRot.y +
            (eng.targetRot.y - eng.frameStartRot.y) * eased;
          eng.rot.x =
            eng.frameStartRot.x +
            (eng.targetRot.x - eng.frameStartRot.x) * eased;
          if (t >= 1) {
            eng.rot.y = eng.targetRot.y;
            eng.rot.x = eng.targetRot.x;
            eng.framing = false;
          }
        } else if (eng.inertia && !eng.drag) {
          const t = Math.min(
            1,
            (now - eng.inertia.startAt) /
              Math.max(1, eng.inertia.durationMs),
          );
          const eased = panInertiaEase(t);
          eng.rot.y =
            eng.inertia.startRot.y +
            (eng.inertia.targetRot.y - eng.inertia.startRot.y) * eased;
          eng.rot.x =
            eng.inertia.startRot.x +
            (eng.inertia.targetRot.x - eng.inertia.startRot.x) * eased;
          if (t >= 1) {
            eng.rot = { ...eng.inertia.targetRot };
            eng.inertia = null;
          }
        }

        if (eng.group) {
          eng.group.rotation.y = eng.rot.y;
          eng.group.rotation.x = eng.rot.x;
          eng.offsetX += (eng.offsetXTarget - eng.offsetX) * 0.1;
          eng.group.position.x = eng.offsetX;
        }
        if (eng.camera && eng.zoomTween) {
          const t = Math.min(
            1,
            (now - eng.zoomTween.startAt) /
              Math.max(1, eng.zoomTween.durationMs),
          );
          const eased = mapEase(t);
          eng.camera.position.z =
            eng.zoomTween.startZ +
            (eng.zoomTween.targetZ - eng.zoomTween.startZ) * eased;
          if (t >= 1) {
            eng.camera.position.z = eng.zoomTween.targetZ;
            eng.zoomTween = null;
          }
        } else if (eng.camera && !eng.wheelZoom.active) {
          eng.camera.position.z = eng.camZ;
        }

        // Cursor-anchored zoom correction: nudge the globe each frame so the
        // pointed-at surface point stays under the cursor while the camera
        // distance eases — this is what makes wheel zoom track the pointer like
        // MapLibre instead of zooming toward the globe centre. The screen-pixel
        // → rotation gain mirrors the drag mapping; it self-corrects over frames.
        if (eng.zoomAnchor && eng.group && eng.camera) {
          const g = eng.group;
          const cam = eng.camera;
          g.updateMatrixWorld();
          const wp = TMP.copy(eng.zoomAnchor.local);
          g.localToWorld(wp);
          const depth = Math.max(0.1, cam.position.z - wp.z);
          const ndc = wp.project(cam);
          const curX = (ndc.x * 0.5 + 0.5) * eng.W;
          const curY = (-ndc.y * 0.5 + 0.5) * eng.H;
          // Gain uses the anchor's true camera→surface depth (not the globe
          // centre distance), so a one-shot correction lands without the
          // overshoot/oscillation that made the zoom look jagged.
          const k =
            ((2 * Math.tan((cam.fov * DEG) / 2)) / Math.max(1, eng.H)) * depth;
          eng.rot.y += (eng.zoomAnchor.sx - curX) * k;
          eng.rot.x = Math.max(
            -1.3,
            Math.min(1.3, eng.rot.x + (eng.zoomAnchor.sy - curY) * k),
          );
          g.rotation.y = eng.rot.y;
          g.rotation.x = eng.rot.x;
          // Done once the camera distance has reached the target.
          if (eng.zoomTween === null && !eng.wheelZoom.active) {
            eng.zoomAnchor = null;
          }
        }

        eng.renderer!.render(eng.scene!, eng.camera!);
        updateMarkers();
        updateLabels();
      };

      const applyView = (animated: boolean) => {
        const view = propsRef.current.activeView ?? "situation";
        const wpp = worldPerPixel();
        const fr = VIEW_FRAMING[view];
        eng.offsetXTarget = ((fr.left - fr.right) / 2) * wpp;

        let center = DEFAULT_CENTER;
        let zoom = DEFAULT_MAP_ZOOM;
        if (view === "global" && propsRef.current.activeRegion) {
          const r = REGION_GLOBE_VIEWS[propsRef.current.activeRegion];
          center = r.center;
          zoom = r.zoom;
        } else if (view === "signals" && propsRef.current.activeSignalsRegion) {
          const r = REGION_GLOBE_VIEWS[propsRef.current.activeSignalsRegion];
          center = r.center;
          zoom = r.zoom;
        }
        const tr = rotForLatLng(center[1], center[0]);
        tr.y = nearestAngle(tr.y, eng.rot.y);
        eng.camZ = camZForMapZoom(zoom);
        if (animated) {
          startZoomTween(eng.camZ, VIEW_TRANSITION_MS);
          startFrame(
            tr,
            VIEW_TRANSITION_MS,
            VIEW_TRANSITION_MS + CENTRAL_VIEW_IDLE_DELAY_MS,
          );
        } else {
          eng.rot = { ...tr };
          eng.offsetX = eng.offsetXTarget;
        }
      };
      eng._applyView = applyView;

      const init = () => {
        const mount = mountRef.current;
        if (!mount) return;
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        eng.W = w;
        eng.H = h;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.domElement.style.display = "block";
        renderer.domElement.style.cursor = "grab";
        mount.appendChild(renderer.domElement);
        eng.renderer = renderer;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
        camera.position.set(0, 0, eng.camZ);
        eng.scene = scene;
        eng.camera = camera;
        scene.environment = buildEnv(renderer);

        const cc = document.createElement("canvas");
        cc.width = TEX_W;
        cc.height = TEX_H;
        eng.colorCtx = cc.getContext("2d");
        const oc = document.createElement("canvas");
        oc.width = TEX_W;
        oc.height = TEX_H;
        eng.ormCtx = oc.getContext("2d");
        const hc = document.createElement("canvas");
        hc.width = TEX_W;
        hc.height = TEX_H;
        eng.heightCtx = hc.getContext("2d");
        drawColor(eng.colorCtx!);
        drawORM(eng.ormCtx!);
        drawHeight(eng.heightCtx!);

        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        const colorTex = new THREE.CanvasTexture(cc);
        colorTex.encoding = THREE.sRGBEncoding;
        colorTex.anisotropy = maxAniso;
        const ormTex = new THREE.CanvasTexture(oc);
        ormTex.anisotropy = maxAniso;
        const heightTex = new THREE.CanvasTexture(hc);
        heightTex.anisotropy = maxAniso;

        const mat = new THREE.MeshPhysicalMaterial({
          map: colorTex,
          metalnessMap: ormTex,
          roughnessMap: ormTex,
          metalness: 1.0,
          roughness: 1.0,
          bumpMap: heightTex,
          bumpScale: 0.03,
          clearcoat: 1.0,
          clearcoatRoughness: 0.5,
          envMapIntensity: 0.62,
          reflectivity: 0.36,
        });
        const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat);
        const group = new THREE.Group();
        group.add(globe);
        scene.add(group);
        eng.group = group;

        scene.add(new THREE.HemisphereLight(0xbdb0b2, 0x0a0506, 0.34));
        scene.add(new THREE.AmbientLight(0x141a22, 0.18));

        bindControls(renderer.domElement);

        eng.onResize = () => {
          const ww = mount.clientWidth || window.innerWidth;
          const hh = mount.clientHeight || window.innerHeight;
          eng.W = ww;
          eng.H = hh;
          camera.aspect = ww / hh;
          camera.updateProjectionMatrix();
          renderer.setSize(ww, hh);
        };
        window.addEventListener("resize", eng.onResize);

        eng.labelLayer = labelLayerRef.current;
        loadLabels();

        applyView(false); // first paint: jump to framing, no spin
        reconcilePins();
        animate();
      };

      // ---- markers DOM reconciliation -----------------------------------
      const makePinEl = (
        kind: MarkerKind,
      ): { el: HTMLDivElement; badgeEl: HTMLDivElement } => {
        const el = document.createElement("div");
        el.className = "luxe-marker";
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.style.willChange = "transform";
        el.dataset.kind = kind;

        const bloom = document.createElement("div");
        bloom.className = "luxe-marker-bloom";
        const glow = document.createElement("div");
        glow.className = "luxe-marker-glow";
        const hoverGlow = document.createElement("div");
        hoverGlow.className = "luxe-marker-hover-glow";

        const icon = document.createElement("img");
        icon.className = "luxe-marker-pin-icon";
        icon.alt = "";
        icon.draggable = false;
        icon.src = kind === "global" ? GLOBAL_PIN_SVG_URL : PIN_SVG_URL;

        const badgeEl = document.createElement("div");
        badgeEl.className = "luxe-marker-badge";

        el.appendChild(bloom);
        el.appendChild(glow);
        el.appendChild(hoverGlow);
        el.appendChild(icon);
        el.appendChild(badgeEl);
        return { el, badgeEl };
      };

      const reconcilePins = () => {
        const container = markersRef.current;
        if (!container) return;
        const next = new Map<string, MarkerFeature & { kind: MarkerKind }>();
        for (const m of propsRef.current.globalMarkers ?? [])
          next.set(`g:${m.id}`, { ...m, kind: "global" });
        for (const m of propsRef.current.signalsMarkers ?? [])
          next.set(`s:${m.id}`, { ...m, kind: "signals" });

        // remove stale
        for (const [key, pin] of eng.pins) {
          if (!next.has(key)) {
            pin.el.remove();
            eng.pins.delete(key);
          }
        }
        // add / update
        for (const [key, m] of next) {
          let pin = eng.pins.get(key);
          const itemCount = markerItemCount(m);
          if (!pin) {
            const { el, badgeEl } = makePinEl(m.kind);
            const rawId = m.id;
            const kind = m.kind;
            pin = {
              el,
              badgeEl,
              lng: m.lng,
              lat: m.lat,
              kind: m.kind,
              itemCount,
            };
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              eng.group?.updateMatrixWorld();
              const p = projectPoint(eng, pin!.lng, pin!.lat);
              propsRef.current.onMarkerClick?.(
                rawId,
                kind,
                p ? { x: p.x, y: p.y } : undefined,
              );
            });
            container.appendChild(el);
            eng.pins.set(key, pin);
          } else {
            pin.lng = m.lng;
            pin.lat = m.lat;
            pin.itemCount = itemCount;
          }
        }
      };
      eng._reconcile = reconcilePins;

      // ---- load country geometry, then init -----------------------------
      fetch("/countries-50m.json")
        .then((r) => r.json())
        .then((topo) => {
          if (eng.disposed) return;
          const fc = feature(topo, topo.objects.countries) as unknown as {
            features: Feature<Geometry>[];
          };
          eng.geo = fc.features;
          init();
        })
        .catch((err) => console.warn("globe data load failed", err));

      return () => {
        eng.disposed = true;
        cancelAnimationFrame(eng.raf);
        if (eng.onResize) window.removeEventListener("resize", eng.onResize);
        if (eng.cleanup) eng.cleanup();
        for (const pin of eng.pins.values()) pin.el.remove();
        eng.pins.clear();
        for (const l of eng.labels) l.el.remove();
        eng.labels.length = 0;
        eng.labelLayer = null;
        if (eng.renderer) {
          eng.renderer.dispose();
          const el = eng.renderer.domElement;
          if (el && el.parentNode) el.parentNode.removeChild(el);
        }
        engineRef.current = null;
      };
    }, []);

    // Rebuild marker DOM when marker data changes.
    useEffect(() => {
      engineRef.current?._reconcile?.();
    }, [props.globalMarkers, props.signalsMarkers]);

    // Re-frame when view / region changes. The initial framing is applied
    // synchronously inside init(); this effect animates subsequent changes.
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng || !eng.camera) return;
      eng._applyView?.(true);
    }, [props.activeView, props.activeRegion, props.activeSignalsRegion]);

    // hard pause flag from prop
    useEffect(() => {
      const eng = engineRef.current;
      if (eng) {
        eng.hardPaused = props.autoRotatePaused ?? false;
        eng.lastAutoAt = null;
      }
    }, [props.autoRotatePaused]);

    // ----- imperative handle (matches MapLibreGlobeHandle) -----
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const eng = engineRef.current;
          if (!eng) return;
          // camZ *= 2^(-0.75): same proportional step as MapLibre zoomTo(+0.75).
          startCameraZoom(
            eng,
            eng.camZ * Math.pow(2, -MAP_ZOOM_STEP),
            BUTTON_ZOOM_ANIM_MS,
          );
          eng.pausedUntil = performance.now() + INTERACTION_IDLE_MS;
          eng.lastAutoAt = null;
        },
        zoomOut: () => {
          const eng = engineRef.current;
          if (!eng) return;
          // camZ *= 2^(+0.75): same proportional step as MapLibre zoomTo(-0.75).
          startCameraZoom(
            eng,
            eng.camZ * Math.pow(2, MAP_ZOOM_STEP),
            BUTTON_ZOOM_ANIM_MS,
          );
          eng.pausedUntil = performance.now() + INTERACTION_IDLE_MS;
          eng.lastAutoAt = null;
        },
        projectMarker: (lng: number, lat: number) => {
          const eng = engineRef.current;
          if (!eng || !eng.camera || !eng.group) return null;
          eng.group.updateMatrixWorld();
          const p = projectPoint(eng, lng, lat);
          return p ? { x: p.x, y: p.y } : null;
        },
        setAutoRotatePaused: (paused: boolean) => {
          const eng = engineRef.current;
          if (eng) {
            eng.hardPaused = paused;
            eng.lastAutoAt = null;
          }
        },
        centerView: () => {
          const eng = engineRef.current;
          if (!eng) return;
          const tr = rotForLatLng(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
          tr.y = nearestAngle(tr.y, eng.rot.y);
          startCameraZoom(eng, CAM_Z_DEFAULT, CENTRAL_VIEW_ANIM_MS);
          startRotationFrame(
            eng,
            tr,
            CENTRAL_VIEW_ANIM_MS,
            CENTRAL_VIEW_ANIM_MS + CENTRAL_VIEW_IDLE_DELAY_MS,
          );
        },
        focusMarker: (lng: number, lat: number) => {
          const eng = engineRef.current;
          if (!eng) return;
          const tr = rotForLatLng(lat, lng);
          tr.y = nearestAngle(tr.y, eng.rot.y);
          startRotationFrame(
            eng,
            tr,
            FOCUS_MARKER_ANIM_MS,
            INTERACTION_IDLE_MS,
            easeInOutCubic,
          );
        },
      }),
      [],
    );

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 95% at 50% 42%, #181b20 0%, #0d0f12 46%, #08090b 74%, #050608 100%)",
        }}
      >
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
        <div ref={markersRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div
          ref={labelLayerRef}
          className="g-label-layer"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(75% 70% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <style>{`
          .g-country {
            font: 500 8px/1 'Helvetica Neue', Arial, sans-serif;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.72);
            text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7);
            white-space: nowrap;
            pointer-events: none;
            will-change: opacity, transform;
            transition: opacity 0.22s ease;
          }
          .luxe-marker {
            --pin-w: 24px;
            --pin-h: 34px;
            --glow-offset: 11px;
            --bloom-color: #a80d18;
            --bloom-opacity: 0.45;
            --glow-size: 20px;
            --glow-fill: rgba(168,13,24,0.34);
            --glow-opacity: 0.7;
            --glow-stroke-width: 2.5px;
            --glow-stroke-opacity: 1;
            width: var(--pin-w);
            height: var(--pin-h);
            user-select: none;
            transform-origin: 50% 100%;
            transition: width .18s ease, height .18s ease, filter .18s ease;
            filter: drop-shadow(0 3px 5px rgba(0,0,0,0.44));
          }
          .luxe-marker[data-kind="global"] {
            --pin-w: 22.4px;
            --pin-h: 27.2px;
            --glow-offset: 16px;
            --bloom-color: #6f0710;
            --bloom-opacity: 0.24;
            --glow-size: 22px;
            --glow-fill: rgba(168,13,24,0.22);
            --glow-opacity: 0.42;
            --glow-stroke-width: 1.2px;
            --glow-stroke-opacity: 0.68;
          }
          .luxe-marker:not([data-selected="true"]):hover {
            filter: drop-shadow(0 4px 7px rgba(0,0,0,0.48));
          }
          .luxe-marker[data-kind="global"]:not([data-selected="true"]):hover {
            --pin-w: 24.08px;
            --pin-h: 29.24px;
          }
          .luxe-marker[data-kind="signals"]:not([data-selected="true"]):hover {
            --pin-w: 25.2px;
            --pin-h: 35.7px;
          }
          .luxe-marker[data-kind="global"][data-selected="true"] {
            --pin-w: 26.32px;
            --pin-h: 31.96px;
          }
          .luxe-marker[data-kind="signals"][data-selected="true"] {
            --pin-w: 34.8px;
            --pin-h: 49.3px;
          }
          .luxe-marker-pin-icon {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 3;
          }
          .luxe-marker-bloom,
          .luxe-marker-glow,
          .luxe-marker-hover-glow {
            position: absolute;
            left: 50%;
            top: calc(100% - var(--glow-offset));
            border-radius: 999px;
            pointer-events: none;
            transform: translate(-50%, -50%);
            transition: opacity .18s ease, width .18s ease, height .18s ease;
          }
          .luxe-marker-bloom {
            width: 44px;
            height: 44px;
            background: var(--bloom-color);
            filter: blur(15px);
            opacity: 0;
            z-index: 0;
          }
          .luxe-marker-glow {
            width: var(--glow-size);
            height: var(--glow-size);
            background: var(--glow-fill);
            border: var(--glow-stroke-width) solid #a80d18;
            opacity: 0;
            z-index: 1;
          }
          .luxe-marker-hover-glow {
            width: 30px;
            height: 30px;
            background: #a80d18;
            filter: blur(10px);
            opacity: 0;
            z-index: 2;
          }
          .luxe-marker:not([data-selected="true"]):hover .luxe-marker-hover-glow {
            opacity: 0.24;
          }
          .luxe-marker[data-selected="true"] .luxe-marker-bloom {
            opacity: var(--bloom-opacity);
          }
          .luxe-marker[data-selected="true"] .luxe-marker-glow {
            opacity: var(--glow-opacity);
            border-color: rgba(168,13,24,var(--glow-stroke-opacity));
          }
          .luxe-marker-badge {
            position: absolute;
            left: calc(50% + 9px);
            top: calc(100% - 23px);
            min-width: 14.4px;
            height: 14.4px;
            padding: 0 3px;
            display: none;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            border: 1.25px solid #a80d18;
            background: rgba(7,9,15,0.94);
            color: #f4f7fb;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5px;
            font-weight: 700;
            line-height: 1;
            text-shadow: 0 0 2px rgba(0,0,0,0.72);
            pointer-events: none;
            transform: translate(-50%, -50%);
            z-index: 4;
          }
          .luxe-marker[data-has-badge="true"] .luxe-marker-badge {
            display: flex;
          }
        `}</style>
      </div>
    );
  },
);

// Apply selection / kind styling to a pin.
function stylePin(pin: Pin, selected: boolean) {
  const hasBadge = pin.kind === "global" && pin.itemCount > 1;
  pin.el.dataset.selected = selected ? "true" : "false";
  pin.el.dataset.hasBadge = hasBadge ? "true" : "false";
  if (!hasBadge) return;

  pin.badgeEl.textContent = String(pin.itemCount);
  pin.badgeEl.style.minWidth = pin.itemCount >= 100 ? "16.8px" : "14.4px";
  pin.badgeEl.style.height = pin.itemCount >= 100 ? "16.8px" : "14.4px";
  pin.badgeEl.style.fontSize = pin.itemCount >= 100 ? "8px" : "9.5px";
}
