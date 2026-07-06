"use client";

// ---------------------------------------------------------------------------
// Luxe Globe — faithful port of `Luxe Globe.dc.html` (Claude Design handoff).
//
// A premium Three.js globe: vivid crimson ocean, black continents, clean
// white country borders, rendered with a physical/clearcoat material under a
// soft studio environment. Drag to rotate (with momentum), wheel to zoom.
//
// All numeric constants, colors, material settings, lighting and control
// tuning are copied verbatim from the design so the visual output matches
// pixel-for-pixel. Only the surrounding scaffolding (class component →
// React effect, CDN script tags → npm imports) has been adapted.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Feature, Geometry, Position } from "geojson";

const LUXE_CRIMSON_DARK = "#b3121f";
const LUXE_CRIMSON_BRIGHT = "#ff2b3d";

export interface LuxeGlobeProps {
  /** Spin the globe on its own when the user isn't dragging. */
  autoRotate?: boolean;
  /** Auto-rotation speed (0–1.5). */
  rotationSpeed?: number;
  /**
   * Border colour. Mirrors the design prop: it triggers a colour-texture
   * redraw on change, but the design always strokes borders in opaque white,
   * so this is kept for API parity and does not alter the rendered borders.
   */
  borderColor?: string;
}

// Internal mutable engine state shared between effects.
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
  colorTex: THREE.CanvasTexture | null;
  onResize: (() => void) | null;
  cleanupControls: (() => void) | null;
  redrawColor: () => void;
}

export function LuxeGlobe({
  autoRotate = false,
  rotationSpeed = 0.3,
  borderColor = "#a80b18",
}: LuxeGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  // Keep latest prop values readable inside the persistent animation loop.
  const propsRef = useRef({ autoRotate, rotationSpeed, borderColor });
  useEffect(() => {
    propsRef.current = { autoRotate, rotationSpeed, borderColor };
  }, [autoRotate, rotationSpeed, borderColor]);

  useEffect(() => {
    const eng: Engine = {
      disposed: false,
      raf: 0,
      rot: { y: -1.1, x: 0.32 },
      vel: { y: 0, x: 0 },
      drag: null,
      camZ: 3.25,
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
      colorTex: null,
      onResize: null,
      cleanupControls: null,
      redrawColor: () => {},
    };
    engineRef.current = eng;

    // ---- geometry → equirectangular path helpers -----------------------
    const project = (lon: number, lat: number, w: number, h: number): [number, number] => {
      return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
    };

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

    const fillLand = (
      ctx: CanvasRenderingContext2D,
      fill: string,
      w: number,
      h: number,
    ) => {
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

    const drawColor = () => {
      const w = eng.W;
      const h = eng.H;
      const ctx = eng.colorCtx!;
      ctx.clearRect(0, 0, w, h);
      const ocean = ctx.createLinearGradient(0, 0, w, 0);
      ocean.addColorStop(0, LUXE_CRIMSON_DARK);
      ocean.addColorStop(1, LUXE_CRIMSON_BRIGHT);
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, w, h);
      // faint deep-red tonal depth toward poles
      const og = ctx.createLinearGradient(0, 0, 0, h);
      og.addColorStop(0, "rgba(10,2,4,0.6)");
      og.addColorStop(0.5, "rgba(0,0,0,0)");
      og.addColorStop(1, "rgba(10,2,4,0.6)");
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, w, h);
      // black continents
      fillLand(ctx, "#070708", w, h);
      // white borders — clean opaque white only (no translucent base → no red bleed)
      strokeBorders(ctx, "#ffffff", 1.0, w, h);
    };
    eng.redrawColor = drawColor;

    const drawHeight = () => {
      const w = eng.W;
      const h = eng.H;
      const ctx = eng.heightCtx!;
      ctx.clearRect(0, 0, w, h);
      // ocean low (black), continents gently raised with soft coastal slope
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.filter = "blur(13px)";
      fillLand(ctx, "#ffffff", w, h);
      ctx.restore();
    };

    const drawORM = () => {
      const w = eng.W;
      const h = eng.H;
      const ctx = eng.ormCtx!;
      // ocean: G=roughness(.34), B=metalness(.16)
      ctx.fillStyle = "rgb(0,87,41)";
      ctx.fillRect(0, 0, w, h);
      // land: matte → far less env reflection on continents (rough .56, metal .08)
      fillLand(ctx, "rgb(0,143,20)", w, h);
    };

    const buildEnv = (renderer: THREE.WebGLRenderer): THREE.Texture => {
      const c = document.createElement("canvas");
      c.width = 1024;
      c.height = 512;
      const ctx = c.getContext("2d")!;
      // soft cool studio gradient, top light → bottom dark — dimmed to match darker surface
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0.0, "#d6dde6");
      g.addColorStop(0.18, "#646c76");
      g.addColorStop(0.32, "#262b31");
      g.addColorStop(0.52, "#13161a");
      g.addColorStop(0.78, "#0d0f12");
      g.addColorStop(1.0, "#07080a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 512);
      // even, even sheen only — no point/softbox spots

      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      pmrem.dispose();
      return rt.texture;
    };

    const bindControls = (dom: HTMLCanvasElement) => {
      const onDown = (e: MouseEvent | TouchEvent) => {
        const p = "touches" in e ? e.touches[0] : e;
        eng.drag = { x: p.clientX, y: p.clientY };
        eng.vel.y = 0;
        eng.vel.x = 0;
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
        eng.drag = null;
        dom.style.cursor = "grab";
      };
      const onWheel = (e: WheelEvent) => {
        eng.camZ = Math.max(2.45, Math.min(4.8, eng.camZ + e.deltaY * 0.0016));
        e.preventDefault();
      };
      dom.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove, { passive: false });
      window.addEventListener("mouseup", onUp);
      dom.addEventListener("touchstart", onDown, { passive: false });
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
      dom.addEventListener("wheel", onWheel, { passive: false });

      eng.cleanupControls = () => {
        dom.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        dom.removeEventListener("touchstart", onDown);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        dom.removeEventListener("wheel", onWheel);
      };
    };

    const animate = () => {
      if (eng.disposed) return;
      eng.raf = requestAnimationFrame(animate);
      const auto = (propsRef.current.autoRotate ?? true) && !eng.drag;
      const speed = propsRef.current.rotationSpeed ?? 0.35;
      if (auto) eng.rot.y += 0.004 * speed;
      if (!eng.drag) {
        eng.rot.y += eng.vel.y;
        eng.rot.x = Math.max(-1.3, Math.min(1.3, eng.rot.x + eng.vel.x));
        eng.vel.y *= 0.94;
        eng.vel.x *= 0.94;
      }
      if (eng.group) {
        eng.group.rotation.y = eng.rot.y;
        eng.group.rotation.x = eng.rot.x;
      }
      if (eng.camera) {
        eng.camera.position.z += (eng.camZ - eng.camera.position.z) * 0.08;
      }
      eng.renderer!.render(eng.scene!, eng.camera!);
    };

    const init = () => {
      const mount = mountRef.current;
      if (!mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;

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

      // textures
      const cc = document.createElement("canvas");
      cc.width = eng.W;
      cc.height = eng.H;
      eng.colorCtx = cc.getContext("2d");
      const oc = document.createElement("canvas");
      oc.width = eng.W;
      oc.height = eng.H;
      eng.ormCtx = oc.getContext("2d");
      const hc = document.createElement("canvas");
      hc.width = eng.W;
      hc.height = eng.H;
      eng.heightCtx = hc.getContext("2d");
      drawColor();
      drawORM();
      drawHeight();

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const colorTex = new THREE.CanvasTexture(cc);
      colorTex.encoding = THREE.sRGBEncoding;
      colorTex.anisotropy = maxAniso;
      const ormTex = new THREE.CanvasTexture(oc);
      ormTex.anisotropy = maxAniso;
      const heightTex = new THREE.CanvasTexture(hc);
      heightTex.anisotropy = maxAniso;
      eng.colorTex = colorTex;

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

      // soft hemispheric fill only — no directional speculars (no dots), dimmed for darker tone
      scene.add(new THREE.HemisphereLight(0xbdb0b2, 0x0a0506, 0.34));
      scene.add(new THREE.AmbientLight(0x141a22, 0.18));

      bindControls(renderer.domElement);

      eng.onResize = () => {
        const ww = mount.clientWidth || window.innerWidth;
        const hh = mount.clientHeight || window.innerHeight;
        camera.aspect = ww / hh;
        camera.updateProjectionMatrix();
        renderer.setSize(ww, hh);
      };
      window.addEventListener("resize", eng.onResize);

      animate();
    };

    // ---- load country geometry, then init ------------------------------
    fetch("/countries-50m.json")
      .then((r) => r.json())
      .then((topo) => {
        if (eng.disposed) return;
        const fc = feature(
          topo,
          topo.objects.countries,
        ) as unknown as { features: Feature<Geometry>[] };
        eng.geo = fc.features;
        init();
      })
      .catch((err) => console.warn("globe data load failed", err));

    // ---- cleanup -------------------------------------------------------
    return () => {
      eng.disposed = true;
      cancelAnimationFrame(eng.raf);
      if (eng.onResize) window.removeEventListener("resize", eng.onResize);
      if (eng.cleanupControls) eng.cleanupControls();
      if (eng.renderer) {
        eng.renderer.dispose();
        const el = eng.renderer.domElement;
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      engineRef.current = null;
    };
    // Engine is built once; prop changes are handled via propsRef / the
    // borderColor effect below.
  }, []);

  // Mirror the design's componentDidUpdate: redraw the colour texture when
  // borderColor changes (kept for parity; borders remain white).
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !eng.geo || !eng.colorCtx) return;
    eng.redrawColor();
    if (eng.colorTex) eng.colorTex.needsUpdate = true;
  }, [borderColor]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "radial-gradient(120% 95% at 50% 42%, #181b20 0%, #0d0f12 46%, #08090b 74%, #050608 100%)",
      }}
    >
      <div ref={mountRef} style={{ position: "fixed", inset: 0 }} />
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(75% 70% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
