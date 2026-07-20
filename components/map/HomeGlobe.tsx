"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { mesh } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import type { MapLibreGlobeHandle } from "@/components/maplibre/MapLibreGlobe";

type Position = [number, number];
type GeoLine = { type: "LineString"; coordinates: Position[] };
type GeoMultiLine = { type: "MultiLineString"; coordinates: Position[][] };

const RADIUS = 1.54;
const AUTO_ROTATE_SPEED = 0.055;
const CRISIS_COUNTRY_IDS = new Set(["275", "376", "729", "804", "887"]);

function spherePoint(lng: number, lat: number, radius = RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 90);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function lineCoordinates(geometry: GeoLine | GeoMultiLine): Position[][] {
  return geometry.type === "LineString"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function addLine(
  parent: THREE.Object3D,
  coordinates: Position[],
  material: THREE.LineBasicMaterial,
  radius: number,
) {
  if (coordinates.length < 2) return;
  const points = coordinates.map(([lng, lat]) => spherePoint(lng, lat, radius));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  parent.add(new THREE.Line(geometry, material));
}

function isCrisisGeometry(geometry: unknown): boolean {
  const id = (geometry as { id?: string | number } | undefined)?.id;
  return id !== undefined && CRISIS_COUNTRY_IDS.has(String(id).padStart(3, "0"));
}

export const HomeGlobe = forwardRef<MapLibreGlobeHandle, { autoRotatePaused?: boolean }>(
  function HomeGlobe({ autoRotatePaused = false }, ref) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const runtimeRef = useRef<{
      camera: THREE.PerspectiveCamera;
      globe: THREE.Group;
      renderer: THREE.WebGLRenderer;
      targetQuaternion: THREE.Quaternion | null;
      targetZoom: number;
      interactionUntil: number;
    } | null>(null);
    const pausedRef = useRef(autoRotatePaused);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      pausedRef.current = autoRotatePaused;
    }, [autoRotatePaused]);

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        const state = runtimeRef.current;
        if (!state) return;
        state.targetZoom = Math.max(3.5, state.targetZoom - 0.45);
        state.interactionUntil = performance.now() + 12_000;
      },
      zoomOut: () => {
        const state = runtimeRef.current;
        if (!state) return;
        state.targetZoom = Math.min(6.4, state.targetZoom + 0.45);
        state.interactionUntil = performance.now() + 12_000;
      },
      centerView: () => {
        const state = runtimeRef.current;
        if (!state) return;
        state.targetQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(THREE.MathUtils.degToRad(-12), THREE.MathUtils.degToRad(-18), 0),
        );
        state.targetZoom = 4.75;
        state.interactionUntil = performance.now() + 5_000;
      },
      focusMarker: (lng, lat) => {
        const state = runtimeRef.current;
        if (!state) return;
        const localPoint = spherePoint(lng, lat, 1).normalize();
        state.targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
          localPoint,
          new THREE.Vector3(0, 0, 1),
        );
        state.targetZoom = 4.15;
        state.interactionUntil = performance.now() + 12_000;
      },
      projectMarker: () => null,
      setAutoRotatePaused: (paused) => {
        pausedRef.current = paused;
      },
    }), []);

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

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.domElement.setAttribute("aria-label", "Interactive strategic globe");
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 4.75);

      const globe = new THREE.Group();
      globe.rotation.set(THREE.MathUtils.degToRad(-12), THREE.MathUtils.degToRad(-18), 0);
      scene.add(globe);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 128, 128),
        new THREE.MeshPhysicalMaterial({
          color: 0x07080a,
          metalness: 0.72,
          roughness: 0.54,
          clearcoat: 0.3,
          clearcoatRoughness: 0.62,
        }),
      );
      globe.add(sphere);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 1.055, 96, 96),
        new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.FrontSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          uniforms: {
            horizonColor: { value: new THREE.Color(0x2a0a0d) },
            fogColor: { value: new THREE.Color(0x1a0608) },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vViewPosition = viewPosition.xyz;
              gl_Position = projectionMatrix * viewPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            uniform vec3 horizonColor;
            uniform vec3 fogColor;
            void main() {
              vec3 viewDirection = normalize(-vViewPosition);
              float fresnel = 1.0 - max(dot(normalize(vNormal), viewDirection), 0.0);
              float horizon = smoothstep(0.42, 0.98, fresnel);
              float outerFade = pow(horizon, 2.2);
              vec3 color = mix(fogColor, horizonColor, smoothstep(0.66, 1.0, fresnel));
              gl_FragColor = vec4(color, outerFade * 0.22);
            }
          `,
        }),
      );
      globe.add(atmosphere);

      const borderMaterial = new THREE.LineBasicMaterial({
        color: 0xd52135,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      });
      const atlasCountries = (
        countriesAtlas as unknown as { objects: { countries: unknown } }
      ).objects.countries;
      const geography = mesh(
        countriesAtlas as never,
        atlasCountries as never,
        (a, b) => !isCrisisGeometry(a) && !isCrisisGeometry(b),
      ) as unknown as GeoLine | GeoMultiLine;
      lineCoordinates(geography).forEach((line) =>
        addLine(globe, line, borderMaterial, RADIUS + 0.009),
      );

      const crisisBorderMaterial = new THREE.LineBasicMaterial({
        color: 0xff3f52,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const crisisGeography = mesh(
        countriesAtlas as never,
        atlasCountries as never,
        (a, b) => isCrisisGeometry(a) || isCrisisGeometry(b),
      ) as unknown as GeoLine | GeoMultiLine;
      lineCoordinates(crisisGeography).forEach((line) =>
        addLine(globe, line, crisisBorderMaterial, RADIUS + 0.009),
      );

      scene.add(new THREE.AmbientLight(0x24272e, 0.46));
      const northwestLight = new THREE.RectAreaLight(0xe5e8ee, 4.1, 3.4, 3.4);
      northwestLight.position.set(-3.8, 4.1, 4.8);
      northwestLight.lookAt(0, 0, 0);
      scene.add(northwestLight);
      const rimLight = new THREE.DirectionalLight(0x2a0a0d, 0.34);
      rimLight.position.set(4, -1, -5);
      scene.add(rimLight);

      const state = {
        camera,
        globe,
        renderer,
        targetQuaternion: null as THREE.Quaternion | null,
        targetZoom: 4.75,
        interactionUntil: 0,
      };
      runtimeRef.current = state;

      const resize = () => {
        const { clientWidth: width, clientHeight: height } = mount;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.setViewOffset(
          width,
          height,
          width < 900 ? 0 : Math.round(-width * 0.105),
          0,
          width,
          height,
        );
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();

      let dragging = false;
      let previousX = 0;
      let previousY = 0;
      const onPointerDown = (event: PointerEvent) => {
        dragging = true;
        previousX = event.clientX;
        previousY = event.clientY;
        state.targetQuaternion = null;
        state.interactionUntil = performance.now() + 12_000;
        renderer.domElement.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - previousX;
        const dy = event.clientY - previousY;
        previousX = event.clientX;
        previousY = event.clientY;
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.0042);
        const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.0032);
        globe.quaternion.premultiply(yaw).premultiply(pitch).normalize();
      };
      const onPointerUp = () => { dragging = false; };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        state.targetZoom = THREE.MathUtils.clamp(state.targetZoom + event.deltaY * 0.002, 3.5, 6.4);
        state.interactionUntil = performance.now() + 12_000;
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

      let frameId = 0;
      let lastFrameTime = performance.now();
      let elapsed = 0;
      const animate = (now: number) => {
        frameId = requestAnimationFrame(animate);
        const delta = Math.min(Math.max((now - lastFrameTime) / 1000, 0), 0.04);
        lastFrameTime = now;
        elapsed += delta;
        if (state.targetQuaternion) {
          globe.quaternion.slerp(state.targetQuaternion, 0.035);
          if (globe.quaternion.angleTo(state.targetQuaternion) < 0.004) state.targetQuaternion = null;
        } else if (!dragging && !pausedRef.current && performance.now() > state.interactionUntil) {
          const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta * AUTO_ROTATE_SPEED);
          globe.quaternion.premultiply(rotation).normalize();
        }
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, state.targetZoom, 0.055);
        const breath = (Math.sin(elapsed * 1.28) + 1) / 2;
        crisisBorderMaterial.opacity = 0.5 + breath * 0.32;
        renderer.render(scene, camera);
      };
      frameId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(frameId);
        observer.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointercancel", onPointerUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        runtimeRef.current = null;
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
            object.geometry.dispose();
            const material = object.material;
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material.dispose();
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    }, []);

    return (
      <div className="home-three-globe" aria-label="Home globe">
        <div ref={mountRef} className="home-three-globe-canvas" />
        <div className="home-three-globe-vignette" aria-hidden="true" />
        {error && <div className="home-three-globe-error">Globe unavailable · {error}</div>}
      </div>
    );
  },
);
