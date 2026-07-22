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
  /** Optional one-shot pulse timing. Markers without these values keep the
   *  persistent pulse used by operational map screens. */
  pulseStartedAtMs?: number;
  pulseDurationMs?: number;
  /** Per-marker wave-size multiplier. */
  pulseScale?: number;
  /** Optional visibility window for transient projected cards. */
  displayStartedAtMs?: number;
  displayDurationMs?: number;
  /** Optional repeating interval for transient projected cards. */
  displayCycleMs?: number;
  /** Non-visual grouping key used to balance transient cards geographically. */
  regionKey?: string;
  /** Optional — only used when labels are on. */
  label?: string;
  detail?: string;
}

export type GlobeGeographyKind = "country" | "region";

export interface GlobeGeographySelection {
  id: string;
  name: string;
  kind: GlobeGeographyKind;
  lng: number;
  lat: number;
}

export interface GlobeRegionDefinition {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** One outer ring followed by optional inner rings, in [lng, lat]. */
  rings: Position[][];
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

/**
 * Map the app's MarkerFeature[] into GlobeMarker[].
 *
 * Level falls back from severity to confidence, matching the marker-level
 * expression the MapLibre globe used (`coalesce(severity, confidence)`), so
 * SOCMINT pins — which carry confidence and no severity — keep their
 * high/medium/low reading instead of collapsing into one colour.
 */
export function markersFromFeatures(features: MarkerFeatureLike[]): GlobeMarker[] {
  return features.map((f) => ({
    id: f.id,
    lng: f.lng,
    lat: f.lat,
    level: (f.severity ?? f.confidence ?? "low") as GlobeMarkerLevel,
  }));
}

export interface EchisGlobeHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  centerView: () => void;
  focusMarker: (lng: number, lat: number) => void;
  focusGeography: (lng: number, lat: number) => boolean;
  projectMarker: (lng: number, lat: number) => { x: number; y: number; visible: boolean } | null;
  setAutoRotatePaused: (paused: boolean) => void;
  resumeAutoRotate: () => void;
}

export interface EchisGlobeProps {
  size?: EchisGlobeSize;
  autoRotatePaused?: boolean;
  /** Camera-distance reduction used only by focusGeography(). */
  geographyFocusZoomOffset?: number;
  /** Per-frame damping used only by focusGeography(). */
  geographyFocusEasing?: number;
  /** Fired once when an idle globe actually resumes automatic rotation. */
  onAutoRotateStart?: () => void;
  markers?: GlobeMarker[];
  /** Show projected HTML labels above markers (default: on for "hero"). */
  showLabels?: boolean;
  /** Visual treatment for projected marker labels. */
  markerLabelVariant?: "badge" | "country-card";
  /** Draw admin-1 (province/state) borders integrated into the sphere. */
  showAdminBorders?: boolean;
  /** Draw tiered place-name labels: country names when zoomed out, province/
   *  state names when zoomed in (decluttered, front hemisphere only). */
  showPlaceLabels?: boolean;
  /** URL of the {countries,admin1} label anchors JSON. */
  labelsUrl?: string;
  /** Marker glyph: "dot" (pulsing circle, default) or "pin" (silver teardrop
   *  with the tip on the coordinate — the MapLibre Global View marker). */
  markerShape?: GlobeMarkerShape;
  /** Show the solid center of a pulsing dot marker. The signal rings remain
   *  visible when disabled. */
  showMarkerCore?: boolean;
  /** Show the pulsing ring and halo for dot markers. */
  showMarkerWaves?: boolean;
  /** Highlighted marker id (larger pin + stronger glow). */
  selectedMarkerId?: string | null;
  /** Fired when a marker is clicked. */
  onMarkerClick?: (id: string) => void;
  /** Enables polygon hit-testing on the rendered countries. */
  enableGeographySelection?: boolean;
  /** Additional selectable geographic areas, such as maritime corridors. */
  geographyRegions?: GlobeRegionDefinition[];
  /** Selected country/region id, used by the cartographic highlight layer. */
  selectedGeographyId?: string | null;
  /** Fired with the exact clicked point on a country/region surface. */
  onGeographySelect?: (geography: GlobeGeographySelection) => void;
  /** Fired when the pointer crosses a selectable country/region boundary. */
  onGeographyHover?: (geography: GlobeGeographySelection | null) => void;
  /** Fired after three compact clicks on empty globe/atmosphere space. */
  onAtmosphereTripleClick?: () => void;
  /** Camera-distance reduction applied by focusMarker. */
  focusZoomOffset?: number;
  /** Small latitude framing correction, in degrees, applied while focusing. */
  focusLatitudeBiasDeg?: number;
  /** Per-frame focus damping. Lower values produce a slower glide. */
  focusEasing?: number;
  /** Screen-space framing, in px: positive values move the globe left so it
   *  stays clear of a right-hand panel. Geographic camera is untouched. */
  screenOffsetX?: number;
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
  /** Camera-distance change per zoom-button click. */
  zoomStep: number;
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

// Default camera framing — the geographic point held at the centre of the
// frame and the globe's tilt, tuned to the reference "old-world" view (Europe
// top, Africa lower-left, Arabia centred). With the spherePoint mapping the
// framing decomposes cleanly into an Euler pitch/yaw:
//   centre latitude  = pitch (rotation.x)
//   centre longitude = -yaw  (rotation.y)
// Both the initial mount rotation and "Center View" reuse these, and the
// auto-rotation spins about the globe's own polar axis so this tilt is kept.
const VIEW_CENTER_LAT = 20; // °N held at frame centre
const VIEW_CENTER_LNG = 42; // °E held at frame centre
const FRAME_PITCH = THREE.MathUtils.degToRad(VIEW_CENTER_LAT);
const FRAME_YAW = THREE.MathUtils.degToRad(-VIEW_CENTER_LNG);

// Rotation model — a real-globe turntable, not a free trackball. Orientation is
// two scalars: `lon` spins the sphere about its OWN polar axis (scrolls the
// longitude at frame centre) and `lat` tilts that pole toward/away (the latitude
// at frame centre). The quaternion is rebuilt as Euler(lat, lon, 0) every frame,
// so there is NEVER any roll — north stays up and the pivot stays dead-centre on
// the sphere. `lat` is clamped so the globe can't flip over a pole.
//   centre latitude  =  lat
//   centre longitude = -lon
const MAX_TILT = THREE.MathUtils.degToRad(82);

// Admin-1 (province / state) borders are hidden at the default framing and only
// fade in once the analyst has zoomed in — they stay invisible for the first
// few zoom-in clicks and begin appearing around the 4th click from Center View
// (camera z ≈ 3.5), reaching full strength a couple of clicks deeper. This
// keeps the wide "situational" view clean; the fine internal borders are detail
// you opt into by zooming. Values are camera-distance (z), so they track the
// zoomStep ladder above.
const ADMIN_FADE_START_Z = 3.3; // hidden at/above this camera distance (revealed deeper in)
const ADMIN_FADE_END_Z = 2.9; // full opacity at/below
const ADMIN_MAX_OPACITY = 0.065; // very faint — province/state lines sit well behind the country borders

// Place-name labels — a small DOM pool projected over the globe, tiered by zoom
// and decluttered. Country names show at the wide framing and fade OUT as you
// zoom in; admin-1 (province/state) names fade IN around the depth the admin
// borders appear — a clean hand-off from country to province naming.
const PLACE_LABEL_POOL = 26; // max labels drawn at once
const PLACE_LABEL_MIN_SPACING_PX = 46; // greedy declutter spacing
const PLACE_LABEL_RIM = 0.16; // hide labels nearer the rim than this (front-face z of unit normal)
const COUNTRY_LABEL_NEAR_Z = 3.4; // country names fully gone at/below
const COUNTRY_LABEL_FAR_Z = 4.0; // country names full at/above
const ADMIN_LABEL_FAR_Z = 3.3; // admin-1 names hidden at/above (matches the border reveal depth)
const ADMIN_LABEL_NEAR_Z = 2.9; // admin-1 names full at/below

// Pointer-drag rotation per pixel. Scaled by (camera z / cfg.zoom) at drag time:
// zoomed in, the globe fills more of the screen so the same angle sweeps the
// surface much farther — without the scale, close zoom feels hypersensitive.
const DRAG_YAW_SENSITIVITY = 0.0021;
const DRAG_PITCH_SENSITIVITY = 0.0015;
const DRAG_ZOOM_FACTOR_MIN = 0.4;
const DRAG_ZOOM_FACTOR_MAX = 1.0;
const ATMOSPHERE_CLICK_INTERVAL_MS = 760;
const ATMOSPHERE_CLICK_RADIUS_PX = 42;

const SIZE_CONFIG: Record<EchisGlobeSize, SizeConfig> = {
  hero: {
    // zoomMin 2.0 + zoomStep 0.25 → Center View (4.5) reaches the closest zoom
    // in 10 zoom-in clicks; the admin-1 borders + province names fade in from
    // ~the 5th click and reach full a couple of clicks deeper, leaving room to
    // keep zooming past for close inspection (see ADMIN_FADE_* below).
    fov: 32, zoom: 4.5, zoomMin: 2.0, zoomMax: 6.4, zoomStep: 0.25, radius: 1.5, autoRotate: 0.05,
    offsetY: -0.06, offsetX: 0, graticule: true, stars: true, markers: true,
    labels: true, atmosphere: 0.15, exposure: 0.96, markerScale: 1,
  },
  panel: {
    fov: 30, zoom: 4.6, zoomMin: 3.8, zoomMax: 6.0, zoomStep: 0.45, radius: 1.5, autoRotate: 0.07,
    offsetY: 0, offsetX: 0, graticule: true, stars: false, markers: true,
    labels: false, atmosphere: 0.13, exposure: 0.95, markerScale: 0.82,
  },
  mini: {
    fov: 30, zoom: 4.35, zoomMin: 4.0, zoomMax: 5.2, zoomStep: 0.45, radius: 1.5, autoRotate: 0.14,
    offsetY: 0, offsetX: 0, graticule: false, stars: false, markers: false,
    labels: false, atmosphere: 0.11, exposure: 0.95, markerScale: 0.7,
  },
};

/** Invisible pick body radius, as a multiple of the drawn dot radius. */
const HIT_RADIUS_FACTOR = 3.4;

export type GlobeMarkerShape = "dot" | "pin";

type MarkerRuntime = {
  marker: GlobeMarker;
  shape: GlobeMarkerShape;
  // "dot" shape parts
  dot: THREE.Mesh | null;
  ring: THREE.Sprite | null;
  halo: THREE.Sprite | null;
  /** Invisible, larger click/hover body — dots only (pins raycast directly). */
  hit: THREE.Mesh | null;
  // "pin" shape parts — one composite sprite, swapped between the two textures.
  pin: THREE.Sprite | null;
  texDefault: THREE.CanvasTexture | null;
  texSelected: THREE.CanvasTexture | null;
  baseDot: number;
  local: THREE.Vector3;
  normal: THREE.Vector3;
  phase: number;
};

// Same ladder the MapLibre marker layers used: crimson → amber → silver.
// (No gold/yellow step — it is outside the app's crimson/black/silver palette.)
const MARKER_COLOR: Record<GlobeMarkerLevel, number> = {
  critical: 0xff3d4f,
  high: 0xff7a3c,
  medium: 0xc6cad4,
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

// ---------------------------------------------------------------------------
// Composite pin marker — a faithful raster of the MapLibre Global View marker
// stack, drawn once per (level, selected) into a single canvas so the whole
// thing can ride the sphere as one constant-screen-size billboard:
//
//   • colored halo    — the "signal" circle: level-tinted soft disc at the
//                        pin head (crimson / amber / silver by severity)
//   • selection bloom — large soft crimson disc (selected only)
//   • selection glow  — tight crimson disc + ring (selected only)
//   • silver teardrop — the 36×46 body + inner ring (ring silver, or crimson
//                        when selected), tip on the coordinate
//
// All px values below are the MapLibre on-screen px (icon-size 0.68/0.80,
// circle radii 8/7/5/22/11, translate −16), and the sprite is scaled every
// frame so a canvas px maps 1:1 to a screen px regardless of zoom.
// ---------------------------------------------------------------------------
const PIN_BODY_STOPS: Array<[number, string]> = [
  [0.0, "#C0C3CA"], [0.22, "#92959E"], [0.42, "#565962"],
  [0.62, "#2F3036"], [0.82, "#1A191F"], [1.0, "#0A090D"],
];

// Canvas is sized in on-screen px; tip sits at the bottom-centre, head (where
// every glow/halo is centred) is 16px above the tip — MapLibre's translate.
const PIN_CANVAS_W = 60;
const PIN_CANVAS_H = 66;
const PIN_TIP_X = PIN_CANVAS_W / 2;
const PIN_TIP_Y = PIN_CANVAS_H;
const PIN_HEAD_Y = PIN_TIP_Y - 16;
const PIN_ASPECT = PIN_CANVAS_W / PIN_CANVAS_H;
const PIN_ICON_SIZE_DEFAULT = 0.68;
const PIN_ICON_SIZE_HOVER = 0.73;
const PIN_ICON_SIZE_SELECTED = 0.8;

/** Level → colored-halo tint [r,g,b] + radius(px) + peak alpha, matching the
 *  MapLibre signal circle (color × opacity 0.36; silver carries its own 0.72). */
const PIN_HALO: Record<GlobeMarkerLevel, { rgb: [number, number, number]; r: number; peak: number }> = {
  critical: { rgb: [255, 61, 79], r: 8, peak: 0.36 },
  high: { rgb: [255, 122, 60], r: 7, peak: 0.36 },
  medium: { rgb: [198, 202, 212], r: 5, peak: 0.26 },
  low: { rgb: [198, 202, 212], r: 5, peak: 0.26 },
};

function drawSoftDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: [number, number, number],
  peak: number,
) {
  const [r, g, b] = rgb;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},${peak})`);
  gradient.addColorStop(0.45, `rgba(${r},${g},${b},${peak * 0.85})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function buildMarkerTexture(level: GlobeMarkerLevel, selected: boolean) {
  const supersample = 3;
  const canvas = document.createElement("canvas");
  canvas.width = PIN_CANVAS_W * supersample;
  canvas.height = PIN_CANVAS_H * supersample;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.scale(supersample, supersample);

  // 1 — selection bloom (r22, blur .94) behind everything.
  if (selected) drawSoftDisc(ctx, PIN_TIP_X, PIN_HEAD_Y, 22 * 1.7, [255, 61, 79], 0.26);

  // 2 — level-tinted signal halo.
  const halo = PIN_HALO[level];
  drawSoftDisc(ctx, PIN_TIP_X, PIN_HEAD_Y, halo.r * 1.7, halo.rgb, halo.peak);

  // 3 — selection glow (r11, blur .34) + crisp ring.
  if (selected) {
    drawSoftDisc(ctx, PIN_TIP_X, PIN_HEAD_Y, 11 * 1.3, [255, 61, 79], 0.42);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,61,79,0.9)";
    ctx.beginPath();
    ctx.arc(PIN_TIP_X, PIN_HEAD_Y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4 — silver teardrop pin, tip at (PIN_TIP_X, PIN_TIP_Y).
  const size = selected ? PIN_ICON_SIZE_SELECTED : PIN_ICON_SIZE_DEFAULT;
  const s = 0.75 * size; // 27px width / 36 viewBox
  ctx.save();
  ctx.translate(PIN_TIP_X - 18 * s, PIN_TIP_Y - 45 * s);
  ctx.scale(s, s);
  // Body (verbatim path from the SVG marker).
  ctx.beginPath();
  ctx.moveTo(18, 1);
  ctx.bezierCurveTo(9, 1, 2, 8, 2, 17);
  ctx.bezierCurveTo(2, 28, 18, 45, 18, 45);
  ctx.bezierCurveTo(18, 45, 34, 28, 34, 17);
  ctx.bezierCurveTo(34, 8, 27, 1, 18, 1);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, 1, 0, 45);
  PIN_BODY_STOPS.forEach(([stop, color]) => body.addColorStop(stop, color));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 0.4;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.stroke();
  // Inner well + level ring.
  ctx.beginPath();
  ctx.arc(18, 17, 9.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,16,22,0.92)";
  ctx.fill();
  ctx.lineWidth = selected ? 1.2 : 0.9;
  ctx.strokeStyle = selected ? "#FF3D4F" : "#BABDC5";
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addOutlineFromGeo(
  geo: OutlineGeo,
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
  const coordinates = outline.geometry.coordinates as Position[][];
  coordinates.forEach((line) => {
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

type GlobePolygonGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

type OutlineFeature = {
  properties?: { kind?: string; id?: string; name?: string };
  geometry?:
    | GlobePolygonGeometry
    | { type?: string; coordinates: Position[][] };
};

type InteractiveGeographyFeature = {
  selection: GlobeGeographySelection;
  geometry: GlobePolygonGeometry;
};

function unwrapRing(ring: Position[]) {
  const unwrapped: Position[] = [];
  let previousLng: number | null = null;
  for (const [rawLng, lat] of ring) {
    let lng = rawLng;
    if (previousLng !== null) {
      while (lng - previousLng > 180) lng -= 360;
      while (lng - previousLng < -180) lng += 360;
    }
    unwrapped.push([lng, lat]);
    previousLng = lng;
  }
  return unwrapped;
}

function ringContainsPoint(ring: Position[], lng: number, lat: number) {
  const unwrapped = unwrapRing(ring);
  if (unwrapped.length < 3) return false;
  const reference = unwrapped.reduce((sum, point) => sum + point[0], 0) / unwrapped.length;
  let testLng = lng;
  while (testLng - reference > 180) testLng -= 360;
  while (testLng - reference < -180) testLng += 360;

  let inside = false;
  for (let i = 0, j = unwrapped.length - 1; i < unwrapped.length; j = i, i += 1) {
    const [xi, yi] = unwrapped[i];
    const [xj, yj] = unwrapped[j];
    const crosses =
      yi > lat !== yj > lat &&
      testLng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonContainsPoint(rings: Position[][], lng: number, lat: number) {
  if (!rings[0] || !ringContainsPoint(rings[0], lng, lat)) return false;
  return !rings.slice(1).some((hole) => ringContainsPoint(hole, lng, lat));
}

function geographyContainsPoint(
  geometry: GlobePolygonGeometry,
  lng: number,
  lat: number,
) {
  if (geometry.type === "Polygon") {
    return polygonContainsPoint(geometry.coordinates, lng, lat);
  }
  return geometry.coordinates.some((polygon) =>
    polygonContainsPoint(polygon, lng, lat),
  );
}

function polygonSets(geometry: GlobePolygonGeometry) {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function geographyFocusPoint(geometry: GlobePolygonGeometry) {
  let largest:
    | { area: number; lng: number; lat: number }
    | null = null;

  for (const polygon of polygonSets(geometry)) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;
    const ring = unwrapRing(outer);
    let crossSum = 0;
    let lngSum = 0;
    let latSum = 0;

    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      const cross = current[0] * next[1] - next[0] * current[1];
      crossSum += cross;
      lngSum += (current[0] + next[0]) * cross;
      latSum += (current[1] + next[1]) * cross;
    }

    const area = Math.abs(crossSum);
    if (area < 1e-6 || (largest && area <= largest.area)) continue;
    const lng = lngSum / (3 * crossSum);
    const lat = latSum / (3 * crossSum);
    largest = {
      area,
      lng: ((lng + 540) % 360) - 180,
      lat: THREE.MathUtils.clamp(lat, -85, 85),
    };
  }

  return largest
    ? { lng: largest.lng, lat: largest.lat }
    : { lng: 0, lat: 0 };
}

function buildGeographyOutlineGeometry(
  geometry: GlobePolygonGeometry,
  radius: number,
) {
  const positions: number[] = [];
  for (const polygon of polygonSets(geometry)) {
    for (const ring of polygon) {
      const unwrapped = unwrapRing(ring);
      for (let index = 1; index < unwrapped.length; index += 1) {
        const previous = unwrapped[index - 1];
        const current = unwrapped[index];
        const a = spherePoint(previous[0], previous[1], radius);
        const b = spherePoint(current[0], current[1], radius);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return buffer;
}

function buildGeographyFillGeometry(
  geometry: GlobePolygonGeometry,
  radius: number,
) {
  const positions: number[] = [];
  const appendTriangle = (
    a: THREE.Vector2,
    b: THREE.Vector2,
    c: THREE.Vector2,
    depth: number,
  ) => {
    if (depth <= 0) {
      for (const vertex of [a, b, c]) {
        const point = spherePoint(vertex.x, vertex.y, radius);
        positions.push(point.x, point.y, point.z);
      }
      return;
    }
    const ab = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
    const bc = new THREE.Vector2((b.x + c.x) / 2, (b.y + c.y) / 2);
    const ca = new THREE.Vector2((c.x + a.x) / 2, (c.y + a.y) / 2);
    appendTriangle(a, ab, ca, depth - 1);
    appendTriangle(ab, b, bc, depth - 1);
    appendTriangle(ca, bc, c, depth - 1);
    appendTriangle(ab, bc, ca, depth - 1);
  };

  for (const polygon of polygonSets(geometry)) {
    const outer = polygon[0];
    if (!outer || outer.length < 4) continue;
    const contour = unwrapRing(outer.slice(0, -1)).map(
      ([lng, lat]) => new THREE.Vector2(lng, lat),
    );
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const face of faces) {
      const a = contour[face[0]];
      const b = contour[face[1]];
      const c = contour[face[2]];
      const span = Math.max(
        Math.abs(a.x - b.x),
        Math.abs(b.x - c.x),
        Math.abs(c.x - a.x),
        Math.abs(a.y - b.y),
        Math.abs(b.y - c.y),
        Math.abs(c.y - a.y),
      );
      const depth = span > 18 ? 3 : span > 8 ? 2 : span > 3 ? 1 : 0;
      appendTriangle(a, b, c, depth);
    }
  }
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return buffer;
}

/** Parsed-GeoJSON shape addOutlineFromGeo consumes. */
type OutlineGeo = {
  features?: OutlineFeature[];
};

// Border GeoJSON is fetched + JSON.parsed once per URL, then the parsed result
// is kept for the app's lifetime. The country and (~2 MB) admin-1 files are
// shared by every globe — Home, Global View, SOCMINT, Intel Watch — and each of
// those screens mounts/unmounts its own EchisGlobe on every switch. Previously
// each switch re-downloaded and, more expensively, re-parsed the whole file,
// which is why the borders visibly "popped in" late each time. Now only the
// first visit pays that cost; later mounts read the parsed object instantly and
// just rebuild the (cheap) line geometry for their own scene.
const outlineGeoCache = new Map<string, Promise<OutlineGeo>>();

function loadOutlineGeo(url: string): Promise<OutlineGeo> {
  let pending = outlineGeoCache.get(url);
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Outline fetch failed: ${res.status}`);
      return res.json() as Promise<OutlineGeo>;
    });
    // A rejected fetch must not be cached forever — drop it so a later mount retries.
    pending.catch(() => outlineGeoCache.delete(url));
    outlineGeoCache.set(url, pending);
  }
  return pending;
}

/** {countries, admin1} place-label anchors, parsed once per URL (see loadOutlineGeo). */
type PlaceLabelPoint = { n: string; lng: number; lat: number };
type PlaceLabelsData = { countries?: PlaceLabelPoint[]; admin1?: PlaceLabelPoint[] };
const placeLabelsCache = new Map<string, Promise<PlaceLabelsData>>();

function loadPlaceLabels(url: string): Promise<PlaceLabelsData> {
  let pending = placeLabelsCache.get(url);
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Labels fetch failed: ${res.status}`);
      return res.json() as Promise<PlaceLabelsData>;
    });
    pending.catch(() => placeLabelsCache.delete(url));
    placeLabelsCache.set(url, pending);
  }
  return pending;
}

/**
 * Warm the border + label caches ahead of time. Call this early (e.g. while the
 * opening screen is idle) so that by the time the analyst opens Global View /
 * SOCMINT / Intel Watch, the ~2 MB admin-1 file and the labels are already
 * fetched AND parsed — otherwise those requests only start on first mount and
 * queue behind the many RSS calls, so the borders/labels appear late (together
 * with the feeds) instead of with the globe.
 */
export function prefetchGlobeData(urls?: { country?: string; admin?: string; labels?: string }) {
  loadOutlineGeo(urls?.country ?? "/data/home-globe.geojson").catch(() => {});
  loadOutlineGeo(urls?.admin ?? "/data/home-globe-admin1.geojson").catch(() => {});
  loadPlaceLabels(urls?.labels ?? "/data/home-globe-labels.json").catch(() => {});
}

export const EchisGlobe = forwardRef<EchisGlobeHandle, EchisGlobeProps>(
  function EchisGlobe(
    {
      size = "hero",
      autoRotatePaused = false,
      geographyFocusZoomOffset = 1.45,
      geographyFocusEasing = 0.028,
      onAutoRotateStart,
      markers = [],
      showLabels,
      markerLabelVariant = "badge",
      showAdminBorders = false,
      showPlaceLabels = false,
      labelsUrl = "/data/home-globe-labels.json",
      markerShape = "dot",
      showMarkerCore = true,
      showMarkerWaves = true,
      selectedMarkerId = null,
      onMarkerClick,
      enableGeographySelection = false,
      geographyRegions = [],
      selectedGeographyId = null,
      onGeographySelect,
      onGeographyHover,
      onAtmosphereTripleClick,
      focusZoomOffset = 0.6,
      focusLatitudeBiasDeg = 0,
      focusEasing = 0.1,
      screenOffsetX = 0,
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
    const markerKeyRef = useRef("");
    const selectedRef = useRef<string | null>(selectedMarkerId);
    const selectedGeographyRef = useRef<string | null>(selectedGeographyId);
    const onMarkerClickRef = useRef<typeof onMarkerClick>(onMarkerClick);
    const onGeographySelectRef =
      useRef<typeof onGeographySelect>(onGeographySelect);
    const onGeographyHoverRef =
      useRef<typeof onGeographyHover>(onGeographyHover);
    const onAtmosphereTripleClickRef =
      useRef<typeof onAtmosphereTripleClick>(onAtmosphereTripleClick);
    const onAutoRotateStartRef =
      useRef<typeof onAutoRotateStart>(onAutoRotateStart);
    const geographyRegionsRef = useRef(geographyRegions);
    const [error, setError] = useState<string | null>(null);

    const runtimeRef = useRef<{
      lon: number;
      lat: number;
      targetLon: number;
      targetLat: number;
      easing: boolean;
      easingFactor: number;
      zoomEasingFactor: number;
      targetZoom: number;
      interactionUntil: number;
      markerKey: string;
      rebuildMarkers: (markers: GlobeMarker[]) => void;
      project: (lng: number, lat: number) => { x: number; y: number; visible: boolean } | null;
    } | null>(null);

    const markerKey = useMemo(
      () => markers.map((m) => `${m.id}:${m.lng}:${m.lat}:${m.level}:${m.pulseStartedAtMs ?? ""}:${m.pulseDurationMs ?? ""}:${m.pulseScale ?? ""}:${m.displayStartedAtMs ?? ""}:${m.displayDurationMs ?? ""}:${m.displayCycleMs ?? ""}:${m.regionKey ?? ""}`).join("|"),
      [markers],
    );
    const geographyRegionKey = useMemo(
      () =>
        geographyRegions
          .map((region) => `${region.id}:${region.lng}:${region.lat}`)
          .join("|"),
      [geographyRegions],
    );

    useEffect(() => { pausedRef.current = autoRotatePaused; }, [autoRotatePaused]);
    useEffect(() => {
      markersRef.current = markers;
      markerKeyRef.current = markerKey;
    }, [markers, markerKey]);
    useEffect(() => { selectedRef.current = selectedMarkerId; }, [selectedMarkerId]);
    useEffect(() => {
      selectedGeographyRef.current = selectedGeographyId;
    }, [selectedGeographyId]);
    useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
    useEffect(() => {
      onGeographySelectRef.current = onGeographySelect;
    }, [onGeographySelect]);
    useEffect(() => {
      onGeographyHoverRef.current = onGeographyHover;
    }, [onGeographyHover]);
    useEffect(() => {
      onAtmosphereTripleClickRef.current = onAtmosphereTripleClick;
    }, [onAtmosphereTripleClick]);
    useEffect(() => {
      onAutoRotateStartRef.current = onAutoRotateStart;
    }, [onAutoRotateStart]);
    useEffect(() => {
      geographyRegionsRef.current = geographyRegions;
    }, [geographyRegions, geographyRegionKey]);

    useImperativeHandle(
      ref,
      (): EchisGlobeHandle => ({
        zoomIn: () => {
          const s = runtimeRef.current; if (!s) return;
          s.targetZoom = Math.max(cfg.zoomMin, s.targetZoom - cfg.zoomStep);
          s.zoomEasingFactor = 0.06;
          s.interactionUntil = performance.now() + 12_000;
        },
        zoomOut: () => {
          const s = runtimeRef.current; if (!s) return;
          s.targetZoom = Math.min(cfg.zoomMax, s.targetZoom + cfg.zoomStep);
          s.zoomEasingFactor = 0.06;
          s.interactionUntil = performance.now() + 12_000;
        },
        centerView: () => {
          const s = runtimeRef.current; if (!s) return;
          s.targetLon = FRAME_YAW;
          s.targetLat = FRAME_PITCH;
          s.easing = true;
          s.easingFactor = 0.1;
          s.zoomEasingFactor = 0.06;
          s.targetZoom = cfg.zoom;
          s.interactionUntil = performance.now() + 5_000;
        },
        focusMarker: (lng, lat) => {
          const s = runtimeRef.current; if (!s) return;
          // Bring the marker to frame centre with north still up (centre lng =
          // -lon, centre lat = lat) — no roll, unlike a look-at quaternion.
          s.targetLon = THREE.MathUtils.degToRad(-lng);
          s.targetLat = THREE.MathUtils.clamp(
            THREE.MathUtils.degToRad(lat + focusLatitudeBiasDeg),
            -MAX_TILT,
            MAX_TILT,
          );
          s.easing = true;
          s.easingFactor = focusEasing;
          s.zoomEasingFactor = Math.max(0.02, focusEasing * 0.75);
          s.targetZoom = Math.max(cfg.zoomMin, cfg.zoom - focusZoomOffset);
          s.interactionUntil = performance.now() + 12_000;
        },
        focusGeography: (lng, lat) => {
          const s = runtimeRef.current;
          if (!s) return false;
          s.targetLon = THREE.MathUtils.degToRad(-lng);
          s.targetLat = THREE.MathUtils.clamp(
            THREE.MathUtils.degToRad(lat + 0.8),
            -MAX_TILT,
            MAX_TILT,
          );
          s.easing = true;
          s.easingFactor = geographyFocusEasing;
          s.zoomEasingFactor = Math.max(0.018, geographyFocusEasing * 0.72);
          s.targetZoom = Math.max(
            cfg.zoomMin,
            cfg.zoom - geographyFocusZoomOffset,
          );
          s.interactionUntil = performance.now() + 12_000;
          return true;
        },
        projectMarker: (lng, lat) => runtimeRef.current?.project(lng, lat) ?? null,
        setAutoRotatePaused: (paused) => { pausedRef.current = paused; },
        resumeAutoRotate: () => {
          const s = runtimeRef.current;
          if (!s) return;
          pausedRef.current = false;
          s.easing = false;
          s.targetZoom = cfg.zoom;
          s.zoomEasingFactor = 0.045;
          s.interactionUntil = 0;
        },
      }),
      [
        cfg,
        focusEasing,
        focusLatitudeBiasDeg,
        focusZoomOffset,
        geographyFocusEasing,
        geographyFocusZoomOffset,
      ],
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
      Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", cursor: "grab" });
      renderer.domElement.setAttribute("aria-label", "Interactive strategic globe");
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.1, 100);
      camera.position.set(0, 0, cfg.zoom);

      const globe = new THREE.Group();
      globe.rotation.set(FRAME_PITCH, FRAME_YAW, 0);
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

      const countryGeographies: InteractiveGeographyFeature[] = [];
      const regionGeographies: InteractiveGeographyFeature[] =
        geographyRegionsRef.current.map((region) => ({
          selection: {
            id: region.id,
            name: region.name,
            kind: "region",
            lng: region.lng,
            lat: region.lat,
          },
          geometry: { type: "Polygon", coordinates: region.rings },
        }));
      const geographyById = new Map<string, InteractiveGeographyFeature>();
      regionGeographies.forEach((feature) =>
        geographyById.set(feature.selection.id, feature),
      );

      const regionGuideMaterial = new THREE.LineBasicMaterial({
        color: 0xc9824d,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      disposables.push(regionGuideMaterial);
      for (const region of regionGeographies) {
        const geometry = buildGeographyOutlineGeometry(
          region.geometry,
          RADIUS + 0.008,
        );
        const guide = new THREE.LineSegments(geometry, regionGuideMaterial);
        guide.renderOrder = 1;
        globe.add(guide);
        disposables.push(geometry);
      }

      const selectedFillMaterial = new THREE.MeshBasicMaterial({
        color: 0xd31f35,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const selectedLineMaterial = new THREE.LineBasicMaterial({
        color: 0xff6575,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      });
      const hoverFillMaterial = new THREE.MeshBasicMaterial({
        color: 0xc9824d,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const hoverLineMaterial = new THREE.LineBasicMaterial({
        color: 0xffb078,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      });
      disposables.push(
        selectedFillMaterial,
        selectedLineMaterial,
        hoverFillMaterial,
        hoverLineMaterial,
      );

      const selectedFill = new THREE.Mesh(
        new THREE.BufferGeometry(),
        selectedFillMaterial,
      );
      const selectedLine = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        selectedLineMaterial,
      );
      const hoverFill = new THREE.Mesh(
        new THREE.BufferGeometry(),
        hoverFillMaterial,
      );
      const hoverLine = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        hoverLineMaterial,
      );
      selectedFill.visible = false;
      selectedLine.visible = false;
      hoverFill.visible = false;
      hoverLine.visible = false;
      selectedFill.renderOrder = 2;
      selectedLine.renderOrder = 4;
      hoverFill.renderOrder = 3;
      hoverLine.renderOrder = 5;
      globe.add(selectedFill, selectedLine, hoverFill, hoverLine);

      const setGeographyHighlight = (
        fill: THREE.Mesh,
        line: THREE.LineSegments,
        feature: InteractiveGeographyFeature | null,
        radiusOffset: number,
      ) => {
        fill.geometry.dispose();
        line.geometry.dispose();
        if (!feature) {
          fill.geometry = new THREE.BufferGeometry();
          line.geometry = new THREE.BufferGeometry();
          fill.visible = false;
          line.visible = false;
          return;
        }
        fill.geometry = buildGeographyFillGeometry(
          feature.geometry,
          RADIUS + radiusOffset,
        );
        line.geometry = buildGeographyOutlineGeometry(
          feature.geometry,
          RADIUS + radiusOffset + 0.004,
        );
        fill.visible = true;
        line.visible = true;
      };

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

      // Pin textures are cached per (level, selected) and reused across every
      // pin + across live marker rebuilds, so a feed batch never re-rasterises.
      const usePins = markerShape === "pin" && cfg.markers;
      const pinTexCache = new Map<string, THREE.CanvasTexture>();
      const getPinTexture = (level: GlobeMarkerLevel, selected: boolean) => {
        const cacheKey = `${level}:${selected ? 1 : 0}`;
        let texture = pinTexCache.get(cacheKey);
        if (!texture) {
          texture = buildMarkerTexture(level, selected);
          pinTexCache.set(cacheKey, texture);
          disposables.push(texture);
        }
        return texture;
      };
      // Reused per-frame scratch for constant-screen-size pin scaling.
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2));
      const pinWorldPos = new THREE.Vector3();

      // Markers — rebuilt in place (see `rebuildMarkers`) so live marker
      // updates never tear down the renderer, the border geometry, or the
      // camera the analyst is currently dragging.
      let markerRuntimes: MarkerRuntime[] = [];
      let pickTargets: THREE.Object3D[] = [];
      let markerObjects: THREE.Object3D[] = [];
      let markerDisposables: Array<{ dispose: () => void }> = [];

      const disposeMarkers = () => {
        markerObjects.forEach((object) => globe.remove(object));
        markerDisposables.forEach((d) => { try { d.dispose(); } catch { /* noop */ } });
        markerRuntimes = [];
        pickTargets = [];
        markerObjects = [];
        markerDisposables = [];
      };

      const rebuildMarkers = (list: GlobeMarker[]) => {
        disposeMarkers();
        if (!cfg.markers) return;
        list.forEach((marker) => {
          const hex = MARKER_COLOR[marker.level] ?? MARKER_COLOR.medium;
          const p = spherePoint(marker.lng, marker.lat, RADIUS + 0.012);
          const baseDot = 0.02 * cfg.markerScale;
          const local = p.clone();
          const normal = p.clone().normalize();
          const phase = Math.random();

          if (usePins) {
            // Composite pin: bottom-anchored sprite so the tip meets the
            // coordinate; billboards like MapLibre's viewport-anchored icon,
            // sized to a constant screen px in the animate loop, raycast
            // directly for clicks. Colored halo + selection glow are baked in.
            // toneMapped:false so the silver gradient keeps its authored values
            // (ACES tone mapping would mute it away from the MapLibre pin).
            const texDefault = getPinTexture(marker.level, false);
            const texSelected = getPinTexture(marker.level, true);
            // The pin is a screen-facing billboard whose tip sits on the
            // sphere. Keeping depth testing enabled lets the curved globe
            // occlude the upper part of that flat billboard, most visibly on
            // the lower hemisphere while rotating. Back-side visibility is
            // already handled explicitly in the animation loop, so render the
            // complete front-side pin above the globe surface.
            const pinMat = new THREE.SpriteMaterial({
              map: texDefault,
              transparent: true,
              depthTest: false,
              depthWrite: false,
              toneMapped: false,
            });
            const pin = new THREE.Sprite(pinMat);
            pin.center.set(0.5, 0);
            pin.position.copy(p);
            pin.renderOrder = 20;
            pin.userData.markerId = marker.id;
            globe.add(pin);
            pickTargets.push(pin);

            markerObjects.push(pin);
            markerDisposables.push(pinMat);
            markerRuntimes.push({ marker, shape: "pin", dot: null, ring: null, halo: null, hit: null, pin, texDefault, texSelected, baseDot, local, normal, phase });
            return;
          }

          let dot: THREE.Mesh | null = null;
          if (showMarkerCore) {
            const dotGeom = new THREE.SphereGeometry(baseDot, 16, 16);
            const dotMat = new THREE.MeshBasicMaterial({ color: hex });
            dot = new THREE.Mesh(dotGeom, dotMat);
            dot.position.copy(p);
            globe.add(dot);
            markerObjects.push(dot);
            markerDisposables.push(dotGeom, dotMat);
          }

          // Invisible, larger pick body — the drawn dot is far smaller than a
          // comfortable click target (MapLibre's circle layer was ~9px).
          let hit: THREE.Mesh | null = null;
          if (onMarkerClickRef.current) {
            const hitGeom = new THREE.SphereGeometry(baseDot * HIT_RADIUS_FACTOR, 10, 10);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            hit = new THREE.Mesh(hitGeom, hitMat);
            hit.position.copy(p);
            hit.userData.markerId = marker.id;
            globe.add(hit);
            pickTargets.push(hit);
            markerObjects.push(hit);
            markerDisposables.push(hitGeom, hitMat);
          }

          let ring: THREE.Sprite | null = null;
          let halo: THREE.Sprite | null = null;
          if (showMarkerWaves) {
            const ringTex = makeRingTexture(hex);
            const ringMat = new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
            ring = new THREE.Sprite(ringMat);
            ring.position.copy(p); ring.scale.set(0.02, 0.02, 1); globe.add(ring);

            const haloMat = new THREE.SpriteMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
            halo = new THREE.Sprite(haloMat);
            halo.position.copy(p); halo.scale.set(0.1, 0.1, 1); globe.add(halo);

            markerObjects.push(ring, halo);
            markerDisposables.push(ringMat, haloMat, ringTex);
          }
          markerRuntimes.push({ marker, shape: "dot", dot, ring, halo, hit, pin: null, texDefault: null, texSelected: null, baseDot, local, normal, phase });
        });
      };
      rebuildMarkers(markersRef.current);

      // Lighting
      scene.add(new THREE.AmbientLight(0x2b2f38, 0.72));
      const key = new THREE.DirectionalLight(0xf3eff1, 1.3); key.position.set(-4.6, 4.6, 4.2); scene.add(key);
      const rim = new THREE.DirectionalLight(0xff3b4d, 0.55); rim.position.set(4.5, -1.5, -5); scene.add(rim);
      const fill = new THREE.DirectionalLight(0x3a3f48, 0.4); fill.position.set(3, 2, 4); scene.add(fill);

      const state = {
        lon: FRAME_YAW,
        lat: FRAME_PITCH,
        targetLon: FRAME_YAW,
        targetLat: FRAME_PITCH,
        easing: false,
        easingFactor: 0.1,
        zoomEasingFactor: 0.06,
        targetZoom: cfg.zoom,
        interactionUntil: 0,
        /** Marker set currently in the scene — lets the marker effect skip the
         *  redundant rebuild right after a fresh mount. */
        markerKey: markerKeyRef.current,
        rebuildMarkers,
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
      // Admin-1 borders (integrated, fainter) — behind country lines. Opacity
      // starts at 0 and is driven by camera distance in the animate loop, so the
      // province/state lines only reveal once the analyst zooms in.
      const adminMat = new THREE.LineBasicMaterial({ color: 0xff5a64, transparent: true, opacity: 0, depthWrite: false });
      disposables.push(adminMat);

      let cancelled = false;
      loadOutlineGeo(geojsonUrl)
        .then((geo) => {
          if (cancelled) return;
          const g = addOutlineFromGeo(
            geo,
            globe,
            RADIUS + 0.006,
            borderMat,
            "outline",
          );
          if (g) disposables.push(g);
          if (!enableGeographySelection) return;

          for (const feature of geo.features ?? []) {
            const { id, kind, name } = feature.properties ?? {};
            const geometry = feature.geometry;
            if (
              kind !== "land" ||
              !id ||
              !name ||
              !geometry ||
              (geometry.type !== "Polygon" &&
                geometry.type !== "MultiPolygon")
            ) {
              continue;
            }
            const interactive: InteractiveGeographyFeature = {
              selection: {
                id: `country-${id}`,
                name,
                kind: "country",
                ...geographyFocusPoint(geometry as GlobePolygonGeometry),
              },
              geometry: geometry as GlobePolygonGeometry,
            };
            countryGeographies.push(interactive);
            geographyById.set(interactive.selection.id, interactive);
          }
        })
        .catch(() => {});
      if (showAdminBorders) {
        loadOutlineGeo(adminGeojsonUrl)
          .then((geo) => { if (!cancelled) { const g = addOutlineFromGeo(geo, globe, RADIUS + 0.0055, adminMat, "admin1-outline"); if (g) disposables.push(g); } })
          .catch(() => {});
      }

      // ----- Place-name labels (country / admin-1), tiered by zoom -----------
      // Perf model: the expensive work — scanning all ~4.7k labels, projecting
      // and decluttering — runs on a throttle (LABEL_RESCAN_MS), NOT every
      // frame. Every frame only the ≤PLACE_LABEL_POOL currently-bound labels are
      // reprojected + eased, so the per-frame cost is flat and small regardless
      // of dataset size (the earlier per-frame full scan + object allocation was
      // a real source of GC stutter). Each label holds a STABLE slot while
      // visible, so rotation never swaps text between slots (flicker).
      type PreparedLabel = { id: number; name: string; normal: THREE.Vector3; tier: 0 | 1 };
      type LabelSlot = { el: HTMLDivElement; id: number; tier: -1 | 0 | 1; opacity: number; keep: boolean; normal: THREE.Vector3 | null };
      let preparedLabels: PreparedLabel[] = [];
      let labelLayer: HTMLDivElement | null = null;
      const labelPool: LabelSlot[] = [];
      const slotByLabelId = new Map<number, number>(); // label id -> pool index
      const chosenLabelIds = new Set<number>();
      const labelNormalScratch = new THREE.Vector3();
      const labelProjScratch = new THREE.Vector3();
      const labelOriginScratch = new THREE.Vector3();
      const placedX: number[] = [];
      const placedY: number[] = [];
      const LABEL_FONT_MONO = "var(--font-mono, 'JetBrains Mono', monospace)";
      const LABEL_FONT_UI = "var(--font-ui, 'Hanken Grotesk', sans-serif)";
      const LABEL_OPACITY_EASE = 0.16;
      const LABEL_RESCAN_MS = 110;
      let lastLabelScanAt = -1e9;

      if (showPlaceLabels) {
        labelLayer = document.createElement("div");
        Object.assign(labelLayer.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "4", overflow: "hidden" });
        mount.appendChild(labelLayer);
        for (let i = 0; i < PLACE_LABEL_POOL; i += 1) {
          const el = document.createElement("div");
          Object.assign(el.style, {
            position: "absolute", left: "0", top: "0", whiteSpace: "nowrap", opacity: "0",
            transform: "translate(-2000px,-2000px)", willChange: "transform, opacity",
            transformOrigin: "left top", textShadow: "0 1px 6px rgba(0,0,0,.92)",
          });
          labelLayer.appendChild(el);
          labelPool.push({ el, id: -1, tier: -1, opacity: 0, keep: false, normal: null });
        }
        loadPlaceLabels(labelsUrl)
          .then((data) => {
            if (cancelled) return;
            const prepared: PreparedLabel[] = [];
            for (const p of data.countries ?? []) prepared.push({ id: prepared.length, name: p.n, normal: spherePoint(p.lng, p.lat, 1).normalize(), tier: 0 });
            for (const p of data.admin1 ?? []) prepared.push({ id: prepared.length, name: p.n, normal: spherePoint(p.lng, p.lat, 1).normalize(), tier: 1 });
            preparedLabels = prepared;
          })
          .catch(() => {});
      }

      const styleLabelTier = (el: HTMLDivElement, tier: 0 | 1) => {
        if (tier === 0) {
          Object.assign(el.style, { fontFamily: LABEL_FONT_UI, fontSize: "10px", fontWeight: "600", letterSpacing: ".05em", color: "rgba(226,230,236,.82)", textTransform: "none" });
        } else {
          Object.assign(el.style, { fontFamily: LABEL_FONT_MONO, fontSize: "8px", fontWeight: "500", letterSpacing: ".09em", color: "rgba(198,204,214,.58)", textTransform: "uppercase" });
        }
      };

      const zoomTierOpacity = (tier: 0 | 1, z: number) =>
        tier === 0
          ? THREE.MathUtils.clamp((z - COUNTRY_LABEL_NEAR_Z) / (COUNTRY_LABEL_FAR_Z - COUNTRY_LABEL_NEAR_Z), 0, 1)
          : THREE.MathUtils.clamp((ADMIN_LABEL_FAR_Z - z) / (ADMIN_LABEL_FAR_Z - ADMIN_LABEL_NEAR_Z), 0, 1);

      type LabelCandidate = { id: number; name: string; tier: 0 | 1; x: number; y: number; prio: number; normal: THREE.Vector3 };
      const labelCandidates: LabelCandidate[] = [];

      // Throttled: pick which labels are shown (front hemisphere, in view,
      // decluttered, nearest the centre first) and bind them to stable slots.
      // Already-bound labels get a priority bonus (hysteresis) so the set stays
      // steady while the globe rotates.
      const rescanLabels = (gq: THREE.Quaternion) => {
        const z = camera.position.z;
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        labelOriginScratch.set(0, 0, 0).project(camera);
        const centreX = (labelOriginScratch.x * 0.5 + 0.5) * width;
        const centreY = (-labelOriginScratch.y * 0.5 + 0.5) * height;

        labelCandidates.length = 0;
        for (const label of preparedLabels) {
          if (zoomTierOpacity(label.tier, z) < 0.03) continue;
          labelNormalScratch.copy(label.normal).applyQuaternion(gq);
          if (labelNormalScratch.z < PLACE_LABEL_RIM) continue;
          labelProjScratch.copy(labelNormalScratch).multiplyScalar(RADIUS + 0.02).project(camera);
          const x = (labelProjScratch.x * 0.5 + 0.5) * width;
          const y = (-labelProjScratch.y * 0.5 + 0.5) * height;
          if (x < -40 || x > width + 40 || y < -16 || y > height + 16) continue;
          const dx = x - centreX;
          const dy = y - centreY;
          const distSq = dx * dx + dy * dy;
          labelCandidates.push({ id: label.id, name: label.name, tier: label.tier, x, y, prio: slotByLabelId.has(label.id) ? distSq * 0.5 : distSq, normal: label.normal });
        }
        labelCandidates.sort((a, b) => a.prio - b.prio);

        chosenLabelIds.clear();
        placedX.length = 0;
        placedY.length = 0;
        const minSpacingSq = PLACE_LABEL_MIN_SPACING_PX * PLACE_LABEL_MIN_SPACING_PX;
        for (const candidate of labelCandidates) {
          let clash = false;
          for (let i = 0; i < placedX.length; i += 1) {
            const ddx = candidate.x - placedX[i];
            const ddy = candidate.y - placedY[i];
            if (ddx * ddx + ddy * ddy < minSpacingSq) { clash = true; break; }
          }
          if (clash) continue;
          let slotIndex = slotByLabelId.get(candidate.id);
          if (slotIndex === undefined) {
            slotIndex = -1;
            for (let i = 0; i < labelPool.length; i += 1) {
              if (labelPool[i].id === -1) { slotIndex = i; break; }
            }
            if (slotIndex === -1) continue; // pool full — this label waits
            const slot = labelPool[slotIndex];
            slot.id = candidate.id;
            slot.tier = candidate.tier;
            slot.normal = candidate.normal;
            slotByLabelId.set(candidate.id, slotIndex);
            styleLabelTier(slot.el, candidate.tier);
            slot.el.textContent = candidate.name;
          }
          labelPool[slotIndex].keep = true;
          placedX.push(candidate.x);
          placedY.push(candidate.y);
          chosenLabelIds.add(candidate.id);
        }
        for (const slot of labelPool) {
          if (slot.id !== -1 && !chosenLabelIds.has(slot.id)) slot.keep = false;
        }
      };

      // Per frame: reproject + ease only the bound slots (≤ pool size) so motion
      // is smooth; release a slot once it has fully faded out.
      const updateLabelSlots = (gq: THREE.Quaternion) => {
        const z = camera.position.z;
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        for (const slot of labelPool) {
          if (slot.id === -1 || !slot.normal) continue;
          labelNormalScratch.copy(slot.normal).applyQuaternion(gq);
          const front = labelNormalScratch.z >= PLACE_LABEL_RIM;
          let target = 0;
          if (slot.keep && front) {
            const tierOpacity = zoomTierOpacity(slot.tier === 1 ? 1 : 0, z);
            if (tierOpacity > 0.001) {
              labelProjScratch.copy(labelNormalScratch).multiplyScalar(RADIUS + 0.02).project(camera);
              const x = (labelProjScratch.x * 0.5 + 0.5) * width;
              const y = (-labelProjScratch.y * 0.5 + 0.5) * height;
              slot.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
              target = tierOpacity * THREE.MathUtils.smoothstep(labelNormalScratch.z, PLACE_LABEL_RIM, 0.42);
            }
          }
          slot.opacity += (target - slot.opacity) * LABEL_OPACITY_EASE;
          if (slot.opacity < 0.012 && target === 0) {
            slot.opacity = 0;
            slot.el.style.opacity = "0";
            slotByLabelId.delete(slot.id);
            slot.id = -1;
            slot.tier = -1;
            slot.normal = null;
            slot.keep = false;
            continue;
          }
          slot.el.style.opacity = slot.opacity.toFixed(3);
        }
      };

      const updatePlaceLabels = (gq: THREE.Quaternion, now: number) => {
        if (!labelLayer) return;
        if (now - lastLabelScanAt >= LABEL_RESCAN_MS) {
          lastLabelScanAt = now;
          rescanLabels(gq);
        }
        updateLabelSlots(gq);
      };

      const resize = () => {
        const { clientWidth: width, clientHeight: height } = mount;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // A positive x offset shifts the rendered scene left, which is how the
        // globe is kept clear of the right-hand feed panel (mirrors the
        // screen-space framing padding MapLibre used on these screens).
        camera.setViewOffset(
          width,
          height,
          Math.round(cfg.offsetX * width + screenOffsetX),
          Math.round(cfg.offsetY * height),
          width,
          height,
        );
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
      const hoverNdc = new THREE.Vector2();
      let hoverDirty = false;
      let hoveredId: string | null = null;
      let hoveredGeographyId: string | null = null;
      let appliedHoveredGeographyId: string | null = null;
      let appliedSelectedGeographyId: string | null = null;
      const geographyLocalPoint = new THREE.Vector3();
      let atmosphereClickCount = 0;
      let atmosphereLastClickAt = 0;
      let atmosphereLastClickX = 0;
      let atmosphereLastClickY = 0;
      let atmosphereClickTimer: number | null = null;

      const resetAtmosphereClicks = () => {
        atmosphereClickCount = 0;
        atmosphereLastClickAt = 0;
        if (atmosphereClickTimer !== null) {
          window.clearTimeout(atmosphereClickTimer);
          atmosphereClickTimer = null;
        }
      };

      const registerAtmosphereClick = (event: PointerEvent) => {
        const now = performance.now();
        const deltaX = event.clientX - atmosphereLastClickX;
        const deltaY = event.clientY - atmosphereLastClickY;
        const closeInTime =
          now - atmosphereLastClickAt <= ATMOSPHERE_CLICK_INTERVAL_MS;
        const closeInSpace =
          Math.hypot(deltaX, deltaY) <= ATMOSPHERE_CLICK_RADIUS_PX;

        atmosphereClickCount =
          closeInTime && closeInSpace ? atmosphereClickCount + 1 : 1;
        atmosphereLastClickAt = now;
        atmosphereLastClickX = event.clientX;
        atmosphereLastClickY = event.clientY;

        if (atmosphereClickTimer !== null) {
          window.clearTimeout(atmosphereClickTimer);
        }
        atmosphereClickTimer = window.setTimeout(
          resetAtmosphereClicks,
          ATMOSPHERE_CLICK_INTERVAL_MS,
        );

        if (atmosphereClickCount === 3) {
          resetAtmosphereClicks();
          onAtmosphereTripleClickRef.current?.();
        }
      };

      /** Nearest front-facing marker under the given NDC point, if any. */
      const pickMarkerAt = (point: THREE.Vector2) => {
        if (!pickTargets.length) return null;
        raycaster.setFromCamera(point, camera);
        const hits = raycaster.intersectObjects(pickTargets, false);
        // `visible` is kept in sync with the front hemisphere each frame;
        // three.js raycasts hidden objects too, so filter explicitly.
        const nearest = hits.find((h) => h.object.visible);
        return (nearest?.object.userData.markerId as string | undefined) ?? null;
      };

      const pickGeographyAt = (point: THREE.Vector2) => {
        if (!enableGeographySelection) return null;
        raycaster.setFromCamera(point, camera);
        const hit = raycaster.intersectObject(sphere, false)[0];
        if (!hit) return null;
        geographyLocalPoint.copy(hit.point);
        globe.worldToLocal(geographyLocalPoint);
        const length = geographyLocalPoint.length();
        if (!length) return null;
        const lng = THREE.MathUtils.radToDeg(
          Math.atan2(geographyLocalPoint.x, geographyLocalPoint.z),
        );
        const lat = THREE.MathUtils.radToDeg(
          Math.asin(
            THREE.MathUtils.clamp(geographyLocalPoint.y / length, -1, 1),
          ),
        );
        const containsPoint = (candidate: InteractiveGeographyFeature) =>
          geographyContainsPoint(candidate.geometry, lng, lat);
        const feature =
          countryGeographies.find(containsPoint) ??
          regionGeographies.find(containsPoint);
        if (!feature) return null;
        return {
          feature,
          selection: feature.selection,
        };
      };

      const onPointerDown = (event: PointerEvent) => {
        dragging = true; moved = 0;
        previousX = event.clientX; previousY = event.clientY;
        state.easing = false;
        state.interactionUntil = performance.now() + 12_000;
        el.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!dragging) {
          // Hover hit-test is deferred to the next frame so a fast pointer
          // sweep can never fire more raycasts than there are rendered frames.
          const rect = el.getBoundingClientRect();
          hoverNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          hoverNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          hoverDirty = true;
          return;
        }
        const dx = event.clientX - previousX;
        const dy = event.clientY - previousY;
        moved += Math.abs(dx) + Math.abs(dy);
        previousX = event.clientX; previousY = event.clientY;
        // Turntable drag: horizontal → spin the sphere about its polar axis
        // (longitude), vertical → tilt (latitude), clamped. No roll ever, so the
        // globe never "loses its up" or drifts off an off-centre pivot.
        const zoomFactor = THREE.MathUtils.clamp(camera.position.z / cfg.zoom, DRAG_ZOOM_FACTOR_MIN, DRAG_ZOOM_FACTOR_MAX);
        state.lon += dx * DRAG_YAW_SENSITIVITY * zoomFactor;
        state.lat = THREE.MathUtils.clamp(state.lat + dy * DRAG_PITCH_SENSITIVITY * zoomFactor, -MAX_TILT, MAX_TILT);
        state.easing = false;
      };
      const onPointerUp = (event: PointerEvent) => {
        dragging = false;
        if (moved < 5) {
          const rect = el.getBoundingClientRect();
          ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          const id = onMarkerClickRef.current ? pickMarkerAt(ndc) : null;
          if (id) {
            resetAtmosphereClicks();
            onMarkerClickRef.current?.(id);
            return;
          }
          const geography = pickGeographyAt(ndc);
          if (geography) {
            resetAtmosphereClicks();
            onGeographySelectRef.current?.(geography.selection);
            return;
          }
          registerAtmosphereClick(event);
          return;
        }
        resetAtmosphereClicks();
      };
      const onPointerCancel = () => {
        dragging = false;
        resetAtmosphereClicks();
      };
      const onPointerLeave = () => {
        resetAtmosphereClicks();
        hoverDirty = false;
        hoveredId = null;
        hoveredGeographyId = null;
        onGeographyHoverRef.current?.(null);
        el.style.cursor = "grab";
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        state.targetZoom = THREE.MathUtils.clamp(state.targetZoom + event.deltaY * 0.002, cfg.zoomMin, cfg.zoomMax);
        state.zoomEasingFactor = 0.06;
        state.interactionUntil = performance.now() + 12_000;
      };
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", onPointerUp);
      el.addEventListener("pointercancel", onPointerCancel);
      el.addEventListener("pointerleave", onPointerLeave);
      el.addEventListener("wheel", onWheel, { passive: false });

      // Reused per-frame scratch — allocating THREE objects inside the animate
      // loop churns the GC and shows up as periodic stutter.
      const markerNormalScratch = new THREE.Vector3();

      let frameId = 0;
      let lastFrame = performance.now();
      let elapsed = 0;
      let wasAutoRotating = false;
      const animate = (now: number) => {
        frameId = requestAnimationFrame(animate);
        const delta = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.05);
        lastFrame = now; elapsed += delta;

        // Rotation = real-globe turntable (lon spin + clamped lat tilt, no roll).
        // Eased moves (Center View / focus) glide lon+lat to their targets along
        // the shortest path; otherwise the idle globe auto-rotates by advancing
        // lon. The orientation is rebuilt from the two scalars every frame.
        if (state.easing) {
          let deltaLon = state.targetLon - state.lon;
          deltaLon = Math.atan2(Math.sin(deltaLon), Math.cos(deltaLon)); // shortest signed path
          const deltaLat = state.targetLat - state.lat;
          state.lon += deltaLon * state.easingFactor;
          state.lat += deltaLat * state.easingFactor;
          if (Math.abs(deltaLon) < 0.002 && Math.abs(deltaLat) < 0.002) {
            state.lon = state.targetLon;
            state.lat = state.targetLat;
            state.easing = false;
          }
        } else if (!dragging && !pausedRef.current && now > state.interactionUntil) {
          if (!wasAutoRotating) {
            wasAutoRotating = true;
            onAutoRotateStartRef.current?.();
          }
          state.lon += delta * cfg.autoRotate;
        } else {
          wasAutoRotating = false;
        }
        state.lat = THREE.MathUtils.clamp(state.lat, -MAX_TILT, MAX_TILT);
        globe.rotation.set(state.lat, state.lon, 0);

        camera.position.z = THREE.MathUtils.lerp(
          camera.position.z,
          state.targetZoom,
          state.zoomEasingFactor,
        );

        // Reveal the admin-1 borders by zoom: invisible at the wide framing,
        // fading in as the camera closes past ADMIN_FADE_START_Z (~4th zoom-in
        // click) to full at ADMIN_FADE_END_Z.
        if (showAdminBorders) {
          const revealT = THREE.MathUtils.clamp(
            (ADMIN_FADE_START_Z - camera.position.z) / (ADMIN_FADE_START_Z - ADMIN_FADE_END_Z),
            0,
            1,
          );
          adminMat.opacity = revealT * ADMIN_MAX_OPACITY;
        }

        if (hoverDirty) {
          hoverDirty = false;
          const nextHovered =
            dragging || !onMarkerClickRef.current
              ? null
              : pickMarkerAt(hoverNdc);
          const nextGeography =
            dragging || nextHovered ? null : pickGeographyAt(hoverNdc);
          if (nextHovered !== hoveredId) {
            hoveredId = nextHovered;
          }
          const nextGeographyId =
            nextGeography?.feature.selection.id ?? null;
          if (nextGeographyId !== hoveredGeographyId) {
            hoveredGeographyId = nextGeographyId;
            onGeographyHoverRef.current?.(
              nextGeography?.selection ?? null,
            );
          }
          el.style.cursor =
            hoveredId || hoveredGeographyId ? "pointer" : "grab";
        }

        const gq = globe.quaternion;
        const selectedGeographyIdNow = selectedGeographyRef.current;
        if (
          selectedGeographyIdNow !== appliedSelectedGeographyId ||
          (selectedGeographyIdNow !== null && !selectedLine.visible)
        ) {
          const selectedGeography = selectedGeographyIdNow
            ? geographyById.get(selectedGeographyIdNow) ?? null
            : null;
          setGeographyHighlight(
            selectedFill,
            selectedLine,
            selectedGeography,
            0.008,
          );
          appliedSelectedGeographyId = selectedGeography
            ? selectedGeographyIdNow
            : null;
        }
        const visibleHoveredGeographyId =
          hoveredGeographyId === selectedGeographyIdNow
            ? null
            : hoveredGeographyId;
        if (visibleHoveredGeographyId !== appliedHoveredGeographyId) {
          setGeographyHighlight(
            hoverFill,
            hoverLine,
            visibleHoveredGeographyId
              ? geographyById.get(visibleHoveredGeographyId) ?? null
              : null,
            0.01,
          );
          appliedHoveredGeographyId = visibleHoveredGeographyId;
        }
        const selId = selectedRef.current;
        let hoverStillPresent = false;
        for (const mk of markerRuntimes) {
          const worldNormal = markerNormalScratch.copy(mk.normal).applyQuaternion(gq);
          const front = worldNormal.z > 0.02;
          const selected = selId === mk.marker.id;
          const hovered = hoveredId === mk.marker.id;
          if (hovered && front) hoverStillPresent = true;

          if (mk.shape === "pin" && mk.pin) {
            mk.pin.visible = front;
            // Swap to the selected composite (crimson ring + glow baked in).
            const wantTex = selected ? mk.texSelected : mk.texDefault;
            const pinMat = mk.pin.material as THREE.SpriteMaterial;
            if (wantTex && pinMat.map !== wantTex) {
              pinMat.map = wantTex;
              pinMat.needsUpdate = true;
            }
            if (front) {
              // Constant screen size: scale so the canvas maps ~1:1 to px at
              // any zoom, like MapLibre's viewport-anchored icon. Hover nudges
              // the size up (0.68 → 0.73); selected already bakes 0.80.
              pinWorldPos.copy(mk.local).applyQuaternion(gq);
              const dist = camera.position.distanceTo(pinWorldPos);
              const grow = !selected && hovered ? PIN_ICON_SIZE_HOVER / PIN_ICON_SIZE_DEFAULT : 1;
              const h = (PIN_CANVAS_H / mount.clientHeight) * 2 * dist * tanHalfFov * grow;
              mk.pin.scale.set(h * PIN_ASPECT, h, 1);
            }
          } else if (mk.ring && mk.halo) {
            const hasOneShotPulse =
              mk.marker.pulseStartedAtMs !== undefined &&
              mk.marker.pulseDurationMs !== undefined;
            const rawPulseProgress = hasOneShotPulse
              ? (now - mk.marker.pulseStartedAtMs!) / mk.marker.pulseDurationMs!
              : 0;
            const pulseVisible = !hasOneShotPulse ||
              (rawPulseProgress >= 0 && rawPulseProgress < 1);
            if (mk.dot) mk.dot.visible = front && pulseVisible;
            mk.ring.visible = front && pulseVisible;
            mk.halo.visible = front && pulseVisible;
            if (mk.hit) mk.hit.visible = front && pulseVisible;
            if (mk.dot) {
              const dotScale = selected ? 1.9 : hovered ? 1.45 : 1;
              mk.dot.scale.setScalar(dotScale);
            }
            const t = hasOneShotPulse
              ? THREE.MathUtils.clamp(rawPulseProgress, 0, 1)
              : (elapsed * 0.55 + mk.phase) % 1;
            const pulseScale = mk.marker.pulseScale ?? 1;
            const waveTravel = hasOneShotPulse ? 0.17 : 0.16;
            const s = (0.025 + t * waveTravel) * cfg.markerScale * pulseScale * (selected ? 1.4 : 1);
            mk.ring.scale.set(s, s, 1);
            (mk.ring.material as THREE.SpriteMaterial).opacity = (1 - t) *
              (hasOneShotPulse ? 0.62 : selected ? 0.95 : 0.7);
            const hs = (0.065 + 0.012 * Math.sin(elapsed * 2 + mk.phase * 6)) * cfg.markerScale * pulseScale * (selected ? 1.5 : 1);
            mk.halo.scale.set(hs, hs, 1);
            (mk.halo.material as THREE.SpriteMaterial).opacity = hasOneShotPulse
              ? (1 - t) * 0.28
              : selected ? 0.8 : 0.5;
          }

          if (labelsEnabled) {
            const labelEl = labelRefs.current[mk.marker.id];
            if (labelEl) {
              const projected = markerNormalScratch.copy(mk.local).applyQuaternion(gq).project(camera);
              const x = (projected.x * 0.5 + 0.5) * mount.clientWidth;
              const y = (-projected.y * 0.5 + 0.5) * mount.clientHeight;
              const hasDisplayWindow =
                mk.marker.displayStartedAtMs !== undefined &&
                mk.marker.displayDurationMs !== undefined;
              const displayElapsed = hasDisplayWindow
                ? now - mk.marker.displayStartedAtMs!
                : 0;
              const cycledElapsed =
                hasDisplayWindow && mk.marker.displayCycleMs
                  ? ((displayElapsed % mk.marker.displayCycleMs) +
                      mk.marker.displayCycleMs) %
                    mk.marker.displayCycleMs
                  : displayElapsed;
              const displayProgress = hasDisplayWindow
                ? cycledElapsed / mk.marker.displayDurationMs!
                : 0.5;
              const fadeIn = THREE.MathUtils.clamp(displayProgress / 0.16, 0, 1);
              const fadeOut = THREE.MathUtils.clamp((1 - displayProgress) / 0.27, 0, 1);
              const displayOpacity = hasDisplayWindow && displayProgress >= 0 && displayProgress < 1
                ? Math.min(fadeIn, fadeOut)
                : hasDisplayWindow
                  ? 0
                  : 1;
              labelEl.style.transform = `translate(${x}px, ${y}px)`;
              labelEl.style.opacity = front ? displayOpacity.toFixed(3) : "0";
            }
          }
        }

        // The hovered marker can disappear under the pointer — a data refresh
        // drops it, or the globe rotates it to the back — and no pointer event
        // follows, so the cursor has to be released here.
        if (hoveredId && !hoverStillPresent) {
          hoveredId = null;
          el.style.cursor = hoveredGeographyId ? "pointer" : "grab";
        }

        if (showPlaceLabels) updatePlaceLabels(gq, now);

        renderer.render(scene, camera);
      };
      frameId = requestAnimationFrame(animate);

      return () => {
        cancelled = true;
        cancelAnimationFrame(frameId);
        observer.disconnect();
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("pointercancel", onPointerCancel);
        el.removeEventListener("pointerleave", onPointerLeave);
        el.removeEventListener("wheel", onWheel);
        resetAtmosphereClicks();
        runtimeRef.current = null;
        disposeMarkers();
        selectedFill.geometry.dispose();
        selectedLine.geometry.dispose();
        hoverFill.geometry.dispose();
        hoverLine.geometry.dispose();
        if (labelLayer) labelLayer.remove();
        disposables.forEach((d) => { try { d.dispose(); } catch { /* noop */ } });
        renderer.dispose();
        renderer.forceContextLoss();
        el.remove();
      };
    }, [size, geojsonUrl, adminGeojsonUrl, showAdminBorders, showPlaceLabels, labelsUrl, labelsEnabled, screenOffsetX, markerShape, showMarkerCore, showMarkerWaves, enableGeographySelection, geographyRegionKey, cfg, geographyFocusEasing, geographyFocusZoomOffset]);

    // Marker updates are applied to the live scene — rebuilding the renderer
    // here would reset the camera mid-drag every time a feed batch lands.
    useEffect(() => {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.markerKey === markerKey) return;
      runtime.markerKey = markerKey;
      runtime.rebuildMarkers(markersRef.current);
    }, [markerKey]);

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
                transition: markerLabelVariant === "country-card" ? "opacity .6s ease" : "opacity .28s ease",
              }}
            >
              <div style={{ position: "absolute", left: 0, bottom: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex", flexDirection: "column",
                    gap: markerLabelVariant === "country-card" ? 5 : 1,
                    minWidth: markerLabelVariant === "country-card" ? 116 : undefined,
                    padding: markerLabelVariant === "country-card" ? "9px 11px 8px" : "4px 7px",
                    border: markerLabelVariant === "country-card"
                      ? "1px solid rgba(231,235,240,.12)"
                      : marker.level === "critical" ? "1px solid rgba(239,61,79,.32)" : "1px solid rgba(255,255,255,.1)",
                    borderLeftColor: markerLabelVariant === "country-card"
                      ? marker.level === "high" || marker.level === "critical"
                        ? "rgba(224,76,91,.62)"
                        : "rgba(209,215,224,.34)"
                      : undefined,
                    borderRadius: markerLabelVariant === "country-card" ? 2 : 8,
                    background: markerLabelVariant === "country-card"
                      ? "linear-gradient(135deg,rgba(15,14,17,.84),rgba(7,7,9,.68))"
                      : marker.level === "critical" ? "rgba(15,7,9,.78)" : "rgba(9,8,10,.76)",
                    backdropFilter: markerLabelVariant === "country-card" ? "blur(14px) saturate(.78)" : "blur(10px)",
                    boxShadow: markerLabelVariant === "country-card"
                      ? "0 18px 46px rgba(0,0,0,.34), inset 0 1px rgba(255,255,255,.025)"
                      : "0 12px 34px rgba(0,0,0,.45)",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  }}
                >
                  <span style={{
                    fontSize: markerLabelVariant === "country-card" ? 8 : 7,
                    fontWeight: markerLabelVariant === "country-card" ? 560 : 650,
                    letterSpacing: markerLabelVariant === "country-card" ? ".13em" : ".1em",
                    color: markerLabelVariant === "country-card"
                      ? "rgba(231,234,239,.9)"
                      : marker.level === "critical" ? "rgba(235,72,72,.94)" : "rgba(216,220,226,.86)",
                  }}>
                    {(marker.label ?? marker.id).toUpperCase()}
                  </span>
                  {marker.detail && (
                    <span style={{
                      fontSize: markerLabelVariant === "country-card" ? 6 : 6,
                      letterSpacing: markerLabelVariant === "country-card" ? ".11em" : ".07em",
                      color: markerLabelVariant === "country-card"
                        ? "rgba(147,157,171,.72)"
                        : marker.level === "critical" ? "rgba(235,72,72,.8)" : "rgba(200,117,46,.9)",
                    }}>
                      {marker.detail}
                    </span>
                  )}
                </div>
                <div style={{
                  width: 1,
                  height: markerLabelVariant === "country-card" ? 19 : 16,
                  background: markerLabelVariant === "country-card"
                    ? marker.level === "high" || marker.level === "critical"
                      ? "linear-gradient(180deg,rgba(210,65,81,.18),rgba(226,74,91,.72))"
                      : "linear-gradient(180deg,rgba(201,207,216,.08),rgba(201,207,216,.48))"
                    : marker.level === "critical" ? "linear-gradient(180deg,rgba(255,60,74,.3),rgba(255,60,74,.9))" : "linear-gradient(180deg,rgba(255,120,80,.3),rgba(255,120,80,.85))",
                }} />
                {showMarkerCore && (
                  <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: -1, background: marker.level === "critical" ? "#ef3d4f" : "#ff7a3c", boxShadow: marker.level === "critical" ? "0 0 12px rgba(239,61,79,.9)" : "0 0 10px rgba(255,122,60,.85)" }} />
                )}
              </div>
            </div>
          ))}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(200,120,130,.8)", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: 11 }}>
            Globe unavailable · {error}
          </div>
        )}
      </div>
    );
  },
);
