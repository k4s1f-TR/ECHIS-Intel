"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

/**
 * EchisGlobe — refined metallic/glass globe (design "2A").
 *
 * Borders are drawn as line geometry INTEGRATED into the globe group (they
 * rotate with the sphere, exactly like the landing screen) — not a separate
 * overlay layer:
 *   - country outline  → /data/home-globe.geojson         (kind: "outline")
 *   - admin-1 outline  → /data/home-globe-admin1.geojson  (province/state lines)
 *
 * One component powers every size via `size`:
 *   "hero"  → full-screen landing globe (labels + markers + graticule + stars)
 *   "panel" → medium embeddable globe
 *   "mini"  → small indicator / loader globe
 *
 * On the data screens (Global View / SOCMINT / Intel Watch) it also supports
 * clickable markers (raycast) + a selected-marker highlight, so it can stand in
 * for the MapLibre globe's pin interactions.
 */

export type EchisGlobeSize = "hero" | "panel" | "mini";
export type GlobeMarkerLevel = "critical" | "high" | "medium" | "low";

export interface GlobeMarker {
  id: string;
  lng: number;
  lat: number;
  level: GlobeMarkerLevel;
  /** Optional — only used when labels are on. */
  label?: string;
  detail?: string;
}

/** Shape of the app's existing MapLibre marker features. */
export interface MarkerFeatureLike {
  id: string;
  lng: number;
  lat: number;
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: "low" | "medium" | "high";
  itemCount?: number;
}

/** Map the app's MarkerFeature[] into GlobeMarker[] (severity → level). */
export function markersFromFeatures(features: MarkerFeatureLike[]): GlobeMarker[] {
  return features.map((f) => ({
    id: f.id,
    lng: f.lng,
    lat: f.lat,
    level: (f.severity ?? "medium") as GlobeMarkerLevel,
  }));
}

export interface EchisGlobeHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  centerView: () => void;
  focusMarker: (lng: number, lat: number) => void;
  projectMarker: (lng: number, lat: number) => { x: number; y: number; visible: boolean } | null;
  setAutoRotatePaused: (paused: boolean) => void;
}

export interface EchisGlobeProps {
  size?: EchisGlobeSize;
  autoRotatePaused?: boolean;
  markers?: GlobeMarker[];
  /** Show projected HTML labels above markers (default: on for "hero"). */
  showLabels?: boolean;
  /** Draw admin-1 (province/state) borders integrated into the sphere. */
  showAdminBorders?: boolean;
  /** Center the globe in the frame (no hero offset). Use on full-screen data views. */
  centered?: boolean;
  /** Highlighted marker id (larger pin + stronger glow). */
  selectedMarkerId?: string | null;
  /** Fired when a marker is clicked. */
  onMarkerClick?: (id: string) => void;
  geojsonUrl?: string;
  adminGeojsonUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}

type Position = [number, number];

interface SizeConfig {
  fov: number;
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  radius: number;
  autoRotate: number;
  offsetY: number;
  offsetX: number;
  graticule: boolean;
  stars: boolean;
  markers: boolean;
  labels: boolean;
  atmosphere: number;
  exposure: number;
  markerScale: number;
}

const SIZE_CONFIG: Record<EchisGlobeSize, SizeConfig> = {
  hero: {
    fov: 32, zoom: 4.5, zoomMin: 3.6, zoomMax: 6.4, radius: 1.5, autoRotate: 0.05,
    offsetY: -0.06, offsetX: 0, graticule: true, stars: true, markers: true,
    labels: true, atmosphere: 0.15, exposure: 0.96, markerScale: 1,
  },
  panel: {
    fov: 30, zoom: 4.6, zoomMin: 3.8, zoomMax: 6.0, radius: 1.5, autoRotate: 0.07,
    offsetY: 0, offsetX: 0, graticule: true, stars: false, markers: true,
    labels: false, atmosphere: 0.13, exposure: 0.95, markerScale: 0.82,
  },
  mini: {
    fov: 30, zoom: 4.35, zoomMin: 4.0, zoomMax: 5.2, radius: 1.5, autoRotate: 0.14,
    offsetY: 0, offsetX: 0, graticule: false, stars: false, markers: false,
    labels: false, atmosphere: 0.11, exposure: 0.95, markerScale: 0.7,
  },
};

const MARKER_COLOR: Record<GlobeMarkerLevel, number> = {
  critical: 0xff3d4f,
  high: 0xff7a3c,
  medium: 0xe0b23a,
  low: 0x9aa2ae,
};

function spherePoint(lng: number, lat: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 90);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function makeRingTexture(hex: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const color = `#${hex.toString(16).padStart(6, "0")}`;
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.6, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function addOutlineFromGeo(
  geo: { features?: Array<{ properties?: { kind?: string }; geometry?: { type?: string; coordinates: Position[][] } }> },
  parent: THREE.Object3D,
  radius: number,
  material: THREE.LineBasicMaterial,
  preferKind?: string,
): THREE.BufferGeometry | null {
  if (!geo?.features) return null;
  const outline =
    (preferKind && geo.features.find((f) => f.properties?.kind === preferKind)) ||
    geo.features.find((f) => f.geometry?.type === "MultiLineString") ||
    geo.features[0];
  if (!outline?.geometry) return null;
  const pos: number[] = [];
  outline.geometry.coordinates.forEach((line) => {
    for (let i = 1; i < line.length; i += 1) {
      const a = spherePoint(line[i - 1][0], line[i - 1][1], radius);
      const b = spherePoint(line[i][0], line[i][1], radius);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  parent.add(new THREE.LineSegments(geom, material));
  return geom;
}

export const EchisGlobe = forwardRef<EchisGlobeHandle, EchisGlobeProps>(
  function EchisGlobe(
    {
      size = "hero",
      autoRotatePaused = false,
      markers = [],
      showLabels,
      showAdminBorders = false,
      centered = false,
      selectedMarkerId = null,
      onMarkerClick,
      geojsonUrl = "/data/home-globe.geojson",
      adminGeojsonUrl = "/data/home-globe-admin1.geojson",
      className,
      style,
    },
    ref,
  ) {
    const cfg = SIZE_CONFIG[size];
    const labelsEnabled = (showLabels ?? cfg.labels) && cfg.markers;

    const mountRef = useRef<HTMLDivElement | null>(null);
    const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const pausedRef = useRef(autoRotatePaused);
    const markersRef = useRef<GlobeMarker[]>(markers);
    const selectedRef = useRef<string | null>(selectedMarkerId);
    const onMarkerClickRef = useRef<typeof onMarkerClick>(onMarkerClick);
    const [error, setError] = useState<string | null>(null);

    const runtimeRef = useRef<{
      targetQuaternion: THREE.Quaternion | null;
      targetZoom: number;
      interactionUntil: number;
      project: (lng: number, lat: number) => { x: number; y: number; visible: boolean } | null;
    } | null>(null);

    const markerKey = useMemo(
      () => markers.map((m) => `${m.id}:${m.lng}:${m.lat}:${m.level}`).join("|"),
      [markers],
    );

    useEffect(() => { pausedRef.current = autoRotatePaused; }, [autoRotatePaused]);
    useEffect(() => { markersRef.current = markers; }, [markers]);
    useEffect(() => { selectedRef.current = selectedMarkerId; }, [selectedMarkerId]);
    useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

    useImperativeHandle(
      ref,
      (): EchisGlobeHandle => ({
        zoomIn: () => {
          const s = runtimeRef.current; if (!s) return;
          s.targetZoom = Math.max(cfg.zoomMin, s.targetZoom - 0.45);
          s.interactionUntil = performance.now() + 12_000;
        },
        zoomOut: () => {
          const s = runtimeRef.current; if (!s) return;
          s.targetZoom = Math.min(cfg.zoomMax, s.targetZoom + 0.45);
          s.interactionUntil = performance.now() + 12_000;
        },
        centerView: () => {
          const s = runtimeRef.current; if (!s) return;
          s.targetQuaternion = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(THREE.MathUtils.degToRad(-14), THREE.MathUtils.degToRad(-30), 0),
          );
          s.targetZoom = cfg.zoom;
          s.interactionUntil = performance.now() + 5_000;
        },
        focusMarker: (lng, lat) => {
          const s = runtimeRef.current; if (!s) return;
          const local = spherePoint(lng, lat, 1).normalize();
          s.targetQuaternion = new THREE.Quaternion().setFromUnitVectors(local, new THREE.Vector3(0, 0, 1));
          s.targetZoom = Math.max(cfg.zoomMin, cfg.zoom - 0.6);
          s.interactionUntil = performance.now() + 12_000;
        },
        projectMarker: (lng, lat) => runtimeRef.current?.project(lng, lat) ?? null,
        setAutoRotatePaused: (paused) => { pausedRef.current = paused; },
      }),
      [cfg],
    );

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "WebGL is unavailable");
        return;
      }

      const RADIUS = cfg.radius;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = cfg.exposure;
      Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", cursor: "grab", opacity: "0", transition: "opacity .7s ease" });
      renderer.domElement.setAttribute("aria-label", "Interactive strategic globe");
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.1, 100);
      camera.position.set(0, 0, cfg.zoom);

      const globe = new THREE.Group();
      globe.rotation.set(THREE.MathUtils.degToRad(-14), THREE.MathUtils.degToRad(-30), 0);
      scene.add(globe);

      const disposables: Array<{ dispose: () => void }> = [];

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 128, 128),
        new THREE.MeshPhysicalMaterial({
          color: 0x0d0f13, metalness: 0.55, roughness: 0.58, clearcoat: 0.24, clearcoatRoughness: 0.6,
        }),
      );
      globe.add(sphere);
      disposables.push(sphere.geometry, sphere.material as THREE.Material);

      if (cfg.graticule) {
        const pos: number[] = [];
        for (let lat = -60; lat <= 60; lat += 30) {
          let prev: THREE.Vector3 | null = null;
          for (let lng = -180; lng <= 180; lng += 4) {
            const p = spherePoint(lng, lat, RADIUS + 0.004);
            if (prev) pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
            prev = p;
          }
        }
        for (let lng = -180; lng < 180; lng += 30) {
          let prev: THREE.Vector3 | null = null;
          for (let lat = -90; lat <= 90; lat += 4) {
            const p = spherePoint(lng, lat, RADIUS + 0.004);
            if (prev) pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
            prev = p;
          }
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0x9aa2ae, transparent: true, opacity: 0.07, depthWrite: false });
        globe.add(new THREE.LineSegments(geom, mat));
        disposables.push(geom, mat);
      }

      // Atmosphere
      {
        const geom = new THREE.SphereGeometry(RADIUS * 1.09, 96, 96);
        const mat = new THREE.ShaderMaterial({
          transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false,
          uniforms: {
            c1: { value: new THREE.Color(0x3f0e15) },
            c2: { value: new THREE.Color(0x160608) },
            intensity: { value: cfg.atmosphere },
          },
          vertexShader:
            "varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vP=mv.xyz;gl_Position=projectionMatrix*mv;}",
          fragmentShader:
            "varying vec3 vN;varying vec3 vP;uniform vec3 c1;uniform vec3 c2;uniform float intensity;void main(){vec3 vd=normalize(-vP);float f=1.0-max(dot(normalize(vN),vd),0.0);float h=smoothstep(0.40,0.98,f);float o=pow(h,2.1);vec3 col=mix(c2,c1,smoothstep(0.62,1.0,f));gl_FragColor=vec4(col,o*intensity);}",
        });
        globe.add(new THREE.Mesh(geom, mat));
        disposables.push(geom, mat);
      }

      if (cfg.stars) {
        const spos: number[] = [];
        for (let i = 0; i < 640; i += 1) {
          const v = new THREE.Vector3().randomDirection().multiplyScalar(12 + Math.random() * 10);
          spos.push(v.x, v.y, v.z);
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(spos, 3));
        const mat = new THREE.PointsMaterial({ color: 0x9298a2, size: 0.04, transparent: true, opacity: 0.5, sizeAttenuation: true });
        scene.add(new THREE.Points(geom, mat));
        disposables.push(geom, mat);
      }

      // Markers.  Ambient pulse (ring + halo sprites) is expensive per marker,
      // so on data screens with many markers we skip it and pulse ONLY the
      // selected marker — keeps drag/rotate smooth at high marker counts.
      const PULSE_ALL_LIMIT = 10;
      const pulseAmbient = markersRef.current.length <= PULSE_ALL_LIMIT;
      type MarkerRuntime = {
        marker: GlobeMarker;
        dot: THREE.Mesh;
        ring: THREE.Sprite | null;
        halo: THREE.Sprite | null;
        baseDot: number;
        local: THREE.Vector3;
        normal: THREE.Vector3;
        phase: number;
      };
      const markerRuntimes: MarkerRuntime[] = [];
      const pickDots: THREE.Mesh[] = [];
      if (cfg.markers) {
        markersRef.current.forEach((marker) => {
          const hex = MARKER_COLOR[marker.level];
          const p = spherePoint(marker.lng, marker.lat, RADIUS + 0.012);
          const baseDot = 0.02 * cfg.markerScale;
          const dotGeom = new THREE.SphereGeometry(baseDot, 16, 16);
          const dotMat = new THREE.MeshBasicMaterial({ color: hex });
          const dot = new THREE.Mesh(dotGeom, dotMat);
          dot.position.copy(p);
          dot.userData.markerId = marker.id;
          globe.add(dot);
          pickDots.push(dot);

          let ring: THREE.Sprite | null = null;
          let halo: THREE.Sprite | null = null;
          if (pulseAmbient) {
            const ringTex = makeRingTexture(hex);
            const ringMat = new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
            ring = new THREE.Sprite(ringMat);
            ring.position.copy(p); ring.scale.set(0.02, 0.02, 1); globe.add(ring);
            const haloMat = new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
            halo = new THREE.Sprite(haloMat);
            halo.position.copy(p); halo.scale.set(0.1, 0.1, 1); globe.add(halo);
            disposables.push(ringMat, haloMat, ringTex);
          }

          disposables.push(dotGeom, dotMat);
          markerRuntimes.push({ marker, dot, ring, halo, baseDot, local: p.clone(), normal: p.clone().normalize(), phase: Math.random() });
        });
      }

      // Lighting
      scene.add(new THREE.AmbientLight(0x2b2f38, 0.72));
      const key = new THREE.DirectionalLight(0xf3eff1, 1.3); key.position.set(-4.6, 4.6, 4.2); scene.add(key);
      const rim = new THREE.DirectionalLight(0xff3b4d, 0.55); rim.position.set(4.5, -1.5, -5); scene.add(rim);
      const fill = new THREE.DirectionalLight(0x3a3f48, 0.4); fill.position.set(3, 2, 4); scene.add(fill);

      const state = {
        targetQuaternion: null as THREE.Quaternion | null,
        targetZoom: cfg.zoom,
        interactionUntil: 0,
        project: (lng: number, lat: number) => {
          const local = spherePoint(lng, lat, RADIUS + 0.012).applyQuaternion(globe.quaternion);
          const visible = local.z > 0.04;
          const projected = local.clone().project(camera);
          return {
            x: (projected.x * 0.5 + 0.5) * mount.clientWidth,
            y: (-projected.y * 0.5 + 0.5) * mount.clientHeight,
            visible,
          };
        },
      };
      runtimeRef.current = state;

      // Country borders (integrated)
      const borderMat = new THREE.LineBasicMaterial({ color: 0xff2b3d, transparent: true, opacity: 0.6, depthWrite: false });
      disposables.push(borderMat);
      // Admin-1 borders (integrated, fainter) — behind country lines
      const adminMat = new THREE.LineBasicMaterial({ color: 0xff5a64, transparent: true, opacity: 0.2, depthWrite: false });
      disposables.push(adminMat);

      let cancelled = false;
      // Synchronized reveal: keep the canvas hidden until the sphere AND all
      // border layers are built, then fade the whole globe in together.
      const loadCountry = fetch(geojsonUrl)
        .then((res) => res.json())
        .then((geo) => { if (!cancelled) { const g = addOutlineFromGeo(geo, globe, RADIUS + 0.006, borderMat, "outline"); if (g) disposables.push(g); } })
        .catch(() => {});
      const loadAdmin = showAdminBorders
        ? fetch(adminGeojsonUrl)
            .then((res) => res.json())
            .then((geo) => { if (!cancelled) { const g = addOutlineFromGeo(geo, globe, RADIUS + 0.0055, adminMat, "admin1-outline"); if (g) disposables.push(g); } })
            .catch(() => {})
        : Promise.resolve();
      Promise.allSettled([loadCountry, loadAdmin]).then(() => {
        if (cancelled) return;
        // Two frames so the newly added border geometry is rendered before fade.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!cancelled) renderer.domElement.style.opacity = "1";
        }));
      });
      // Safety: never leave the globe invisible if a fetch stalls.
      const revealTimer = window.setTimeout(() => { if (!cancelled) renderer.domElement.style.opacity = "1"; }, 2500);

      const resize = () => {
        const { clientWidth: width, clientHeight: height } = mount;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        const ox = centered ? 0 : cfg.offsetX;
        const oy = centered ? 0 : cfg.offsetY;
        camera.setViewOffset(width, height, Math.round(ox * width), Math.round(oy * height), width, height);
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();

      let dragging = false;
      let moved = 0;
      let previousX = 0;
      let previousY = 0;
      const el = renderer.domElement;
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();

      const onPointerDown = (event: PointerEvent) => {
        dragging = true; moved = 0;
        previousX = event.clientX; previousY = event.clientY;
        state.targetQuaternion = null;
        state.interactionUntil = performance.now() + 12_000;
        el.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - previousX;
        const dy = event.clientY - previousY;
        moved += Math.abs(dx) + Math.abs(dy);
        previousX = event.clientX; previousY = event.clientY;
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.0045);
        const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.0032);
        globe.quaternion.premultiply(yaw).premultiply(pitch).normalize();
      };
      const onPointerUp = (event: PointerEvent) => {
        dragging = false;
        if (moved < 5 && pickDots.length && onMarkerClickRef.current) {
          const rect = el.getBoundingClientRect();
          ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(pickDots, false);
          const hit = hits.find((h) => (h.object as THREE.Mesh).visible);
          if (hit) {
            const id = (hit.object as THREE.Mesh).userData.markerId as string;
            if (id) onMarkerClickRef.current(id);
          }
        }
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        state.targetZoom = THREE.MathUtils.clamp(state.targetZoom + event.deltaY * 0.002, cfg.zoomMin, cfg.zoomMax);
        state.interactionUntil = performance.now() + 12_000;
      };
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", onPointerUp);
      el.addEventListener("pointercancel", () => { dragging = false; });
      el.addEventListener("wheel", onWheel, { passive: false });

      let frameId = 0;
      let lastFrame = performance.now();
      let elapsed = 0;
      const animate = (now: number) => {
        frameId = requestAnimationFrame(animate);
        const delta = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.05);
        lastFrame = now; elapsed += delta;

        if (state.targetQuaternion) {
          globe.quaternion.slerp(state.targetQuaternion, 0.06);
          if (globe.quaternion.angleTo(state.targetQuaternion) < 0.004) state.targetQuaternion = null;
        } else if (!dragging && !pausedRef.current && performance.now() > state.interactionUntil) {
          const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta * cfg.autoRotate);
          globe.quaternion.premultiply(rotation).normalize();
        }

        camera.position.z = THREE.MathUtils.lerp(camera.position.z, state.targetZoom, 0.06);

        const gq = globe.quaternion;
        const selId = selectedRef.current;
        markerRuntimes.forEach((mk) => {
          const worldNormal = mk.normal.clone().applyQuaternion(gq);
          const front = worldNormal.z > 0.02;
          const selected = selId === mk.marker.id;
          mk.dot.visible = front;
          mk.dot.scale.setScalar(selected ? 1.9 : 1);
          if (mk.ring && mk.halo) {
            const showPulse = front && (pulseAmbient || selected);
            mk.ring.visible = showPulse;
            mk.halo.visible = showPulse;
            const t = (elapsed * 0.55 + mk.phase) % 1;
            const s = (0.03 + t * 0.16) * cfg.markerScale * (selected ? 1.4 : 1);
            mk.ring.scale.set(s, s, 1);
            (mk.ring.material as THREE.SpriteMaterial).opacity = (1 - t) * (selected ? 0.95 : 0.7);
            const hs = (0.09 + 0.02 * Math.sin(elapsed * 2 + mk.phase * 6)) * cfg.markerScale * (selected ? 1.5 : 1);
            mk.halo.scale.set(hs, hs, 1);
            (mk.halo.material as THREE.SpriteMaterial).opacity = selected ? 0.8 : 0.5;
          }

          if (labelsEnabled) {
            const labelEl = labelRefs.current[mk.marker.id];
            if (labelEl) {
              const projected = mk.local.clone().applyQuaternion(gq).project(camera);
              const x = (projected.x * 0.5 + 0.5) * mount.clientWidth;
              const y = (-projected.y * 0.5 + 0.5) * mount.clientHeight;
              labelEl.style.transform = `translate(${x}px, ${y}px)`;
              labelEl.style.opacity = front ? "1" : "0";
            }
          }
        });

        renderer.render(scene, camera);
      };
      frameId = requestAnimationFrame(animate);

      return () => {
        cancelled = true;
        window.clearTimeout(revealTimer);
        cancelAnimationFrame(frameId);
        observer.disconnect();
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("wheel", onWheel);
        runtimeRef.current = null;
        disposables.forEach((d) => { try { d.dispose(); } catch { /* noop */ } });
        renderer.dispose();
        el.remove();
      };
    }, [size, markerKey, geojsonUrl, adminGeojsonUrl, showAdminBorders, centered, labelsEnabled, cfg]);

    return (
      <div
        className={className}
        style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}
        aria-label="Strategic globe"
      >
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
        {labelsEnabled &&
          markers.map((marker) => (
            <div
              key={marker.id}
              ref={(node) => { labelRefs.current[marker.id] = node; }}
              style={{
                position: "absolute", left: 0, top: 0, zIndex: 7, pointerEvents: "none",
                opacity: 0, transform: "translate(-2000px,-2000px)", willChange: "transform, opacity",
                transition: "opacity .28s ease",
              }}
            >
              <div style={{ position: "absolute", left: 0, bottom: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex", flexDirection: "column", gap: 2, padding: "6px 10px",
                    border: marker.level === "critical" ? "1px solid rgba(239,61,79,.32)" : "1px solid rgba(255,255,255,.1)",
                    borderRadius: 8,
                    background: marker.level === "critical" ? "rgba(15,7,9,.78)" : "rgba(9,8,10,.76)",
                    backdropFilter: "blur(10px)", boxShadow: "0 12px 34px rgba(0,0,0,.45)", whiteSpace: "nowrap",
                    fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono', monospace)",
                  }}
                >
                  <span style={{ fontSize: 8, fontWeight: 650, letterSpacing: ".14em", color: marker.level === "critical" ? "rgba(235,72,72,.94)" : "rgba(216,220,226,.86)" }}>
                    {(marker.label ?? marker.id).toUpperCase()}
                  </span>
                  {marker.detail && (
                    <span style={{ fontSize: 7, letterSpacing: ".1em", color: marker.level === "critical" ? "rgba(235,72,72,.8)" : "rgba(200,117,46,.9)" }}>
                      {marker.detail}
                    </span>
                  )}
                </div>
                <div style={{ width: 1, height: 16, background: marker.level === "critical" ? "linear-gradient(180deg,rgba(255,60,74,.3),rgba(255,60,74,.9))" : "linear-gradient(180deg,rgba(255,120,80,.3),rgba(255,120,80,.85))" }} />
                <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: -1, background: marker.level === "critical" ? "#ef3d4f" : "#ff7a3c", boxShadow: marker.level === "critical" ? "0 0 12px rgba(239,61,79,.9)" : "0 0 10px rgba(255,122,60,.85)" }} />
              </div>
            </div>
          ))}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(200,120,130,.8)", fontFamily: "var(--font-jetbrains-mono, 'JetBrains Mono', monospace)", fontSize: 11 }}>
            Globe unavailable · {error}
          </div>
        )}
      </div>
    );
  },
);
