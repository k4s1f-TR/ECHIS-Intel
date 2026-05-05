"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { feature, mesh } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import landAtlas from "world-atlas/land-110m.json";
import { countryLabels } from "@/data/countryLabels";
import { worldCapitals } from "@/data/worldCapitals";
import type { OsintEvent } from "@/types/event";
import type { SocmintReport } from "@/types/socmint";
import {
  cameraForMode,
  paddingForMode,
  type MapMode,
} from "./cameraPresets";

const GLOBE_RADIUS = 84;
const CAMERA_FOV = 34;
const CONTROL_ZOOM_DELTA = 0.34;
const MIN_LATITUDE = -72;
const MAX_LATITUDE = 78;
const AUTO_ROTATE_IDLE_RESUME_MS = 1600;
const LABEL_EDGE_MARGIN = 18;
const LABEL_VIEWPORT_MARGIN = 10;
const LABEL_DENSITY_BUCKET_WIDTH = 210;
const LABEL_DENSITY_BUCKET_HEIGHT = 138;
const LABEL_INTERACTION_FREEZE_MS = 220;
const COUNTRY_LABEL_RECOMPUTE_THRESHOLD = {
  lng: 18,
  lat: 8,
  bearing: 12,
} as const;
const COUNTRY_LABEL_FACE_THRESHOLD = {
  show: 0.075,
  hide: -0.03,
} as const;
const COUNTRY_LABEL_EDGE_HYSTERESIS = {
  show: LABEL_EDGE_MARGIN,
  hide: 4,
} as const;
const CENTER_TOLERANCE = {
  lng: 0.12,
  lat: 0.12,
  zoom: 0.02,
  bearing: 0.25,
  pitch: 0.25,
};
const MAP_OUTER_BACKGROUND_COLOR = "#000000";
const MAP_WATER_COLOR = "#101315";
const MAP_WATER_TOP_COLOR = "#161A1C";
const MAP_WATER_BOTTOM_COLOR = "#0B0E10";
const MAP_LAND_COLOR = "#434749";
const MAP_LAND_HIGHLIGHT = "rgba(255,255,255,0.12)";
const MAP_LAND_MIDTONE = "rgba(255,255,255,0.028)";
const MAP_LAND_SHADE = "rgba(0,0,0,0.19)";
const MAP_BORDER_COLOR = "rgba(218, 223, 216, 0.24)";
const MAP_COASTLINE_COLOR = "rgba(238, 241, 235, 0.36)";
const MAP_ATMOSPHERE_COLOR = new THREE.Color("#d4dad4");
const BORDER_LINE_COLOR = "#B6BCB5";
const COASTLINE_LINE_COLOR = "#D8DED7";
const COUNTRY_LABEL_COLOR = "rgba(206, 211, 207, 0.8)";
const COUNTRY_LABEL_HALO = "rgba(0, 0, 0, 0.92)";
const CAPITAL_LABEL_COLOR = "rgba(194, 200, 196, 0.82)";
const WATER_LABEL_COLOR = "rgba(128, 133, 131, 0.46)";
const SIGNAL_MARKER_RADIUS = 86.4;
const EVENT_MARKER_RADIUS = 85.7;
const LABEL_RADIUS = 85.1;
const ATMOSPHERE_INNER_RADIUS = 85.8;
const BORDER_LINE_RADIUS = 84.28;
const COASTLINE_LINE_RADIUS = 84.38;
const STAGE_SHIFT_FACTOR = 0.5;
const DEG_TO_RAD = Math.PI / 180;

const WATER_LABELS = [
  { name: "North Atlantic Ocean", coordinates: [-27, 54], minZoom: 2.15 },
  { name: "Mediterranean Sea", coordinates: [25.5, 35.4], minZoom: 2.2 },
  { name: "Black Sea", coordinates: [34, 43.2], minZoom: 2.4 },
  { name: "Red Sea", coordinates: [38.7, 20.7], minZoom: 2.35 },
  { name: "Persian Gulf", coordinates: [51.8, 26.8], minZoom: 2.45 },
  { name: "Arabian Sea", coordinates: [61.5, 18.2], minZoom: 2.5 },
  { name: "Caspian Sea", coordinates: [51.2, 41.2], minZoom: 2.55 },
] as const;

const COUNTRY_CAPITAL_COORDINATES: { match: string[]; coordinates: [number, number] }[] = [
  { match: ["syria"], coordinates: [36.2765, 33.5138] },
  { match: ["jordan"], coordinates: [35.9106, 31.9539] },
  { match: ["iraq"], coordinates: [44.3661, 33.3152] },
  { match: ["iran"], coordinates: [51.389, 35.6892] },
  { match: ["lebanon"], coordinates: [35.5018, 33.8938] },
  { match: ["saudi arabia"], coordinates: [46.6753, 24.7136] },
  { match: ["yemen"], coordinates: [44.191, 15.3694] },
  { match: ["egypt"], coordinates: [31.2357, 30.0444] },
] as const;

const AREA_COORDINATES: { match: string[]; coordinates: [number, number] }[] = [
  { match: ["gaza"], coordinates: [34.4668, 31.5017] },
  { match: ["strait of hormuz", "hormuz"], coordinates: [56.2833, 26.5667] },
  { match: ["red sea"], coordinates: [42.3768, 15.5527] },
] as const;

type MarkerPalette = {
  fill: string;
  border: string;
  glow: string;
};

type SocmintMarkerSource = "telegram" | "website" | "x";

type LabelKind = "country" | "capital" | "water";

type LabelDefinition = {
  key: string;
  text: string;
  kind: LabelKind;
  coordinates: [number, number];
  minZoom: number;
  priority: number;
};

type LabelRuntimeState = {
  visible: boolean;
  lastVisibleAt: number;
  lastLeft: number;
  lastTop: number;
};

type CountryLabelSelectionAnchor = {
  mode: MapMode;
  zoomTier: number;
  centerLng: number;
  centerLat: number;
  bearing: number;
};

type GlobeViewState = {
  centerLng: number;
  centerLat: number;
  zoom: number;
  bearing: number;
  pitch: number;
  stageOffset: number;
};

type GlobeAnimation = {
  from: GlobeViewState;
  to: GlobeViewState;
  start: number;
  duration: number;
};

type GlobeMarkerEntry = {
  id: string;
  object: THREE.Sprite;
  localPosition: THREE.Vector3;
  kind: "event" | "signal";
};

type CountryLabelSpriteEntry = {
  key: string;
  sprite: THREE.Sprite;
  localPosition: THREE.Vector3;
  priority: number;
  text: string;
};

type GlobeEngine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  globeGroup: THREE.Group;
  countryLabelGroup: THREE.Group;
  countryLabelEntries: CountryLabelSpriteEntry[];
  eventGroup: THREE.Group;
  signalGroup: THREE.Group;
  markerEntries: GlobeMarkerEntry[];
  raycastTargets: THREE.Object3D[];
  currentView: GlobeViewState;
  targetView: GlobeViewState;
  animation: GlobeAnimation | null;
  animationFrame: number | null;
  lastFrameTime: number;
  isDragging: boolean;
  dragPointerId: number | null;
  dragStartX: number;
  dragStartY: number;
  dragStartView: GlobeViewState;
  clickMoved: boolean;
  hoverId: string | null;
  autoRotateSuppressed: boolean;
  autoRotateResumeAt: number | null;
  didInitialRender: boolean;
  labelRuntime: Record<string, LabelRuntimeState>;
  labelVisibilityFrozenUntil: number | null;
  countryLabelSelection: Set<string>;
  countryLabelSelectionAnchor: CountryLabelSelectionAnchor | null;
};

const DEFAULT_MARKER_PALETTE: MarkerPalette = {
  fill: "#2EEB8F",
  border: "#7CFFC0",
  glow: "rgba(46, 235, 143, 0.22)",
};

const SOCMINT_MARKER_COLORS: Record<SocmintMarkerSource, string> = {
  telegram: "#F04438",
  website: "#C7CDD6",
  x: "#3B82F6",
};

const CATEGORY_MARKER_PALETTES: Partial<Record<OsintEvent["category"], MarkerPalette>> = {
  conflict: {
    fill: "#FF3B30",
    border: "#FF8A80",
    glow: "rgba(255, 59, 48, 0.26)",
  },
  politics: {
    fill: "#3B82F6",
    border: "#93C5FD",
    glow: "rgba(59, 130, 246, 0.2)",
  },
  intel: DEFAULT_MARKER_PALETTE,
  maritime: {
    fill: "#22D3EE",
    border: "#A5F3FC",
    glow: "rgba(34, 211, 238, 0.18)",
  },
  humanitarian: {
    fill: "#34D399",
    border: "#A7F3D0",
    glow: "rgba(52, 211, 153, 0.16)",
  },
  energy: {
    fill: "#F59E0B",
    border: "#FCD34D",
    glow: "rgba(245, 158, 11, 0.18)",
  },
};

const TURKEY_POLITICS_MARKER_PALETTE: MarkerPalette = {
  fill: "#EF4444",
  border: "#FCA5A5",
  glow: "rgba(239, 68, 68, 0.24)",
};

const LABEL_DEFINITIONS: LabelDefinition[] = [
  ...countryLabels.map((label) => ({
    key: `country-${label.name}`,
    text: label.name,
    kind: "country" as const,
    coordinates: [...label.coordinates] as [number, number],
    minZoom: label.priority === 1 ? 1.42 : label.priority === 2 ? 1.82 : 2.26,
    priority: label.priority,
  })),
  ...worldCapitals.map((capital) => ({
    key: `capital-${capital.capital}`,
    text: capital.capital,
    kind: "capital" as const,
    coordinates: [...capital.coordinates] as [number, number],
    minZoom: capital.priority === 1 ? 1.96 : capital.priority === 2 ? 2.22 : 2.48,
    priority: capital.priority,
  })),
  ...WATER_LABELS.map((label) => ({
    key: `water-${label.name}`,
    text: label.name,
    kind: "water" as const,
    coordinates: [...label.coordinates] as [number, number],
    minZoom: label.minZoom,
    priority: 3,
  })),
];

const LABEL_ZOOM_HYSTERESIS = {
  country: { show: 0.02, hide: 0.12 },
  capital: { show: 0.08, hide: 0.2 },
  water: { show: 0.04, hide: 0.1 },
} as const;

const LABEL_VISIBILITY_STICK_MS = 360;
const LABEL_RECENT_VISIBLE_MS = 900;
const MONITOR_HOME_CAPITAL_ZOOM_BONUS = 0.9;
const MONITOR_HOME_WATER_ZOOM_BONUS = 0.12;
const MONITOR_HOME_CAPITAL_MIN_ZOOM = 6.0;

const GLOBAL_LABEL_MIN_ZOOM_OVERRIDES: Partial<Record<string, number>> = {
  "country-Democratic Republic of the Congo": 5.56,
};

const MONITOR_HOME_LABEL_MIN_ZOOM_OVERRIDES: Partial<Record<string, number>> = {
  "country-Belgium": 3.2,
  "country-Switzerland": 3.28,
  "country-Austria": 3.28,
  "country-Czechia": 3.36,
  "country-Slovakia": 3.34,
  "country-Slovenia": 3.44,
  "country-Croatia": 3.44,
  "country-Bosnia and Herzegovina": 3.7,
  "country-Serbia": 3.5,
  "country-Montenegro": 3.76,
  "country-Albania": 3.68,
  "country-North Macedonia": 3.74,
  "country-Bulgaria": 3.34,
  "country-Romania": 3.08,
  "country-Latvia": 3.48,
  "country-Lithuania": 3.42,
  "country-Estonia": 3.54,
  "country-Belarus": 3.12,
  "country-Georgia": 3.18,
  "country-Armenia": 3.34,
  "country-Azerbaijan": 3.3,
  "country-Cyprus": 3.56,
  "country-Lebanon": 3.72,
  "country-Israel": 3.46,
  "country-Jordan": 3.52,
  "country-Qatar": 3.86,
  "country-United Arab Emirates": 3.94,
  "country-Kuwait": 3.72,
  "country-Oman": 3.18,
  "country-Djibouti": 3.9,
  "country-Eritrea": 3.44,
  "country-Uganda": 3.22,
  "country-Kenya": 3.18,
  "country-Equatorial Guinea": 3.7,
  "country-Cameroon": 3.42,
  "country-Central African Republic": 3.58,
  "country-Republic of the Congo": 3.62,
  "country-South Sudan": 3.42,
  "country-Tunisia": 3.08,
};

const MONITOR_HOME_STABLE_COUNTRY_MIN_ZOOM = {
  primary: 1.18,
  secondary: 1.42,
  tertiary: 2.34,
} as const;

const MONITOR_HOME_COUNTRY_SHORT_TEXT: Partial<Record<string, string>> = {
  "country-Democratic Republic of the Congo": "DR Congo",
  "country-Republic of the Congo": "Congo",
  "country-United Arab Emirates": "UAE",
  "country-Bosnia and Herzegovina": "Bosnia",
  "country-North Macedonia": "N. Macedonia",
  "country-Central African Republic": "CAR",
};
const ONLY_VISIBLE_GLOBE_LABEL_KEY = "country-Turkey";
const ONLY_VISIBLE_GLOBE_LABEL_TEXT = "TÜRKİYE";

const eventTextureCache = new Map<string, THREE.CanvasTexture>();
const signalTextureCache = new Map<SocmintMarkerSource, THREE.CanvasTexture>();
const countryLabelTextureCache = new Map<string, THREE.CanvasTexture>();

const countriesTopology = countriesAtlas as unknown as { objects: Record<string, unknown> };
const landTopology = landAtlas as unknown as { objects: Record<string, unknown> };

interface Props {
  mode: MapMode;
  events: OsintEvent[];
  selectedId: string | null;
  onSelectEvent?: (id: string) => void;
  signals?: SocmintReport[];
  selectedSignalId?: string | null;
  onSelectSignal?: (id: string) => void;
}

export interface GlobeMapHandle {
  centerView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

function setAnimatedView(
  engine: GlobeEngine,
  next: GlobeViewState,
  duration: number,
) {
  if (viewStateMatches(engine.currentView, next)) {
    engine.currentView = { ...next };
    engine.targetView = { ...next };
    engine.animation = null;
    return;
  }

  engine.targetView = { ...next };
  engine.animation = {
    from: { ...engine.currentView },
    to: { ...next },
    start: performance.now(),
    duration,
  };
  engine.labelVisibilityFrozenUntil = performance.now() + duration + LABEL_INTERACTION_FREEZE_MS;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function angleDelta(a: number, b: number) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function lerpAngle(from: number, to: number, t: number) {
  return from + angleDelta(to, from) * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function distanceFromZoom(zoom: number) {
  return clamp(420 * Math.pow(0.8, zoom - 1), 105, 520);
}

function zoomFromDistance(distance: number) {
  const zoom = 1 + Math.log(distance / 420) / Math.log(0.8);
  return clamp(zoom, 0.55, 7.2);
}

function effectiveLabelMinZoom(label: LabelDefinition, mode: MapMode) {
  const globalOverride = GLOBAL_LABEL_MIN_ZOOM_OVERRIDES[label.key];
  let minZoom = globalOverride !== undefined ? Math.max(label.minZoom, globalOverride) : label.minZoom;

  if (mode === "monitor-home") {
    const modeOverride = MONITOR_HOME_LABEL_MIN_ZOOM_OVERRIDES[label.key];
    if (modeOverride !== undefined) {
      minZoom = Math.max(minZoom, modeOverride);
    }

    if (label.kind === "capital") {
      return Math.max(minZoom + MONITOR_HOME_CAPITAL_ZOOM_BONUS, MONITOR_HOME_CAPITAL_MIN_ZOOM);
    }
    if (label.kind === "water") {
      return minZoom + MONITOR_HOME_WATER_ZOOM_BONUS;
    }
    if (label.kind === "country") {
      if (label.priority === 1) return Math.max(minZoom, MONITOR_HOME_STABLE_COUNTRY_MIN_ZOOM.primary);
      if (label.priority === 2) return Math.max(minZoom, MONITOR_HOME_STABLE_COUNTRY_MIN_ZOOM.secondary);
      return Math.max(minZoom, MONITOR_HOME_STABLE_COUNTRY_MIN_ZOOM.tertiary);
    }
  }

  return minZoom;
}

function displayTextForLabel(label: LabelDefinition, mode: MapMode, zoom: number) {
  if (mode === "monitor-home" && label.kind === "country" && zoom < 4.3) {
    return MONITOR_HOME_COUNTRY_SHORT_TEXT[label.key] ?? label.text;
  }
  return label.text;
}

function monitorHomeCountryZoomTier(zoom: number) {
  if (zoom < MONITOR_HOME_STABLE_COUNTRY_MIN_ZOOM.secondary) return 1;
  if (zoom < MONITOR_HOME_STABLE_COUNTRY_MIN_ZOOM.tertiary) return 2;
  return 3;
}

function shouldRecomputeMonitorHomeCountrySelection(engine: GlobeEngine) {
  const anchor = engine.countryLabelSelectionAnchor;
  const nextTier = monitorHomeCountryZoomTier(engine.currentView.zoom);
  if (!anchor || anchor.mode !== "monitor-home") return true;
  if (anchor.zoomTier !== nextTier) return true;
  if (Math.abs(angleDelta(engine.currentView.centerLng, anchor.centerLng)) >= COUNTRY_LABEL_RECOMPUTE_THRESHOLD.lng) return true;
  if (Math.abs(engine.currentView.centerLat - anchor.centerLat) >= COUNTRY_LABEL_RECOMPUTE_THRESHOLD.lat) return true;
  if (Math.abs(angleDelta(engine.currentView.bearing, anchor.bearing)) >= COUNTRY_LABEL_RECOMPUTE_THRESHOLD.bearing) return true;
  return false;
}

function recomputeMonitorHomeCountrySelection(engine: GlobeEngine) {
  const frame = getGlobeScreenFrame(engine);
  const viewportWidth = engine.renderer.domElement.clientWidth;
  const viewportHeight = engine.renderer.domElement.clientHeight;
  const occupied: { left: number; top: number; right: number; bottom: number }[] = [];
  const candidates: {
    key: string;
    rect: { left: number; top: number; right: number; bottom: number };
    minZoom: number;
    priority: number;
    distanceFromCenter: number;
    text: string;
  }[] = [];

  for (const label of LABEL_DEFINITIONS) {
    if (label.kind !== "country") continue;
    const text = displayTextForLabel(label, "monitor-home", engine.currentView.zoom);
    const minZoom = effectiveLabelMinZoom(label, "monitor-home");
    if (engine.currentView.zoom < minZoom) continue;

    const localPosition = latLngToVector3(label.coordinates[0], label.coordinates[1], LABEL_RADIUS);
    const worldNormal = localPosition.clone().applyQuaternion(engine.globeGroup.quaternion).normalize();
    const cameraDirection = engine.camera.position.clone().normalize();
    const faceDot = worldNormal.dot(cameraDirection);
    if (faceDot <= COUNTRY_LABEL_FACE_THRESHOLD.show) continue;

    const worldPosition = worldNormal.clone().multiplyScalar(LABEL_RADIUS);
    const screen = worldToScreen(engine, worldPosition);
    const distanceFromCenter = Math.hypot(screen.x - frame.centerX, screen.y - frame.centerY);
    if (screen.z > 1 || distanceFromCenter > frame.radius - COUNTRY_LABEL_EDGE_HYSTERESIS.show) continue;

    const metrics = countryLabelPixelMetrics(text, label.priority);
    const width = metrics.width;
    const height = metrics.height;
    const left = screen.x - width / 2;
    const top = screen.y - height / 2 - 1;
    const rect = {
      left: left - 5,
      top: top - 3,
      right: left + width + 5,
      bottom: top + height + 3,
    };

    if (!rectFitsViewport(rect, viewportWidth, viewportHeight) || !rectFitsGlobeFrame(rect, frame)) {
      continue;
    }

    candidates.push({
      key: label.key,
      rect,
      minZoom,
      priority: label.priority,
      distanceFromCenter,
      text,
    });
  }

  candidates.sort((a, b) => {
    if (a.minZoom !== b.minZoom) return a.minZoom - b.minZoom;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.distanceFromCenter !== b.distanceFromCenter) return a.distanceFromCenter - b.distanceFromCenter;
    return a.text.localeCompare(b.text);
  });

  const selected = new Set<string>();
  for (const candidate of candidates) {
    const overlaps = occupied.some((item) =>
      !(candidate.rect.right < item.left || candidate.rect.left > item.right || candidate.rect.bottom < item.top || candidate.rect.top > item.bottom)
    );
    if (overlaps) continue;
    selected.add(candidate.key);
    occupied.push(candidate.rect);
  }

  engine.countryLabelSelection = selected;
  engine.countryLabelSelectionAnchor = {
    mode: "monitor-home",
    zoomTier: monitorHomeCountryZoomTier(engine.currentView.zoom),
    centerLng: engine.currentView.centerLng,
    centerLat: engine.currentView.centerLat,
    bearing: engine.currentView.bearing,
  };
}

function stageOffsetForMode(mode: MapMode) {
  const padding = paddingForMode(mode);
  return Math.round((padding.left - padding.right) * STAGE_SHIFT_FACTOR);
}

function viewStateForMode(mode: MapMode): GlobeViewState {
  const camera = cameraForMode(mode);

  return {
    centerLng: camera.center[0],
    centerLat: camera.center[1],
    zoom: camera.zoom,
    bearing: camera.bearing,
    pitch: camera.pitch,
    stageOffset: stageOffsetForMode(mode),
  };
}

function viewStateMatches(a: GlobeViewState, b: GlobeViewState) {
  return (
    Math.abs(angleDelta(a.centerLng, b.centerLng)) <= CENTER_TOLERANCE.lng &&
    Math.abs(a.centerLat - b.centerLat) <= CENTER_TOLERANCE.lat &&
    Math.abs(a.zoom - b.zoom) <= CENTER_TOLERANCE.zoom &&
    Math.abs(angleDelta(a.bearing, b.bearing)) <= CENTER_TOLERANCE.bearing &&
    Math.abs(a.pitch - b.pitch) <= CENTER_TOLERANCE.pitch &&
    Math.abs(a.stageOffset - b.stageOffset) <= 1
  );
}

function normalizeLongitude(value: number) {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function cameraPositionFromView(view: GlobeViewState) {
  return latLngToVector3(view.centerLng, view.centerLat, distanceFromZoom(view.zoom));
}

function viewFromCamera(camera: THREE.PerspectiveCamera, stageOffset: number): GlobeViewState {
  const normalized = camera.position.clone().normalize();
  const centerLat = clamp(Math.asin(normalized.y) / DEG_TO_RAD, MIN_LATITUDE, MAX_LATITUDE);
  const centerLng = normalizeLongitude(Math.atan2(normalized.z, -normalized.x) / DEG_TO_RAD - 180);

  return {
    centerLng,
    centerLat,
    zoom: zoomFromDistance(camera.position.length()),
    bearing: 0,
    pitch: 0,
    stageOffset,
  };
}

function latLngToVector3(lng: number, lat: number, radius: number) {
  const phi = (90 - lat) * DEG_TO_RAD;
  const theta = (lng + 180) * DEG_TO_RAD;

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function projectLonLatToTexture(lng: number, lat: number, width: number, height: number) {
  return {
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

function traceRing(
  context: CanvasRenderingContext2D,
  ring: number[][],
  width: number,
  height: number,
  closePath: boolean,
) {
  let previousLng: number | null = null;

  ring.forEach((point, index) => {
    const [lng, lat] = point;
    const wrapped = previousLng !== null && Math.abs(lng - previousLng) > 180;
    const projected = projectLonLatToTexture(lng, lat, width, height);

    if (index === 0 || wrapped) {
      context.moveTo(projected.x, projected.y);
    } else {
      context.lineTo(projected.x, projected.y);
    }

    previousLng = lng;
  });

  if (closePath) {
    context.closePath();
  }
}

function drawGeoJsonPath(
  context: CanvasRenderingContext2D,
  geometry: unknown,
  width: number,
  height: number,
  closePath: boolean,
) {
  if (!geometry || typeof geometry !== "object") return;

  const geo = geometry as {
    type: string;
    coordinates?: unknown;
    geometry?: unknown;
    geometries?: unknown[];
    features?: { geometry?: unknown }[];
  };

  switch (geo.type) {
    case "FeatureCollection":
      geo.features?.forEach((featureGeometry) => {
        drawGeoJsonPath(context, featureGeometry.geometry, width, height, closePath);
      });
      break;
    case "Feature":
      drawGeoJsonPath(context, geo.geometry, width, height, closePath);
      break;
    case "Polygon":
      (geo.coordinates as number[][][]).forEach((ring) => {
        traceRing(context, ring, width, height, closePath);
      });
      break;
    case "MultiPolygon":
      (geo.coordinates as number[][][][]).forEach((polygon) => {
        polygon.forEach((ring) => {
          traceRing(context, ring, width, height, closePath);
        });
      });
      break;
    case "LineString":
      traceRing(context, geo.coordinates as number[][], width, height, false);
      break;
    case "MultiLineString":
      (geo.coordinates as number[][][]).forEach((ring) => {
        traceRing(context, ring, width, height, false);
      });
      break;
    case "GeometryCollection":
      geo.geometries?.forEach((item) => {
        drawGeoJsonPath(context, item, width, height, closePath);
      });
      break;
    default:
      break;
  }
}

function pushRingSegments(
  points: number[],
  ring: number[][],
  radius: number,
  closePath: boolean,
) {
  if (ring.length < 2) return;

  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (Math.abs(current[0] - previous[0]) > 180) continue;

    const a = latLngToVector3(previous[0], previous[1], radius);
    const b = latLngToVector3(current[0], current[1], radius);
    points.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }

  if (closePath) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first[0] - last[0]) <= 180) {
      const a = latLngToVector3(last[0], last[1], radius);
      const b = latLngToVector3(first[0], first[1], radius);
      points.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
}

function collectLineSegments(
  geometry: unknown,
  radius: number,
  closePath: boolean,
  points: number[],
) {
  if (!geometry || typeof geometry !== "object") return;

  const geo = geometry as {
    type: string;
    coordinates?: unknown;
    geometry?: unknown;
    geometries?: unknown[];
    features?: { geometry?: unknown }[];
  };

  switch (geo.type) {
    case "FeatureCollection":
      geo.features?.forEach((item) => collectLineSegments(item.geometry, radius, closePath, points));
      break;
    case "Feature":
      collectLineSegments(geo.geometry, radius, closePath, points);
      break;
    case "Polygon":
      (geo.coordinates as number[][][]).forEach((ring, ringIndex) => {
        pushRingSegments(points, ring, radius, closePath && ringIndex === 0);
      });
      break;
    case "MultiPolygon":
      (geo.coordinates as number[][][][]).forEach((polygon) => {
        polygon.forEach((ring, ringIndex) => {
          pushRingSegments(points, ring, radius, closePath && ringIndex === 0);
        });
      });
      break;
    case "LineString":
      pushRingSegments(points, geo.coordinates as number[][], radius, false);
      break;
    case "MultiLineString":
      (geo.coordinates as number[][][]).forEach((ring) => {
        pushRingSegments(points, ring, radius, false);
      });
      break;
    case "GeometryCollection":
      geo.geometries?.forEach((item) => collectLineSegments(item, radius, closePath, points));
      break;
    default:
      break;
  }
}

function createGeoLineSegments(
  geometry: unknown,
  radius: number,
  color: string,
  opacity: number,
  closePath: boolean,
  renderOrder: number,
) {
  const points: number[] = [];
  collectLineSegments(geometry, radius, closePath, points);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
  });

  const lines = new THREE.LineSegments(lineGeometry, material);
  lines.renderOrder = renderOrder;
  return lines;
}

function createLandTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 3072;
  canvas.height = 1536;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const width = canvas.width;
  const height = canvas.height;

  const waterGradient = context.createLinearGradient(0, 0, 0, height);
  waterGradient.addColorStop(0, MAP_WATER_TOP_COLOR);
  waterGradient.addColorStop(0.55, MAP_WATER_COLOR);
  waterGradient.addColorStop(1, MAP_WATER_BOTTOM_COLOR);
  context.fillStyle = waterGradient;
  context.fillRect(0, 0, width, height);

  const landFeature = feature(landTopology as never, (landTopology.objects as { land: unknown }).land as never);
  const bordersMesh = mesh(
    countriesTopology as never,
    (countriesTopology.objects as { countries: unknown }).countries as never,
    (a, b) => a !== b,
  );

  context.save();
  context.beginPath();
  drawGeoJsonPath(context, landFeature, width, height, true);
  context.fillStyle = MAP_LAND_COLOR;
  context.fill();

  context.globalCompositeOperation = "source-atop";
  const landGradient = context.createLinearGradient(0, height * 0.06, 0, height);
  landGradient.addColorStop(0, "rgba(255,255,255,0.08)");
  landGradient.addColorStop(0.36, MAP_LAND_HIGHLIGHT);
  landGradient.addColorStop(0.62, MAP_LAND_MIDTONE);
  landGradient.addColorStop(1, MAP_LAND_SHADE);
  context.fillStyle = landGradient;
  context.fillRect(0, 0, width, height);

  const landSheen = context.createRadialGradient(
    width * 0.5,
    height * 0.32,
    width * 0.08,
    width * 0.5,
    height * 0.42,
    width * 0.46,
  );
  landSheen.addColorStop(0, "rgba(255,255,255,0.042)");
  landSheen.addColorStop(0.5, "rgba(255,255,255,0.012)");
  landSheen.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = landSheen;
  context.fillRect(0, 0, width, height);

  const oceanLift = context.createRadialGradient(
    width * 0.5,
    height * 0.48,
    width * 0.06,
    width * 0.5,
    height * 0.5,
    width * 0.52,
  );
  oceanLift.addColorStop(0, "rgba(255,255,255,0.026)");
  oceanLift.addColorStop(0.55, "rgba(255,255,255,0.008)");
  oceanLift.addColorStop(1, "rgba(255,255,255,0)");
  context.globalCompositeOperation = "source-over";
  context.fillStyle = oceanLift;
  context.fillRect(0, 0, width, height);

  context.save();
  context.beginPath();
  drawGeoJsonPath(context, landFeature, width, height, true);
  context.clip();
  context.globalCompositeOperation = "source-atop";

  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = 1024;
  noiseCanvas.height = 512;
  const noiseContext = noiseCanvas.getContext("2d");
  if (noiseContext) {
    const image = noiseContext.createImageData(noiseCanvas.width, noiseCanvas.height);
    for (let y = 0; y < noiseCanvas.height; y += 1) {
      for (let x = 0; x < noiseCanvas.width; x += 1) {
        const i = (y * noiseCanvas.width + x) * 4;
        const nx = x / noiseCanvas.width;
        const ny = y / noiseCanvas.height;
        const waveA = Math.sin(nx * Math.PI * 2 * 3.0 + ny * Math.PI * 2 * 1.35);
        const waveB = Math.cos(nx * Math.PI * 2 * 6.0 - ny * Math.PI * 2 * 2.1);
        const waveC = Math.sin(nx * Math.PI * 2 * 11.0 + ny * Math.PI * 2 * 4.6);
        const mix = waveA * 0.45 + waveB * 0.35 + waveC * 0.2;
        const value = 128 + mix * 24;
        const alpha = 5 + (mix + 1) * 2.5;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = alpha;
      }
    }
    noiseContext.putImageData(image, 0, 0);
    context.globalAlpha = 0.075;
    context.drawImage(noiseCanvas, 0, 0, width, height);
    context.globalAlpha = 1;
  }
  context.restore();

  context.beginPath();
  drawGeoJsonPath(context, landFeature, width, height, true);
  context.strokeStyle = MAP_COASTLINE_COLOR;
  context.lineWidth = 1.2;
  context.stroke();

  context.beginPath();
  drawGeoJsonPath(context, bordersMesh, width, height, false);
  context.strokeStyle = MAP_BORDER_COLOR;
  context.lineWidth = 0.92;
  context.stroke();
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 12;

  return texture;
}

function countryLabelFontSize(priority: number) {
  return priority === 1 ? 34 : priority === 2 ? 28 : 24;
}

function countryLabelWeight(priority: number) {
  return priority === 1 ? 500 : 430;
}

function countryLabelPixelMetrics(text: string, priority: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return { width: text.length * 12, height: countryLabelFontSize(priority) };
  }
  const fontSize = countryLabelFontSize(priority);
  context.font = `${countryLabelWeight(priority)} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const width = context.measureText(text).width;
  return { width, height: fontSize };
}

function countryLabelWorldHeight(priority: number) {
  return priority === 1 ? 5.6 : priority === 2 ? 4.8 : 4.1;
}

function createCountryLabelSpriteTexture(text: string, priority: number) {
  const cacheKey = `${priority}:${text}`;
  const cached = countryLabelTextureCache.get(cacheKey);
  if (cached) return cached;

  const { width: textWidth, height: textHeight } = countryLabelPixelMetrics(text, priority);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(256, Math.ceil(textWidth + 56));
  canvas.height = Math.max(96, Math.ceil(textHeight + 38));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create country label sprite texture context.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.font = `${countryLabelWeight(priority)} ${countryLabelFontSize(priority)}px ui-sans-serif, system-ui, sans-serif`;
  context.strokeStyle = "rgba(0,0,0,0.82)";
  context.lineWidth = priority === 1 ? 5 : 4;
  context.fillStyle = priority === 1 ? "rgba(206,211,207,0.82)" : priority === 2 ? "rgba(196,201,198,0.74)" : "rgba(178,184,181,0.64)";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  countryLabelTextureCache.set(cacheKey, texture);
  return texture;
}

function createAtmosphereMaterial(opacity: number, scale: number, side: THREE.Side) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      glowColor: { value: MAP_ATMOSPHERE_COLOR },
      opacity: { value: opacity },
      intensity: { value: scale },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float opacity;
      uniform float intensity;

      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.8);
        float alpha = fresnel * opacity * intensity;
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
  });
}

function scheduleAutoRotateResume(engine: GlobeEngine, mode: MapMode) {
  if (mode !== "monitor-home") return;
  engine.autoRotateResumeAt = performance.now() + AUTO_ROTATE_IDLE_RESUME_MS;
}

function createEventMarkerTexture(palette: MarkerPalette, isPolitics: boolean) {
  const key = `${palette.fill}-${palette.border}-${isPolitics ? "politics" : "generic"}`;
  const cached = eventTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create event marker texture context.");
  }

  const cx = 64;
  const cy = 64;

  const glowGradient = ctx.createRadialGradient(cx, cy, 12, cx, cy, 48);
  glowGradient.addColorStop(0, palette.glow);
  glowGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.fill;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.stroke();

  if (isPolitics) {
    ctx.strokeStyle = "rgba(244, 246, 243, 0.92)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4.4, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 9.4, cy);
    ctx.lineTo(cx + 9.4, cy);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(244, 246, 243, 0.96)";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  eventTextureCache.set(key, texture);

  return texture;
}

function drawTelegramSocmintIcon(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.translate(32, 32);
  ctx.scale(1.14, 1.14);
  ctx.translate(-32, -32);
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(2,5,10,0.9)";
  ctx.lineWidth = 4.8;
  ctx.beginPath();
  ctx.moveTo(15.5, 31.5);
  ctx.lineTo(49.2, 16.8);
  ctx.lineTo(38.9, 48.2);
  ctx.lineTo(30.2, 37.8);
  ctx.lineTo(22.5, 43.5);
  ctx.lineTo(24.2, 34.8);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(15.5, 31.5);
  ctx.lineTo(49.2, 16.8);
  ctx.lineTo(38.9, 48.2);
  ctx.lineTo(30.2, 37.8);
  ctx.lineTo(22.5, 43.5);
  ctx.lineTo(24.2, 34.8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(8,12,18,0.66)";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(24.6, 34.7);
  ctx.lineTo(48.2, 17.5);
  ctx.lineTo(30.2, 37.8);
  ctx.stroke();

  ctx.restore();
}

function drawWebsiteSocmintIcon(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.translate(32, 32);
  ctx.scale(1.12, 1.12);
  ctx.translate(-32, -32);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(2,5,10,0.9)";
  ctx.lineWidth = 5.6;
  ctx.beginPath();
  ctx.arc(32, 32, 17, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16.9, 32);
  ctx.lineTo(47.1, 32);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(32, 32, 6.4, 17, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.arc(32, 32, 17, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16.9, 32);
  ctx.lineTo(47.1, 32);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(32, 32, 6.4, 17, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "700 9.4px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = "rgba(2,5,10,0.92)";
  ctx.strokeText("WWW", 32, 32.3);
  ctx.fillText("WWW", 32, 32.3);

  ctx.restore();
}

function drawXSocmintIcon(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.translate(32, 32);
  ctx.scale(1.16, 1.16);
  ctx.translate(-32, -32);
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 4;

  const drawRibbon = (points: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  };

  const risingRibbon: [number, number][] = [
    [39.9, 15.6],
    [48.4, 15.6],
    [24.2, 48.4],
    [15.7, 48.4],
  ];
  const fallingRibbon: [number, number][] = [
    [15.9, 15.6],
    [25.1, 15.6],
    [48.1, 48.4],
    [38.9, 48.4],
  ];

  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(2,5,10,0.92)";
  ctx.lineWidth = 5;
  drawRibbon(risingRibbon);
  drawRibbon(fallingRibbon);

  ctx.strokeStyle = "rgba(191,219,254,0.28)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(20.8, 18.3);
  ctx.lineTo(42.7, 45.7);
  ctx.moveTo(43.1, 18.5);
  ctx.lineTo(21.1, 45.5);
  ctx.stroke();

  ctx.restore();
}

function createSignalTexture(source: SocmintMarkerSource) {
  const cached = signalTextureCache.get(source);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create SOCMINT marker texture context.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (source === "telegram") {
    drawTelegramSocmintIcon(ctx, SOCMINT_MARKER_COLORS.telegram);
  } else if (source === "x") {
    drawXSocmintIcon(ctx, SOCMINT_MARKER_COLORS.x);
  } else {
    drawWebsiteSocmintIcon(ctx, SOCMINT_MARKER_COLORS.website);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  signalTextureCache.set(source, texture);

  return texture;
}

function markerPaletteFor(event: OsintEvent) {
  if (event.category === "politics" && event.markerVariant === "turkey-focus") {
    return TURKEY_POLITICS_MARKER_PALETTE;
  }

  return CATEGORY_MARKER_PALETTES[event.category] ?? DEFAULT_MARKER_PALETTE;
}

function resolveEventCoordinates(event: OsintEvent): [number, number] | null {
  const searchText = [event.location, event.title, event.summary].join(" ").toLowerCase();

  const capitalLocation = COUNTRY_CAPITAL_COORDINATES.find((location) =>
    location.match.some((needle) => searchText.includes(needle)),
  );

  if (capitalLocation) {
    return capitalLocation.coordinates;
  }

  const areaLocation = AREA_COORDINATES.find((location) =>
    location.match.some((needle) => searchText.includes(needle)),
  );

  if (areaLocation) {
    return areaLocation.coordinates;
  }

  if (event.coordinates) {
    return [event.coordinates.lng, event.coordinates.lat];
  }

  return null;
}

function socmintMarkerSourceFor(report: SocmintReport): SocmintMarkerSource {
  const sourceText = [
    report.platform,
    report.sourceName,
    report.type,
    report.title,
    report.summary,
  ].join(" ").toLowerCase();

  if (
    sourceText.includes("telegram") ||
    /\btg\b/.test(sourceText) ||
    (report.platform === "telegram" && sourceText.includes("channel"))
  ) {
    return "telegram";
  }

  if (sourceText.includes("twitter") || /\bx\b/.test(sourceText)) {
    return "x";
  }

  return "website";
}

function createGlobeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(MAP_OUTER_BACKGROUND_COLOR);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const texture = createLandTexture();
  const landFeature = feature(landTopology as never, (landTopology.objects as { land: unknown }).land as never);
  const bordersMesh = mesh(
    countriesTopology as never,
    (countriesTopology.objects as { countries: unknown }).countries as never,
    (a, b) => a !== b,
  );
  const globeMaterial = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: "#43484A",
    roughness: 0.84,
    metalness: 0.045,
    emissive: "#111416",
    emissiveIntensity: 0.24,
  });

  const globeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96),
    globeMaterial,
  );
  globeGroup.add(globeMesh);

  const countryLabelGroup = new THREE.Group();
  countryLabelGroup.renderOrder = 6;
  globeGroup.add(countryLabelGroup);

  const coastlineLines = createGeoLineSegments(
    landFeature,
    COASTLINE_LINE_RADIUS,
    COASTLINE_LINE_COLOR,
    0.2,
    true,
    4,
  );
  const borderLines = createGeoLineSegments(
    bordersMesh,
    BORDER_LINE_RADIUS,
    BORDER_LINE_COLOR,
    0.13,
    false,
    5,
  );
  globeGroup.add(coastlineLines, borderLines);

  const atmosphereInner = new THREE.Mesh(
    new THREE.SphereGeometry(ATMOSPHERE_INNER_RADIUS, 72, 72),
    createAtmosphereMaterial(0.044, 0.68, THREE.FrontSide),
  );
  scene.add(atmosphereInner);

  const ambient = new THREE.AmbientLight("#b2b8b1", 1.1);
  const hemi = new THREE.HemisphereLight("#d8ddd7", "#1c2123", 1.08);
  hemi.position.set(0, 180, 120);
  const keyLight = new THREE.DirectionalLight("#f2f4ef", 0.66);
  keyLight.position.set(175, 125, 240);
  const fillLight = new THREE.DirectionalLight("#8A9590", 0.46);
  fillLight.position.set(-145, -30, 150);

  scene.add(ambient, hemi, keyLight, fillLight);

  return { scene, globeGroup, countryLabelGroup };
}

function applyView(engine: GlobeEngine) {
  const { currentView, globeGroup, camera, controls } = engine;
  globeGroup.rotation.set(0, 0, 0);
  camera.position.copy(cameraPositionFromView(currentView));
  controls.target.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  controls.update();
}

function worldToScreen(engine: GlobeEngine, point: THREE.Vector3) {
  const projected = point.clone().project(engine.camera);
  const width = engine.renderer.domElement.clientWidth;
  const height = engine.renderer.domElement.clientHeight;

  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    z: projected.z,
  };
}

function getGlobeScreenFrame(engine: GlobeEngine) {
  const center = worldToScreen(engine, new THREE.Vector3(0, 0, 0));
  const edge = worldToScreen(engine, new THREE.Vector3(GLOBE_RADIUS, 0, 0));

  return {
    centerX: center.x,
    centerY: center.y,
    radius: Math.hypot(edge.x - center.x, edge.y - center.y),
  };
}

function rectFitsViewport(
  rect: { left: number; top: number; right: number; bottom: number },
  width: number,
  height: number,
) {
  return (
    rect.left >= LABEL_VIEWPORT_MARGIN &&
    rect.top >= LABEL_VIEWPORT_MARGIN &&
    rect.right <= width - LABEL_VIEWPORT_MARGIN &&
    rect.bottom <= height - LABEL_VIEWPORT_MARGIN
  );
}

function pointInsideGlobeFrame(
  x: number,
  y: number,
  frame: { centerX: number; centerY: number; radius: number },
  margin: number,
) {
  return Math.hypot(x - frame.centerX, y - frame.centerY) <= frame.radius - margin;
}

function rectFitsGlobeFrame(
  rect: { left: number; top: number; right: number; bottom: number },
  frame: { centerX: number; centerY: number; radius: number },
) {
  return (
    pointInsideGlobeFrame(rect.left, rect.top, frame, LABEL_EDGE_MARGIN) &&
    pointInsideGlobeFrame(rect.right, rect.top, frame, LABEL_EDGE_MARGIN) &&
    pointInsideGlobeFrame(rect.left, rect.bottom, frame, LABEL_EDGE_MARGIN) &&
    pointInsideGlobeFrame(rect.right, rect.bottom, frame, LABEL_EDGE_MARGIN)
  );
}

function densityBucketKey(rect: { left: number; top: number; right: number; bottom: number }) {
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  const bucketX = Math.floor(centerX / LABEL_DENSITY_BUCKET_WIDTH);
  const bucketY = Math.floor(centerY / LABEL_DENSITY_BUCKET_HEIGHT);
  return `${bucketX}:${bucketY}`;
}

function pointFacesCamera(
  camera: THREE.PerspectiveCamera,
  globeGroup: THREE.Group,
  localPosition: THREE.Vector3,
) {
  const worldPosition = localPosition.clone().applyQuaternion(globeGroup.quaternion).normalize();
  const cameraDirection = camera.position.clone().normalize();
  return worldPosition.dot(cameraDirection) > 0.06;
}

function freezeLabelVisibility(engine: GlobeEngine, duration = LABEL_INTERACTION_FREEZE_MS) {
  const until = performance.now() + duration;
  engine.labelVisibilityFrozenUntil = Math.max(engine.labelVisibilityFrozenUntil ?? 0, until);
}

function clearGroup(group: THREE.Group) {
  group.children.forEach((child) => {
    const sprite = child as THREE.Sprite;
    if (sprite.material instanceof THREE.SpriteMaterial) {
      sprite.material.dispose();
    }
  });
  group.clear();
}

function syncEventMarkers(
  engine: GlobeEngine,
  events: OsintEvent[],
  selectedId: string | null,
) {
  clearGroup(engine.eventGroup);
  engine.markerEntries = engine.markerEntries.filter((entry) => entry.kind !== "event");
  engine.raycastTargets = engine.raycastTargets.filter((target) => target.userData.kind !== "event");

  events.forEach((event) => {
    const coordinates = resolveEventCoordinates(event);
    if (!coordinates) return;

    const palette = markerPaletteFor(event);
    const texture = createEventMarkerTexture(palette, event.category === "politics");
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: event.id === selectedId ? 1 : 0.94,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(material);
    const localPosition = latLngToVector3(coordinates[0], coordinates[1], EVENT_MARKER_RADIUS);
    const size = event.id === selectedId ? 11.4 : 9.2;
    sprite.position.copy(localPosition);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = event.id === selectedId ? 12 : 10;
    sprite.userData = { id: event.id, kind: "event" as const };
    engine.eventGroup.add(sprite);
    engine.markerEntries.push({
      id: event.id,
      object: sprite,
      localPosition,
      kind: "event",
    });
    engine.raycastTargets.push(sprite);
  });
}

function syncSignalMarkers(
  engine: GlobeEngine,
  signals: SocmintReport[],
  selectedSignalId: string | null,
) {
  clearGroup(engine.signalGroup);
  engine.markerEntries = engine.markerEntries.filter((entry) => entry.kind !== "signal");
  engine.raycastTargets = engine.raycastTargets.filter((target) => target.userData.kind !== "signal");

  signals.forEach((signal) => {
    const source = socmintMarkerSourceFor(signal);
    const texture = createSignalTexture(source);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: signal.id === selectedSignalId ? 1 : 0.98,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(material);
    const localPosition = latLngToVector3(signal.coordinates[0], signal.coordinates[1], SIGNAL_MARKER_RADIUS);
    const size = signal.id === selectedSignalId ? 10.2 : 8.8;
    sprite.position.copy(localPosition);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = signal.id === selectedSignalId ? 16 : 14;
    sprite.userData = { id: signal.id, kind: "signal" as const };
    engine.signalGroup.add(sprite);
    engine.markerEntries.push({
      id: signal.id,
      object: sprite,
      localPosition,
      kind: "signal",
    });
    engine.raycastTargets.push(sprite);
  });
}

function updateMarkerVisibility(engine: GlobeEngine) {
  engine.markerEntries.forEach((entry) => {
    entry.object.visible = pointFacesCamera(engine.camera, engine.globeGroup, entry.localPosition);
  });
}

function clearCountryLabelSprites(engine: GlobeEngine) {
  engine.countryLabelEntries.forEach((entry) => {
    engine.countryLabelGroup.remove(entry.sprite);
    if (entry.sprite.material instanceof THREE.SpriteMaterial) {
      entry.sprite.material.dispose();
    }
  });
  engine.countryLabelEntries = [];
}

function syncMonitorHomeCountrySprites(engine: GlobeEngine) {
  clearCountryLabelSprites(engine);

  const selectedCountryLabels = LABEL_DEFINITIONS.filter(
    (label) => label.kind === "country" && engine.countryLabelSelection.has(label.key),
  );

  selectedCountryLabels.forEach((label) => {
    const text = displayTextForLabel(label, "monitor-home", engine.currentView.zoom);
    const texture = createCountryLabelSpriteTexture(text, label.priority);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 1,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(material);
    const metrics = countryLabelPixelMetrics(text, label.priority);
    const worldHeight = countryLabelWorldHeight(label.priority);
    const aspect = metrics.width / Math.max(metrics.height, 1);
    sprite.scale.set(worldHeight * aspect, worldHeight, 1);
    const localPosition = latLngToVector3(label.coordinates[0], label.coordinates[1], LABEL_RADIUS + 0.26);
    sprite.position.copy(localPosition);
    sprite.renderOrder = 7;
    engine.countryLabelGroup.add(sprite);
    engine.countryLabelEntries.push({
      key: label.key,
      sprite,
      localPosition,
      priority: label.priority,
      text,
    });
  });
}

function updateCountryLabelSprites(engine: GlobeEngine, mode: MapMode) {
  const visibleInMode = mode === "monitor-home";
  engine.countryLabelGroup.visible = visibleInMode;
  if (!visibleInMode) return;

  const freezeDuringInteraction = (engine.labelVisibilityFrozenUntil ?? 0) > engine.lastFrameTime;
  const frame = getGlobeScreenFrame(engine);
  engine.countryLabelEntries.forEach((entry) => {
    if (freezeDuringInteraction && entry.sprite.visible) {
      return;
    }

    const worldNormal = entry.localPosition.clone().applyQuaternion(engine.globeGroup.quaternion).normalize();
    const cameraDirection = engine.camera.position.clone().normalize();
    const faceDot = worldNormal.dot(cameraDirection);
    if (faceDot <= COUNTRY_LABEL_FACE_THRESHOLD.hide) {
      entry.sprite.visible = false;
      return;
    }

    const worldPosition = worldNormal.clone().multiplyScalar(LABEL_RADIUS + 0.26);
    const screen = worldToScreen(engine, worldPosition);
    const distanceFromCenter = Math.hypot(screen.x - frame.centerX, screen.y - frame.centerY);
    if (screen.z > 1 || distanceFromCenter > frame.radius - 2) {
      entry.sprite.visible = false;
      return;
    }

    const metrics = countryLabelPixelMetrics(entry.text, entry.priority);
    const rect = {
      left: screen.x - metrics.width / 2 - 6,
      top: screen.y - metrics.height / 2 - 4,
      right: screen.x + metrics.width / 2 + 6,
      bottom: screen.y + metrics.height / 2 + 4,
    };
    entry.sprite.visible = rectFitsViewport(rect, engine.renderer.domElement.clientWidth, engine.renderer.domElement.clientHeight)
      && rectFitsGlobeFrame(rect, frame);
  });
}

function updateLabelElements(
  engine: GlobeEngine,
  labelRefs: Record<string, HTMLSpanElement | null>,
  mode: MapMode,
) {
  const frame = getGlobeScreenFrame(engine);
  const viewportWidth = engine.renderer.domElement.clientWidth;
  const viewportHeight = engine.renderer.domElement.clientHeight;
  const occupied: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    kind: LabelKind;
    key: string;
  }[] = [];
  const now = engine.lastFrameTime;
  const bucketUsage = new Map<string, { country: number; capital: number; water: number }>();
  const freezeCountryVisibility = mode === "monitor-home" && (engine.labelVisibilityFrozenUntil ?? 0) > now;

  if (mode === "monitor-home" && !freezeCountryVisibility && shouldRecomputeMonitorHomeCountrySelection(engine)) {
    recomputeMonitorHomeCountrySelection(engine);
    syncMonitorHomeCountrySprites(engine);
  }
  if (mode !== "monitor-home") {
    if (engine.countryLabelSelection.size > 0) {
      engine.countryLabelSelection.clear();
      engine.countryLabelSelectionAnchor = null;
      clearCountryLabelSprites(engine);
    }
  }

  const sortedLabels = [...LABEL_DEFINITIONS].sort((a, b) => {
    const kindWeight = { country: 0, capital: 1, water: 2 };
    if (kindWeight[a.kind] !== kindWeight[b.kind]) {
      return kindWeight[a.kind] - kindWeight[b.kind];
    }
    if (a.kind === "country" && b.kind === "country") {
      const aMinZoom = effectiveLabelMinZoom(a, mode);
      const bMinZoom = effectiveLabelMinZoom(b, mode);
      if (aMinZoom !== bMinZoom) {
        return aMinZoom - bMinZoom;
      }
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.text.localeCompare(b.text);
    }
    const aWasVisible = engine.labelRuntime[a.key]?.visible ? 0 : 1;
    const bWasVisible = engine.labelRuntime[b.key]?.visible ? 0 : 1;
    if (aWasVisible !== bWasVisible) {
      return aWasVisible - bWasVisible;
    }
    const aRecent = now - (engine.labelRuntime[a.key]?.lastVisibleAt ?? 0) <= LABEL_RECENT_VISIBLE_MS ? 0 : 1;
    const bRecent = now - (engine.labelRuntime[b.key]?.lastVisibleAt ?? 0) <= LABEL_RECENT_VISIBLE_MS ? 0 : 1;
    if (aRecent !== bRecent) {
      return aRecent - bRecent;
    }
    const aTime = engine.labelRuntime[a.key]?.lastVisibleAt ?? 0;
    const bTime = engine.labelRuntime[b.key]?.lastVisibleAt ?? 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return a.priority - b.priority;
  });

  sortedLabels.forEach((label) => {
    const element = labelRefs[label.key];
    if (!element) return;
    const runtime = (engine.labelRuntime[label.key] ??= {
      visible: false,
      lastVisibleAt: 0,
      lastLeft: 0,
      lastTop: 0,
    });

    if (label.kind === "country") {
      runtime.visible = false;
      element.style.display = "none";
      return;
    }

    if (freezeCountryVisibility && label.kind === "country" && !runtime.visible) {
      element.style.display = "none";
      return;
    }
    const preserveCountryDuringInteraction = freezeCountryVisibility && label.kind === "country" && runtime.visible;

    const displayText = displayTextForLabel(label, mode, engine.currentView.zoom);
    if (element.textContent !== displayText) {
      element.textContent = displayText;
    }

    const minZoom = effectiveLabelMinZoom(label, mode);
    const zoomThreshold = LABEL_ZOOM_HYSTERESIS[label.kind];
    const zoomVisible = preserveCountryDuringInteraction
      ? true
      : runtime.visible
      ? engine.currentView.zoom >= minZoom - zoomThreshold.hide
      : engine.currentView.zoom >= minZoom + zoomThreshold.show;

    if (!zoomVisible) {
      runtime.visible = false;
      element.style.display = "none";
      return;
    }

    const localPosition = latLngToVector3(label.coordinates[0], label.coordinates[1], LABEL_RADIUS);
    const worldNormal = localPosition.clone().applyQuaternion(engine.globeGroup.quaternion).normalize();
    const cameraDirection = engine.camera.position.clone().normalize();
    const faceDot = worldNormal.dot(cameraDirection);
    const faceThreshold =
      label.kind === "country"
        ? runtime.visible
          ? COUNTRY_LABEL_FACE_THRESHOLD.hide
          : COUNTRY_LABEL_FACE_THRESHOLD.show
        : 0.06;
    if (!preserveCountryDuringInteraction && faceDot <= faceThreshold) {
      runtime.visible = false;
      element.style.display = "none";
      return;
    }

    const worldPosition = worldNormal.clone().multiplyScalar(LABEL_RADIUS);
    const screen = worldToScreen(engine, worldPosition);
    const distanceFromCenter = Math.hypot(screen.x - frame.centerX, screen.y - frame.centerY);
    const edgeMargin =
      label.kind === "country"
        ? runtime.visible
          ? COUNTRY_LABEL_EDGE_HYSTERESIS.hide
          : COUNTRY_LABEL_EDGE_HYSTERESIS.show
        : LABEL_EDGE_MARGIN;
    if (!preserveCountryDuringInteraction && (screen.z > 1 || distanceFromCenter > frame.radius - edgeMargin)) {
      runtime.visible = false;
      element.style.display = "none";
      return;
    }

    const width = element.offsetWidth || 0;
    const height = element.offsetHeight || 0;
    const offsetX = label.kind === "capital" ? 0 : 0;
    const offsetY = label.kind === "country" ? -1 : label.kind === "capital" ? 9 : 0;
    const rawLeft = screen.x - width / 2 + offsetX;
    const rawTop = screen.y - height / 2 + offsetY;
    const left =
      runtime.visible && Math.abs(rawLeft - runtime.lastLeft) < 10
        ? lerp(runtime.lastLeft, rawLeft, 0.45)
        : rawLeft;
    const top =
      runtime.visible && Math.abs(rawTop - runtime.lastTop) < 10
        ? lerp(runtime.lastTop, rawTop, 0.45)
        : rawTop;
    const rect = {
      left: left - (label.kind === "country" ? 5 : label.kind === "capital" ? 3 : 3),
      top: top - (label.kind === "country" ? 3 : label.kind === "capital" ? 2 : 2),
      right: left + width + (label.kind === "country" ? 5 : label.kind === "capital" ? 3 : 3),
      bottom: top + height + (label.kind === "country" ? 3 : label.kind === "capital" ? 2 : 2),
    };

    const fitsViewport = rectFitsViewport(rect, viewportWidth, viewportHeight);
    const fitsGlobeFrame = rectFitsGlobeFrame(rect, frame);
    if (!fitsViewport || (!preserveCountryDuringInteraction && !fitsGlobeFrame)) {
      runtime.visible = false;
      element.style.display = "none";
      return;
    }

    const bucketKey = densityBucketKey(rect);
    const bucketState = bucketUsage.get(bucketKey) ?? { country: 0, capital: 0, water: 0 };
    if (label.kind !== "country") {
      const overlaps = occupied.some((item) =>
        !(rect.right < item.left || rect.left > item.right || rect.bottom < item.top || rect.top > item.bottom)
      );

      const shouldHoldVisibility =
        runtime.visible && now - runtime.lastVisibleAt <= LABEL_VISIBILITY_STICK_MS && label.kind !== "water";

      if (overlaps && !shouldHoldVisibility) {
        runtime.visible = false;
        element.style.display = "none";
        return;
      }
    }

    occupied.push({ ...rect, kind: label.kind, key: label.key });
    bucketState[label.kind] += 1;
    bucketUsage.set(bucketKey, bucketState);
    runtime.visible = true;
    runtime.lastVisibleAt = now;
    runtime.lastLeft = left;
    runtime.lastTop = top;
    element.style.display = "block";
    element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    element.style.opacity = label.kind === "country" ? "0.96" : label.kind === "capital" ? "0.8" : "0.58";
  });
}

function updateHover(
  engine: GlobeEngine,
  container: HTMLElement,
  x: number,
  y: number,
) {
  const width = engine.renderer.domElement.clientWidth;
  const height = engine.renderer.domElement.clientHeight;

  const pointer = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.params.Sprite = { threshold: 0.16 };
  raycaster.setFromCamera(pointer, engine.camera);

  const intersections = raycaster
    .intersectObjects(engine.raycastTargets, false)
    .filter((item) => item.object.visible);

  const hit = intersections[0]?.object;
  const hitId = typeof hit?.userData.id === "string" ? hit.userData.id : null;

  engine.hoverId = hitId;
  container.style.cursor = hitId ? "pointer" : engine.isDragging ? "grabbing" : "grab";
}

function disposeEngine(engine: GlobeEngine) {
  if (engine.animationFrame !== null) {
    cancelAnimationFrame(engine.animationFrame);
  }

  engine.controls.dispose();

  engine.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });

  engine.renderer.dispose();
  engine.renderer.domElement.remove();
}

export const GlobeMap = forwardRef<GlobeMapHandle, Props>(function GlobeMap({
  mode,
  events,
  selectedId,
  onSelectEvent,
  signals = [],
  selectedSignalId = null,
  onSelectSignal,
}: Props, ref) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const modeRef = useRef(mode);
  const eventsRef = useRef(events);
  const signalsRef = useRef(signals);
  const selectedIdRef = useRef(selectedId);
  const selectedSignalIdRef = useRef(selectedSignalId);
  const onSelectEventRef = useRef(onSelectEvent);
  const onSelectSignalRef = useRef(onSelectSignal);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    eventsRef.current = events;
    selectedIdRef.current = selectedId;
    const engine = engineRef.current;
    if (!engine) return;
    syncEventMarkers(engine, events, selectedId);
  }, [events, selectedId]);

  useEffect(() => {
    signalsRef.current = signals;
    selectedSignalIdRef.current = selectedSignalId;
    const engine = engineRef.current;
    if (!engine) return;
    syncSignalMarkers(engine, signals, selectedSignalId);
  }, [signals, selectedSignalId]);

  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  useEffect(() => {
    onSelectSignalRef.current = onSelectSignal;
  }, [onSelectSignal]);

  useImperativeHandle(ref, () => ({
    centerView: () => {
      const engine = engineRef.current;
      if (!engine) return;

      const target = viewStateForMode(modeRef.current);
      engine.autoRotateSuppressed = false;
      engine.autoRotateResumeAt = null;
      if (viewStateMatches(engine.currentView, target)) return;
      setAnimatedView(engine, target, 620);
    },
    zoomIn: () => {
      const engine = engineRef.current;
      if (!engine) return;

      const next = clamp(engine.targetView.zoom + CONTROL_ZOOM_DELTA, 0.55, 7.2);
      setAnimatedView(engine, {
        ...engine.targetView,
        zoom: next,
      }, 280);
      engine.autoRotateSuppressed = true;
      scheduleAutoRotateResume(engine, modeRef.current);
    },
    zoomOut: () => {
      const engine = engineRef.current;
      if (!engine) return;

      const next = clamp(engine.targetView.zoom - CONTROL_ZOOM_DELTA, 0.55, 7.2);
      setAnimatedView(engine, {
        ...engine.targetView,
        zoom: next,
      }, 280);
      engine.autoRotateSuppressed = true;
      scheduleAutoRotateResume(engine, modeRef.current);
    },
  }), []);

  useEffect(() => {
    const host = canvasHostRef.current;
    const stage = stageRef.current;
    if (!host || !stage) return;

    const { scene, globeGroup, countryLabelGroup } = createGlobeScene();

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(MAP_OUTER_BACKGROUND_COLOR, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";
    host.appendChild(renderer.domElement);

    const eventGroup = new THREE.Group();
    const signalGroup = new THREE.Group();
    globeGroup.add(eventGroup);
    globeGroup.add(signalGroup);

    const initialView = viewStateForMode(modeRef.current);

    const engine: GlobeEngine = {
      renderer,
      scene,
      camera,
      globeGroup,
      countryLabelGroup,
      countryLabelEntries: [],
      eventGroup,
      signalGroup,
      markerEntries: [],
      raycastTargets: [],
      currentView: { ...initialView },
      targetView: { ...initialView },
      animation: null,
      animationFrame: null,
      lastFrameTime: performance.now(),
      isDragging: false,
      dragPointerId: null,
      dragStartX: 0,
      dragStartY: 0,
      dragStartView: { ...initialView },
      clickMoved: false,
      hoverId: null,
      autoRotateSuppressed: false,
      autoRotateResumeAt: null,
      didInitialRender: false,
      labelRuntime: {},
      labelVisibilityFrozenUntil: null,
      countryLabelSelection: new Set<string>(),
      countryLabelSelectionAnchor: null,
      controls: new OrbitControls(camera, renderer.domElement),
    };

    engine.controls.enableDamping = true;
    engine.controls.dampingFactor = 0.08;
    engine.controls.enablePan = false;
    engine.controls.minDistance = 105;
    engine.controls.maxDistance = 520;
    engine.controls.rotateSpeed = 0.5;
    engine.controls.zoomSpeed = 0.5;
    engine.controls.autoRotate = modeRef.current === "monitor-home";
    engine.controls.autoRotateSpeed = 0.3;
    engine.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    engine.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    engine.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    engine.controls.touches.ONE = THREE.TOUCH.ROTATE;
    engine.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    engineRef.current = engine;
    syncEventMarkers(engine, eventsRef.current, selectedIdRef.current);
    syncSignalMarkers(engine, signalsRef.current, selectedSignalIdRef.current);

    const handleResize = () => {
      if (!host) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    handleResize();
    applyView(engine);

    const animate = (timestamp: number) => {
      const live = engineRef.current;
      if (!live) return;

      live.lastFrameTime = timestamp;

      if (live.animation) {
        live.controls.enabled = false;
        const progress = clamp((timestamp - live.animation.start) / live.animation.duration, 0, 1);
        const eased = easeOutCubic(progress);
        live.currentView = {
          centerLng: lerpAngle(live.animation.from.centerLng, live.animation.to.centerLng, eased),
          centerLat: lerp(live.animation.from.centerLat, live.animation.to.centerLat, eased),
          zoom: lerp(live.animation.from.zoom, live.animation.to.zoom, eased),
          bearing: lerpAngle(live.animation.from.bearing, live.animation.to.bearing, eased),
          pitch: lerp(live.animation.from.pitch, live.animation.to.pitch, eased),
          stageOffset: lerp(live.animation.from.stageOffset, live.animation.to.stageOffset, eased),
        };

        if (progress >= 1) {
          live.currentView = { ...live.animation.to };
          live.animation = null;
        }
      } else {
        if (
          live.autoRotateSuppressed &&
          live.autoRotateResumeAt !== null &&
          timestamp >= live.autoRotateResumeAt &&
          !live.isDragging &&
          modeRef.current === "monitor-home"
        ) {
          live.autoRotateSuppressed = false;
          live.autoRotateResumeAt = null;
        }

        live.controls.enabled = true;
        live.controls.enableRotate = true;
        live.controls.enableZoom = true;
        live.controls.enablePan = false;
        live.controls.autoRotate = modeRef.current === "monitor-home" && !live.isDragging && !live.autoRotateSuppressed;
        const distance = live.camera.position.length();
        const speedRatio = clamp((distance - live.controls.minDistance) / (live.controls.maxDistance - live.controls.minDistance), 0, 1);
        live.controls.rotateSpeed = 0.05 + speedRatio * speedRatio * 0.65;
        live.controls.update();

        const synced = viewFromCamera(live.camera, live.targetView.stageOffset);
        live.currentView = synced;
        live.targetView = synced;
      }

      if (live.animation) {
        applyView(live);
      }
      updateCountryLabelSprites(live, modeRef.current);
      updateMarkerVisibility(live);
      updateLabelElements(live, labelRefs.current, modeRef.current);
      stage.style.transform = `translate3d(${live.currentView.stageOffset}px, 0, 0)`;
      renderer.render(scene, camera);

      if (!live.didInitialRender) {
        live.didInitialRender = true;
        setReady(true);
      }

      live.animationFrame = requestAnimationFrame(animate);
    };

    const onPointerDown = (event: PointerEvent) => {
      const live = engineRef.current;
      if (!live || event.button !== 0) return;

      live.isDragging = true;
      live.dragPointerId = event.pointerId;
      live.dragStartX = event.clientX;
      live.dragStartY = event.clientY;
      live.clickMoved = false;
      live.animation = null;
      live.autoRotateSuppressed = true;
      live.autoRotateResumeAt = null;
      freezeLabelVisibility(live, 420);
      renderer.domElement.style.cursor = "grabbing";
    };

    const onPointerMove = (event: PointerEvent) => {
      const live = engineRef.current;
      if (!live) return;

      if (live.isDragging && event.pointerId === live.dragPointerId) {
        if ((event.buttons & 1) !== 1) {
          onPointerCancel(event);
          return;
        }

        const deltaX = event.clientX - live.dragStartX;
        const deltaY = event.clientY - live.dragStartY;
        const distance = deltaX * deltaX + deltaY * deltaY;
        if (distance > 16) {
          live.clickMoved = true;
        }
        freezeLabelVisibility(live, 420);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      updateHover(live, renderer.domElement, event.clientX - rect.left, event.clientY - rect.top);
    };

    const onClick = (event: MouseEvent) => {
      const live = engineRef.current;
      if (!live || event.button !== 0 || live.isDragging || live.clickMoved) return;

      const rect = renderer.domElement.getBoundingClientRect();
      updateHover(live, renderer.domElement, event.clientX - rect.left, event.clientY - rect.top);
      const hit = live.raycastTargets.find((target) => target.userData.id === live.hoverId && target.visible);
      if (!hit) return;

      if (hit.userData.kind === "event") {
        onSelectEventRef.current?.(hit.userData.id);
      } else if (hit.userData.kind === "signal") {
        onSelectSignalRef.current?.(hit.userData.id);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const live = engineRef.current;
      if (!live || event.pointerId !== live.dragPointerId) return;
      live.isDragging = false;
      live.dragPointerId = null;
      scheduleAutoRotateResume(live, modeRef.current);
      renderer.domElement.style.cursor = live.hoverId ? "pointer" : "grab";
    };

    const onPointerCancel = (event: PointerEvent) => {
      const live = engineRef.current;
      if (!live || event.pointerId !== live.dragPointerId) return;
      live.isDragging = false;
      live.dragPointerId = null;
      scheduleAutoRotateResume(live, modeRef.current);
      renderer.domElement.style.cursor = live.hoverId ? "pointer" : "grab";
    };

    const onWheel = () => {
      const live = engineRef.current;
      if (!live) return;
      live.autoRotateSuppressed = true;
      scheduleAutoRotateResume(live, modeRef.current);
      freezeLabelVisibility(live);
    };

    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerCancel);
    host.addEventListener("click", onClick);
    host.addEventListener("wheel", onWheel, { passive: true });
    host.addEventListener("contextmenu", onContextMenu);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(host);

    engine.animationFrame = requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
      host.removeEventListener("click", onClick);
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("contextmenu", onContextMenu);
      disposeEngine(engine);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const next = viewStateForMode(mode);
    if (viewStateMatches(engine.currentView, next)) {
      engine.currentView.stageOffset = next.stageOffset;
      engine.targetView = next;
      engine.animation = null;
      engine.autoRotateResumeAt = null;
      engine.autoRotateSuppressed = mode !== "monitor-home";
      return;
    }

    setAnimatedView(engine, next, 520);
    engine.autoRotateSuppressed = mode !== "monitor-home";
    engine.autoRotateResumeAt = null;
  }, [mode]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: MAP_OUTER_BACKGROUND_COLOR }}
    >
      <div
        ref={stageRef}
        className="absolute inset-0"
        style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 120ms ease",
          willChange: "transform",
        }}
      >
        <div ref={canvasHostRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          {LABEL_DEFINITIONS.map((label) => (
            <span
              key={label.key}
              ref={(element) => {
                labelRefs.current[label.key] = element;
              }}
              className="absolute left-0 top-0 whitespace-nowrap"
              style={{
                display: "none",
                transform: "translate3d(-9999px, -9999px, 0)",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize:
                  label.kind === "country" ? "11px" : label.kind === "capital" ? "9.5px" : "10.5px",
                fontWeight: label.kind === "country" ? 440 : 400,
                color:
                  label.kind === "country"
                    ? COUNTRY_LABEL_COLOR
                    : label.kind === "capital"
                      ? CAPITAL_LABEL_COLOR
                      : WATER_LABEL_COLOR,
                fontStyle: label.kind === "water" ? "italic" : "normal",
                letterSpacing: "0",
                textShadow:
                  label.kind === "country"
                    ? `0 0 4px ${COUNTRY_LABEL_HALO}, 0 0 10px ${COUNTRY_LABEL_HALO}`
                    : "0 0 6px rgba(0,0,0,0.9)",
                userSelect: "none",
                textTransform: "none",
              }}
            >
              {label.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
