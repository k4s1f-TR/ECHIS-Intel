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
import type { Feature, Geometry, Position } from "geojson";
import type { RegionKey } from "@/types/event";
import type {
  MapLibreGlobeHandle,
  MarkerFeature,
  GlobeViewMode,
  MarkerKind,
} from "@/components/maplibre/MapLibreGlobe";

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
const CAM_Z_DEFAULT = 3.25;
const CAM_Z_MIN = 2.45;
const CAM_Z_MAX = 4.8;
const CAM_Z_STEP = 0.42; // zoom-button increment
const INTERACTION_IDLE_MS = 15_000;
const CENTRAL_VIEW_PAUSE_MS = 2_400;

// Screen framing — the dashboard's side panels. Globe shifts into the free
// zone between the left floating card and the right panel for global/signals.
const VIEW_FRAMING: Record<GlobeViewMode, { left: number; right: number }> = {
  situation: { left: 0, right: 0 },
  global: { left: 220, right: 422 },
  signals: { left: 220, right: 422 },
};

const DEG = Math.PI / 180;

function camZForMapZoom(z: number): number {
  // DEFAULT_MAP_ZOOM → CAM_Z_DEFAULT; higher zoom = closer = smaller camZ.
  return Math.max(CAM_Z_MIN, Math.min(CAM_Z_MAX, CAM_Z_DEFAULT - (z - DEFAULT_MAP_ZOOM) * 1.06));
}

// lat/lng → unit-sphere position matching THREE.SphereGeometry's equirectangular
// UV mapping (verified against the colour-texture projection used by the Luxe core).
function latLngToVector3(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
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

interface LuxeGlobeMapProps {
  activeView?: GlobeViewMode;
  activeRegion?: RegionKey;
  activeSignalsRegion?: RegionKey;
  globalMarkers?: MarkerFeature[];
  signalsMarkers?: MarkerFeature[];
  onMarkerClick?: (id: string, kind: MarkerKind, point?: { x: number; y: number }) => void;
  autoRotatePaused?: boolean;
  onGlobalMarkerRevealStart?: () => void;
  selectedGlobalId?: string | null;
  selectedSignalsId?: string | null;
}

interface Pin {
  el: HTMLDivElement;
  lng: number;
  lat: number;
  kind: MarkerKind;
  itemCount: number;
}

interface Engine {
  disposed: boolean;
  raf: number;
  rot: { x: number; y: number };
  vel: { x: number; y: number };
  drag: { x: number; y: number } | null;
  camZ: number;
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
  pausedUntil: number;
  hardPaused: boolean;
  offsetX: number; // current group x-offset (world units)
  offsetXTarget: number;
  // markers
  pins: Map<string, Pin>;
  onResize: (() => void) | null;
  cleanup: (() => void) | null;
  _reconcile?: () => void;
  _applyView?: (animated: boolean) => void;
}

const AUTO_SPEED = 0.3;

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

export const LuxeGlobeMap = forwardRef<MapLibreGlobeHandle, LuxeGlobeMapProps>(
  function LuxeGlobeMap(props, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<HTMLDivElement>(null);
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
      g.updateMatrixWorld();
      const wp = TMP.copy(latLngToVector3(lat, lng, 1));
      g.localToWorld(wp);
      // occlusion: surface normal (from globe centre) vs direction to camera
      const normal = TMP2.copy(wp).sub(g.position).normalize();
      const toCam = new THREE.Vector3().copy(cam.position).sub(wp).normalize();
      const visible = normal.dot(toCam) > 0.02;
      const ndc = wp.clone().project(cam);
      const x = (ndc.x * 0.5 + 0.5) * eng.W;
      const y = (-ndc.y * 0.5 + 0.5) * eng.H;
      return { x, y, visible };
    };

    useEffect(() => {
      const eng: Engine = {
        disposed: false,
        raf: 0,
        rot: { ...rotForLatLng(DEFAULT_CENTER[1], DEFAULT_CENTER[0]) },
        vel: { x: 0, y: 0 },
        drag: null,
        camZ: CAM_Z_DEFAULT,
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
        pausedUntil: 0,
        hardPaused: false,
        offsetX: 0,
        offsetXTarget: 0,
        pins: new Map(),
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
      };

      const bindControls = (dom: HTMLCanvasElement) => {
        const onDown = (e: MouseEvent | TouchEvent) => {
          const p = "touches" in e ? e.touches[0] : e;
          eng.drag = { x: p.clientX, y: p.clientY };
          eng.vel.y = 0;
          eng.vel.x = 0;
          eng.framing = false;
          dom.style.cursor = "grabbing";
        };
        const onMove = (e: MouseEvent | TouchEvent) => {
          if (!eng.drag) return;
          const p = "touches" in e ? e.touches[0] : e;
          const dx = p.clientX - eng.drag.x;
          const dy = p.clientY - eng.drag.y;
          eng.drag.x = p.clientX;
          eng.drag.y = p.clientY;
          const ky = dx * 0.0052;
          const kx = dy * 0.0052;
          eng.rot.y += ky;
          eng.rot.x = Math.max(-1.3, Math.min(1.3, eng.rot.x + kx));
          eng.vel.y = ky;
          eng.vel.x = kx;
          e.preventDefault();
        };
        const onUp = () => {
          if (eng.drag) pauseAuto(INTERACTION_IDLE_MS);
          eng.drag = null;
          dom.style.cursor = "grab";
        };
        const onWheel = (e: WheelEvent) => {
          eng.camZ = Math.max(CAM_Z_MIN, Math.min(CAM_Z_MAX, eng.camZ + e.deltaY * 0.0016));
          pauseAuto(INTERACTION_IDLE_MS);
          e.preventDefault();
        };
        dom.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove, { passive: false });
        window.addEventListener("mouseup", onUp);
        dom.addEventListener("touchstart", onDown, { passive: false });
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onUp);
        dom.addEventListener("wheel", onWheel, { passive: false });
        eng.cleanup = () => {
          dom.removeEventListener("mousedown", onDown);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          dom.removeEventListener("touchstart", onDown);
          window.removeEventListener("touchmove", onMove);
          window.removeEventListener("touchend", onUp);
          dom.removeEventListener("wheel", onWheel);
        };
      };

      // world units per screen pixel at the globe centre (z=0 plane).
      const worldPerPixel = (): number => {
        const cam = eng.camera!;
        const visH = 2 * Math.tan((cam.fov * DEG) / 2) * cam.position.z;
        return visH / Math.max(1, eng.H);
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
          pin.el.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`;
          pin.el.style.zIndex = selected ? "3" : "2";
          stylePin(pin, selected);
        }
      };

      const animate = () => {
        if (eng.disposed) return;
        eng.raf = requestAnimationFrame(animate);
        const now = performance.now();
        const auto =
          !eng.drag && !eng.framing && !eng.hardPaused && now > eng.pausedUntil;
        if (auto) eng.rot.y += 0.004 * AUTO_SPEED;

        if (eng.framing) {
          eng.rot.y += (eng.targetRot.y - eng.rot.y) * 0.1;
          eng.rot.x += (eng.targetRot.x - eng.rot.x) * 0.1;
          if (
            Math.abs(eng.targetRot.y - eng.rot.y) < 0.001 &&
            Math.abs(eng.targetRot.x - eng.rot.x) < 0.001
          ) {
            eng.rot.y = eng.targetRot.y;
            eng.rot.x = eng.targetRot.x;
            eng.framing = false;
          }
        } else if (!eng.drag) {
          eng.rot.y += eng.vel.y;
          eng.rot.x = Math.max(-1.3, Math.min(1.3, eng.rot.x + eng.vel.x));
          eng.vel.y *= 0.94;
          eng.vel.x *= 0.94;
        }

        if (eng.group) {
          eng.group.rotation.y = eng.rot.y;
          eng.group.rotation.x = eng.rot.x;
          eng.offsetX += (eng.offsetXTarget - eng.offsetX) * 0.1;
          eng.group.position.x = eng.offsetX;
        }
        if (eng.camera) {
          eng.camera.position.z += (eng.camZ - eng.camera.position.z) * 0.08;
        }
        eng.renderer!.render(eng.scene!, eng.camera!);
        updateMarkers();
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
          eng.targetRot = tr;
          eng.framing = true;
          pauseAuto(CENTRAL_VIEW_PAUSE_MS);
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

        applyView(false); // first paint: jump to framing, no spin
        reconcilePins();
        animate();
      };

      // ---- markers DOM reconciliation -----------------------------------
      const makePinEl = (kind: MarkerKind): HTMLDivElement => {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.style.willChange = "transform";
        el.dataset.kind = kind;
        const dot = document.createElement("div");
        dot.className = "luxe-dot";
        el.appendChild(dot);
        return el;
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
          if (!pin) {
            const el = makePinEl(m.kind);
            const rawId = m.id;
            const kind = m.kind;
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              const p = projectPoint(eng, m.lng, m.lat);
              propsRef.current.onMarkerClick?.(
                rawId,
                kind,
                p ? { x: p.x, y: p.y } : undefined,
              );
            });
            container.appendChild(el);
            pin = { el, lng: m.lng, lat: m.lat, kind: m.kind, itemCount: m.itemCount ?? 1 };
            eng.pins.set(key, pin);
          } else {
            pin.lng = m.lng;
            pin.lat = m.lat;
            pin.itemCount = m.itemCount ?? 1;
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
      if (eng) eng.hardPaused = props.autoRotatePaused ?? false;
    }, [props.autoRotatePaused]);

    // ----- imperative handle (matches MapLibreGlobeHandle) -----
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const eng = engineRef.current;
          if (!eng) return;
          eng.camZ = Math.max(CAM_Z_MIN, Math.min(CAM_Z_MAX, eng.camZ - CAM_Z_STEP));
          eng.pausedUntil = performance.now() + INTERACTION_IDLE_MS;
        },
        zoomOut: () => {
          const eng = engineRef.current;
          if (!eng) return;
          eng.camZ = Math.max(CAM_Z_MIN, Math.min(CAM_Z_MAX, eng.camZ + CAM_Z_STEP));
          eng.pausedUntil = performance.now() + INTERACTION_IDLE_MS;
        },
        projectMarker: (lng: number, lat: number) => {
          const eng = engineRef.current;
          if (!eng || !eng.camera) return null;
          const p = projectPoint(eng, lng, lat);
          return p ? { x: p.x, y: p.y } : null;
        },
        setAutoRotatePaused: (paused: boolean) => {
          const eng = engineRef.current;
          if (eng) eng.hardPaused = paused;
        },
        centerView: () => {
          const eng = engineRef.current;
          if (!eng) return;
          const tr = rotForLatLng(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
          tr.y = nearestAngle(tr.y, eng.rot.y);
          eng.targetRot = tr;
          eng.camZ = CAM_Z_DEFAULT;
          eng.framing = true;
          eng.pausedUntil = performance.now() + INTERACTION_IDLE_MS;
        },
        focusMarker: (lng: number, lat: number) => {
          const eng = engineRef.current;
          if (!eng) return;
          const tr = rotForLatLng(lat, lng);
          tr.y = nearestAngle(tr.y, eng.rot.y);
          eng.targetRot = tr;
          eng.framing = true;
          eng.pausedUntil = performance.now() + INTERACTION_IDLE_MS;
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
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(75% 70% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <style>{`
          .luxe-dot {
            width: 9px; height: 9px; border-radius: 50%;
            background: radial-gradient(circle at 50% 42%, #ffd2cf 0%, #ff5a54 36%, #c5121f 100%);
            box-shadow: 0 0 0 1px rgba(255,120,114,0.45), 0 0 8px 2px rgba(220,30,42,0.55);
            transition: width .12s ease, height .12s ease, box-shadow .12s ease;
          }
        `}</style>
      </div>
    );
  },
);

// Apply selection / kind styling to a pin's dot.
function stylePin(pin: Pin, selected: boolean) {
  const dot = pin.el.firstElementChild as HTMLDivElement | null;
  if (!dot) return;
  const base = pin.kind === "global" ? "#ff5a54" : "#ff2535";
  const size = selected ? 14 : 9;
  dot.style.width = `${size}px`;
  dot.style.height = `${size}px`;
  dot.style.background = `radial-gradient(circle at 50% 42%, #ffd2cf 0%, ${base} 36%, #c5121f 100%)`;
  dot.style.boxShadow = selected
    ? "0 0 0 1.5px rgba(255,150,144,0.85), 0 0 16px 5px rgba(229,54,52,0.75)"
    : "0 0 0 1px rgba(255,120,114,0.45), 0 0 8px 2px rgba(220,30,42,0.55)";
}
