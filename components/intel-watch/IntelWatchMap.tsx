"use client";

import {
  Anchor,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  Factory,
  FolderOpen,
  Globe2,
  Info,
  Layers,
  MapPin,
  Minus,
  MousePointer2,
  Pentagon,
  Plane,
  Plus,
  Radiation,
  Route,
  Satellite,
  Search,
  Shield,
  Target,
  Trash2,
  Undo2,
  Upload,
  Warehouse,
  Waves,
} from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ECHIS_VIEW,
  addGraticule,
  buildEchisCommandStyle,
} from "./echisCommandBasemap";
import IntelMapLoader from "./IntelMapLoader";
import { INTEL_WATCH_STORAGE_KEY } from "./workspaceStore";

const PANEL_WIDTH = 318;

type Tool = "select" | "pin" | "line" | "area";
type Severity = "critical" | "high" | "medium" | "low";
type PinType = "naval" | "airdef" | "logistics" | "sigint" | "facility";
type LngLat = [number, number];

type Pin = {
  id: string;
  lng: number;
  lat: number;
  type: PinType;
  severity: Severity;
  title: string;
  source: string;
  updated: string;
  note: string;
};

type Annotation = {
  id: string;
  kind: "line" | "area";
  color: string;
  coordinates: LngLat[];
  /** Optional analyst label rendered next to the measurement on the map. */
  name?: string;
};

/** Pins + drawings snapshot — the unit of undo history and localStorage. */
type WorkspaceSnapshot = { pins: Pin[]; annotations: Annotation[] };

// Persisted analyst workspace key lives in workspaceStore.ts so other screens
// ("Send to Intel Watch") can write pins without importing this module.
const STORAGE_KEY = INTEL_WATCH_STORAGE_KEY;
const HISTORY_LIMIT = 50;

type Selection =
  | { type: "pin"; id: string }
  | { type: "annotation"; id: string }
  | null;

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  critical: { label: "URGENT", color: "#ff2b3d" },
  high: { label: "HIGH", color: "#ff9533" },
  medium: { label: "MEDIUM", color: "#ffd23d" },
  low: { label: "LOW", color: "#4fd1c5" },
};
const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const TYPE_META: Record<PinType, { label: string; Icon: LucideIcon }> = {
  naval: { label: "Naval", Icon: Waves },
  airdef: { label: "Air Def.", Icon: Shield },
  logistics: { label: "Logistics", Icon: Warehouse },
  sigint: { label: "SIGINT", Icon: Satellite },
  facility: { label: "Facility", Icon: Factory },
};
const PIN_TYPE_ORDER: PinType[] = [
  "naval",
  "airdef",
  "logistics",
  "sigint",
  "facility",
];

/** Curated draw palette — theme-consistent hues shared by line & area tools. */
const DRAW_PALETTE = [
  "#ff2b3d",
  "#e0a82e",
  "#4fd1c5",
  "#4aa8ff",
  "#b06bff",
  "#9cff6a",
  "#ff7ad9",
  "#c4ccd6",
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ----------------------------------------------------------------------- */
/* Workspace sanitizers — shared by localStorage restore and GeoJSON import */
/* so malformed input can never poison the map state.                       */
/* ----------------------------------------------------------------------- */
function sanitizePin(value: unknown): Pin | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const lng = Number(v.lng);
  const lat = Number(v.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    id: typeof v.id === "string" && v.id ? v.id : makeId("pin"),
    lng: Math.max(-180, Math.min(180, lng)),
    lat: Math.max(-85, Math.min(85, lat)),
    type: (PIN_TYPE_ORDER as string[]).includes(v.type as string)
      ? (v.type as PinType)
      : "facility",
    severity: (SEVERITY_ORDER as string[]).includes(v.severity as string)
      ? (v.severity as Severity)
      : "medium",
    title: typeof v.title === "string" && v.title ? v.title : "Untitled marker",
    source: typeof v.source === "string" && v.source ? v.source : "Analyst input",
    updated: typeof v.updated === "string" && v.updated ? v.updated : "—",
    note: typeof v.note === "string" ? v.note : "",
  };
}

/** Read + sanitize the persisted workspace (SSR-safe, corrupt-store-safe). */
function readStoredWorkspace(): WorkspaceSnapshot {
  const empty: WorkspaceSnapshot = { pins: [], annotations: [] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    return {
      pins: Array.isArray(parsed.pins)
        ? parsed.pins.map(sanitizePin).filter((pin): pin is Pin => pin !== null)
        : [],
      annotations: Array.isArray(parsed.annotations)
        ? parsed.annotations
            .map(sanitizeAnnotation)
            .filter((annotation): annotation is Annotation => annotation !== null)
        : [],
    };
  } catch {
    return empty;
  }
}

function sanitizeAnnotation(value: unknown): Annotation | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const kind = v.kind === "area" ? "area" : v.kind === "line" ? "line" : null;
  if (!kind) return null;
  const coordinates = Array.isArray(v.coordinates)
    ? v.coordinates
        .map((c) =>
          Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))
            ? ([Number(c[0]), Number(c[1])] as LngLat)
            : null,
        )
        .filter((c): c is LngLat => c !== null)
    : [];
  if (coordinates.length < (kind === "line" ? 2 : 3)) return null;
  return {
    id: typeof v.id === "string" && v.id ? v.id : makeId("annotation"),
    kind,
    color: typeof v.color === "string" && v.color ? v.color : DRAW_PALETTE[3],
    coordinates,
    name: typeof v.name === "string" && v.name ? v.name : undefined,
  };
}

function formatCoordinate(lat: number, lng: number) {
  const latHemisphere = lat >= 0 ? "N" : "S";
  const lngHemisphere = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${latHemisphere}   ${Math.abs(lng).toFixed(
    3,
  )}°${lngHemisphere}`;
}

function toolCursor(tool: Tool) {
  return tool === "select" ? "grab" : "crosshair";
}

/* ----------------------------------------------------------------------- */
/* Draw measurements — great-circle length (km) and spherical area (km²).   */
/* ----------------------------------------------------------------------- */
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineKm(a: LngLat, b: LngLat) {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

function lineLengthKm(coordinates: LngLat[]) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    total += haversineKm(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

function polygonAreaKm2(coordinates: LngLat[]) {
  if (coordinates.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[(i + 1) % coordinates.length];
    total +=
      toRadians(lng2 - lng1) *
      (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

function formatKm(value: number, unit: string) {
  const text =
    value >= 100
      ? Math.round(value).toLocaleString("en-US")
      : value.toFixed(1);
  return `${text} ${unit}`;
}

function annotationMeasurement(annotation: Pick<Annotation, "kind" | "coordinates">) {
  return annotation.kind === "area"
    ? formatKm(polygonAreaKm2(annotation.coordinates), "sq km")
    : formatKm(lineLengthKm(annotation.coordinates), "km");
}

function annotationAnchor(coordinates: LngLat[]): LngLat {
  const lng = coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
  const lat = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  return [lng, lat];
}

/* ----------------------------------------------------------------------- */
/* Airbases overlay (public/data/airbases.geojson) — popup helpers.         */
/* ----------------------------------------------------------------------- */
const AIRBASES_SOURCE = "airbases";
const AIRBASES_LAYER = "airbases-dot";
const AIRBASES_DATA_URL = "/data/airbases.geojson";
const CHOKEPOINTS_SOURCE = "chokepoints";
const CHOKEPOINTS_LAYER = "chokepoints-dot";
const CHOKEPOINTS_DATA_URL = "/data/chokepoints.geojson";
const PORTS_SOURCE = "ports";
const PORTS_LAYER = "ports-dot";
const PORTS_DATA_URL = "/data/ports.geojson";
const NUCLEAR_FACILITIES_SOURCE = "nuclear-facilities";
const NUCLEAR_FACILITIES_LAYER = "nuclear-facilities-dot";
const NUCLEAR_FACILITIES_DATA_URL = "/data/nuclear-facilities.geojson";
/* Analyst pins rendered as a severity-coloured circle layer. */
const PINS_SOURCE = "iw-pins";
const PINS_LAYER = "iw-pins-dot";
const ANNOTATION_HIT_LAYERS = ["iw-annotations-fill", "iw-annotations-line"];

/**
 * Toggleable map data overlays shown in the left "DATA LAYERS" panel.
 * Add a new entry here (id + label + dot colour + its MapLibre layer id) to
 * expose another dataset toggle — the panel renders from this list.
 */
type MapOverlay = {
  id: string;
  label: string;
  color: string;
  layerId: string;
  Icon: LucideIcon;
  /** Initial toggle state; defaults to visible when omitted. */
  defaultVisible?: boolean;
};
const MAP_OVERLAYS: MapOverlay[] = [
  { id: "airbases", label: "Airbases", color: "#e0a82e", layerId: AIRBASES_LAYER, Icon: Plane },
  { id: "chokepoints", label: "Chokepoints", color: "#4fd1c5", layerId: CHOKEPOINTS_LAYER, Icon: Waves },
  { id: "ports", label: "Ports", color: "#4aa8ff", layerId: PORTS_LAYER, Icon: Anchor },
  {
    id: "nuclear-facilities",
    label: "Nuclear Facilities",
    color: "#9cff6a",
    layerId: NUCLEAR_FACILITIES_LAYER,
    Icon: Radiation,
  },
];

/* ----------------------------------------------------------------------- */
/* Panel search — searches analyst pins/drawings plus the overlay datasets. */
/* The overlay name index is fetched lazily on first search interaction     */
/* (same /public URLs the map streams, so the browser cache is shared).     */
/* ----------------------------------------------------------------------- */
type SearchHit = {
  id: string;
  kind: "pin" | "annotation" | "overlay";
  /** Which MAP_OVERLAYS toggle the hit belongs to (overlay hits only). */
  overlayId?: string;
  label: string;
  sub: string;
  color: string;
  lng: number;
  lat: number;
};

const SEARCH_DATASETS: { url: string; overlayId: string; sub: string; color: string }[] = [
  { url: AIRBASES_DATA_URL, overlayId: "airbases", sub: "Airbase", color: "#e0a82e" },
  { url: CHOKEPOINTS_DATA_URL, overlayId: "chokepoints", sub: "Chokepoint", color: "#4fd1c5" },
  { url: PORTS_DATA_URL, overlayId: "ports", sub: "Port", color: "#4aa8ff" },
  {
    url: NUCLEAR_FACILITIES_DATA_URL,
    overlayId: "nuclear-facilities",
    sub: "Nuclear facility",
    color: "#9cff6a",
  },
];
const SEARCH_RESULT_LIMIT = 12;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function airbaseRow(label: string, value: unknown) {
  if (!value) return "";
  return `<div class="iw-ab-row"><span>${label}</span><b>${escapeHtml(value)}</b></div>`;
}

function buildAirbasePopup(p: Record<string, unknown>) {
  const codes = [p.icao, p.iata].filter(Boolean).map(escapeHtml).join(" · ");
  const country = p.operating_country || p.location || "";
  const sub = [country, p.status].filter(Boolean).map(escapeHtml).join(" · ");
  return (
    `<div class="iw-ab">` +
    `<div class="iw-ab-title">${escapeHtml(p.name || "Air Base")}</div>` +
    (sub ? `<div class="iw-ab-sub">${sub}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Use", p.usage) +
    airbaseRow("Operator", p.operating_organization) +
    (codes ? `<div class="iw-ab-row"><span>Code</span><b>${codes}</b></div>` : "") +
    airbaseRow("Year", p.year_built) +
    airbaseRow("Elevation", p.elevation) +
    airbaseRow("Runway", p.runways) +
    `</div>` +
    (p.url
      ? `<a class="iw-ab-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Source -></a>`
      : "") +
    `</div>`
  );
}

function buildChokepointPopup(p: Record<string, unknown>) {
  return (
    `<div class="iw-ab">` +
    `<div class="iw-ab-title">${escapeHtml(p.name || "Chokepoint")}</div>` +
    (p.region ? `<div class="iw-ab-sub">${escapeHtml(p.region)}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Type", "Maritime chokepoint") +
    airbaseRow("Region", p.region) +
    `</div>` +
    `</div>`
  );
}

function buildPortPopup(p: Record<string, unknown>) {
  const coords =
    p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : "";
  return (
    `<div class="iw-ab">` +
    `<div class="iw-ab-title">${escapeHtml(p.name || "Port")}</div>` +
    (p.country ? `<div class="iw-ab-sub">${escapeHtml(p.country)}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Harbor size", p.harbor_size) +
    airbaseRow("Harbor type", p.harbor_type) +
    airbaseRow("Shelter", p.shelter) +
    airbaseRow("Port of entry", p.port_of_entry) +
    airbaseRow("Coordinates", coords) +
    `</div>` +
    `</div>`
  );
}

function buildNuclearFacilityPopup(p: Record<string, unknown>) {
  const coords =
    p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : "";
  const sub = [p.country, p.location].filter(Boolean).map(escapeHtml).join(" · ");
  return (
    `<div class="iw-ab">` +
    `<div class="iw-ab-title">${escapeHtml(p.name || "Nuclear Facility")}</div>` +
    (sub ? `<div class="iw-ab-sub">${sub}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Class", p.group_label) +
    airbaseRow("Category", p.category) +
    airbaseRow("Function", p.function) +
    airbaseRow("Coordinates", coords) +
    `</div>` +
    `</div>`
  );
}

function SearchHitRow({
  hit,
  onSelect,
}: {
  hit: SearchHit;
  onSelect: (hit: SearchHit) => void;
}) {
  return (
    <button
      className="iw-search-hit"
      type="button"
      onClick={() => onSelect(hit)}
    >
      <span className="iw-search-hit-dot" style={{ background: hit.color }} />
      <span className="iw-search-hit-copy">
        <span className="iw-search-hit-label">{hit.label}</span>
        <span className="iw-search-hit-sub">{hit.sub}</span>
      </span>
    </button>
  );
}

function ToolButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="iw-tool-item">
      <button
        aria-label={label}
        aria-pressed={active}
        className="iw-tool-button"
        disabled={disabled}
        title={label}
        type="button"
        onClick={onClick}
      >
        <Icon size={17} strokeWidth={1.8} />
      </button>
      <span>{label}</span>
    </div>
  );
}

export function IntelWatchMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const toolRef = useRef<Tool>("select");
  const [mapReady, setMapReady] = useState(false);
  // Loader overlay: closes when the map's first full render lands (`idle`).
  const [mapFullyLoaded, setMapFullyLoaded] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  // Workspace state is restored from localStorage so analyst work survives
  // tab switches and reloads.
  const [pins, setPins] = useState<Pin[]>(() => readStoredWorkspace().pins);
  const [annotations, setAnnotations] = useState<Annotation[]>(
    () => readStoredWorkspace().annotations,
  );
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [drawColor, setDrawColor] = useState(DRAW_PALETTE[3]);
  const annotationMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [overlayVisibility, setOverlayVisibility] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        MAP_OVERLAYS.map((overlay) => [overlay.id, overlay.defaultVisible ?? true]),
      ),
  );
  const [cursorCoordinate, setCursorCoordinate] = useState<LngLat>(ECHIS_VIEW.center);
  // Right-panel tab (shown while nothing is selected on the map).
  const [panelTab, setPanelTab] = useState<"layers" | "workspace">("layers");
  // Undo history — snapshots pushed right before every structural change.
  const [history, setHistory] = useState<WorkspaceSnapshot[]>([]);
  // Two-step "Clear" confirmation (auto-resets after a short window).
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmClearTimer = useRef<number | null>(null);
  // Transient status line for GeoJSON import/export feedback.
  const [transferNote, setTransferNote] = useState<string | null>(null);
  const transferNoteTimer = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Overlay name index for the panel search; null until first fetch resolves.
  const [overlayIndex, setOverlayIndex] = useState<SearchHit[] | null>(null);
  const overlayIndexRequested = useRef(false);

  // Committed workspace mirror so stable callbacks can snapshot pre-mutation
  // state without re-binding on every pins/annotations change.
  const workspaceRef = useRef<WorkspaceSnapshot>({ pins: [], annotations: [] });
  useEffect(() => {
    workspaceRef.current = { pins, annotations };
  }, [pins, annotations]);

  const pushHistory = useCallback((snapshot?: WorkspaceSnapshot) => {
    const entry = snapshot ?? workspaceRef.current;
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), entry]);
  }, []);

  // Keep localStorage in sync with the analyst workspace.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pins, annotations }));
    } catch {
      // Storage full/unavailable — the in-memory workspace keeps working.
    }
  }, [pins, annotations]);

  useEffect(
    () => () => {
      if (confirmClearTimer.current) window.clearTimeout(confirmClearTimer.current);
      if (transferNoteTimer.current) window.clearTimeout(transferNoteTimer.current);
    },
    [],
  );

  const selectedPin = useMemo(
    () =>
      selection?.type === "pin"
        ? pins.find((pin) => pin.id === selection.id) ?? null
        : null,
    [pins, selection],
  );
  const selectedAnnotation = useMemo(
    () =>
      selection?.type === "annotation"
        ? annotations.find((annotation) => annotation.id === selection.id) ?? null
        : null,
    [annotations, selection],
  );
  const hasSelection = Boolean(selectedPin || selectedAnnotation);

  // Live measurement readout while a line/area draft is in progress.
  const draftMeasurement = useMemo(() => {
    if (draft.length < 2) return "";
    if (tool === "area" && draft.length >= 3) {
      return formatKm(polygonAreaKm2(draft), "km²");
    }
    return formatKm(lineLengthKm(draft), "km");
  }, [draft, tool]);

  // Lazily build the overlay search index on first search interaction.
  const ensureOverlayIndex = useCallback(() => {
    if (overlayIndexRequested.current) return;
    overlayIndexRequested.current = true;
    Promise.all(
      SEARCH_DATASETS.map(async (dataset) => {
        try {
          const response = await fetch(dataset.url);
          if (!response.ok) return [] as SearchHit[];
          const json = (await response.json()) as {
            features?: {
              geometry?: { type?: string; coordinates?: number[] };
              properties?: Record<string, unknown>;
            }[];
          };
          const features = Array.isArray(json?.features) ? json.features : [];
          return features.flatMap((feature, index) => {
            const name = feature?.properties?.name;
            const coordinates = feature?.geometry?.coordinates;
            if (
              feature?.geometry?.type !== "Point" ||
              typeof name !== "string" ||
              !name ||
              !Array.isArray(coordinates) ||
              !Number.isFinite(coordinates[0]) ||
              !Number.isFinite(coordinates[1])
            ) {
              return [] as SearchHit[];
            }
            return [
              {
                id: `${dataset.overlayId}-${index}`,
                kind: "overlay" as const,
                overlayId: dataset.overlayId,
                label: name,
                sub: dataset.sub,
                color: dataset.color,
                lng: coordinates[0],
                lat: coordinates[1],
              },
            ];
          });
        } catch {
          return [] as SearchHit[];
        }
      }),
    ).then((groups) => setOverlayIndex(groups.flat()));
  }, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("en-US");
    if (query.length < 2) return [] as SearchHit[];
    const matches = (value: string) => value.toLocaleLowerCase("en-US").includes(query);
    const hits: SearchHit[] = [];
    for (const pin of pins) {
      if (!matches(pin.title) && !matches(pin.note)) continue;
      hits.push({
        id: pin.id,
        kind: "pin",
        label: pin.title,
        sub: `${TYPE_META[pin.type].label} marker`,
        color: SEVERITY_META[pin.severity].color,
        lng: pin.lng,
        lat: pin.lat,
      });
    }
    for (const annotation of annotations) {
      if (!annotation.name || !matches(annotation.name)) continue;
      const [lng, lat] = annotationAnchor(annotation.coordinates);
      hits.push({
        id: annotation.id,
        kind: "annotation",
        label: annotation.name,
        sub: annotation.kind === "area" ? "Area drawing" : "Line drawing",
        color: annotation.color,
        lng,
        lat,
      });
    }
    for (const hit of overlayIndex ?? []) {
      if (hits.length >= SEARCH_RESULT_LIMIT) break;
      if (matches(hit.label)) hits.push(hit);
    }
    return hits.slice(0, SEARCH_RESULT_LIMIT);
  }, [annotations, overlayIndex, pins, searchQuery]);

  // Create the MapLibre command basemap once and own the camera/render state.
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: buildEchisCommandStyle(),
      center: ECHIS_VIEW.center,
      zoom: ECHIS_VIEW.zoom,
      minZoom: ECHIS_VIEW.minZoom,
      maxZoom: ECHIS_VIEW.maxZoom,
      maxBounds: ECHIS_VIEW.maxBounds,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on("load", () => {
      addGraticule(map);
      setMapReady(true);
    });
    // First full render (all visible tiles painted) → dismiss the loader.
    map.once("idle", () => setMapFullyLoaded(true));
    map.on("mousemove", (event) =>
      setCursorCoordinate([event.lngLat.lng, event.lngLat.lat]),
    );

    // Watchdog: never let the loader hang if tiles stall / never settle.
    const loaderWatchdog = window.setTimeout(() => setMapFullyLoaded(true), 12000);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      window.clearTimeout(loaderWatchdog);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft([]);
    setTool("select");
  }, []);

  const finishDraft = useCallback(() => {
    if (tool !== "line" && tool !== "area") return;
    const minPoints = tool === "line" ? 2 : 3;
    if (draft.length < minPoints) return;

    const nextAnnotation: Annotation = {
      id: makeId("annotation"),
      kind: tool,
      color: drawColor,
      coordinates: draft,
    };
    pushHistory();
    setAnnotations((current) => [...current, nextAnnotation]);
    setDraft([]);
    setTool("select");
    // Open the annotation in the detail panel so it can be named right away.
    setSelection({ type: "annotation", id: nextAnnotation.id });
  }, [draft, drawColor, pushHistory, tool]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (event.key === "Escape" && (tool === "line" || tool === "area")) {
        event.preventDefault();
        cancelDraft();
      }

      if (event.key === "Escape" && tool === "pin") {
        event.preventDefault();
        setTool("select");
      }

      if (event.key === "Enter" && (tool === "line" || tool === "area")) {
        event.preventDefault();
        finishDraft();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelDraft, finishDraft, tool]);

  function setActiveTool(nextTool: Tool) {
    if (nextTool === tool && (nextTool === "pin" || nextTool === "line" || nextTool === "area")) {
      setTool("select");
      setDraft([]);
      return;
    }

    setTool(nextTool);
    if (nextTool !== "line" && nextTool !== "area") setDraft([]);
  }

  // Place a point for the active drawing tool at a clicked map coordinate.
  const handleMapPlace = useCallback(
    (coordinate: LngLat) => {
      if (tool === "pin") {
        const nextPin: Pin = {
          id: makeId("pin"),
          lng: coordinate[0],
          lat: coordinate[1],
          type: "facility",
          severity: "medium",
          title: `New ${TYPE_META.facility.label} marker`,
          source: "Analyst input",
          updated: "Now",
          note: "User marker added on the map. Title, type, priority, and note can be edited from the detail panel.",
        };
        pushHistory();
        setPins((current) => [...current, nextPin]);
        // Open the new pin in the detail panel so it can be titled right away.
        setSelection({ type: "pin", id: nextPin.id });
        return;
      }

      if (tool === "line" || tool === "area") {
        setDraft((current) => [...current, coordinate]);
      }
    },
    [tool, pushHistory],
  );

  // Bind map click (place) + dbl-click (finish) to the current handlers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onClick = (event: maplibregl.MapMouseEvent) => {
      if (event.originalEvent.detail > 1) return; // ignore the dbl-click pair

      // Select tool: hit-test analyst pins and drawings, open the detail panel.
      if (toolRef.current === "select") {
        const hitLayers = [PINS_LAYER, ...ANNOTATION_HIT_LAYERS].filter((id) =>
          map.getLayer(id),
        );
        const features = hitLayers.length
          ? map.queryRenderedFeatures(event.point, { layers: hitLayers })
          : [];
        const pinFeature = features.find((f) => f.layer.id === PINS_LAYER);
        const annotationFeature = features.find((f) => f.layer.id !== PINS_LAYER);
        if (pinFeature?.properties?.id) {
          setSelection({ type: "pin", id: String(pinFeature.properties.id) });
          return;
        }
        if (annotationFeature?.properties?.id) {
          setSelection({
            type: "annotation",
            id: String(annotationFeature.properties.id),
          });
          return;
        }
        setSelection(null);
        return;
      }

      handleMapPlace([event.lngLat.lng, event.lngLat.lat]);
    };
    const onDblClick = (event: maplibregl.MapMouseEvent) => {
      event.preventDefault();
      finishDraft();
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
    };
  }, [handleMapPlace, finishDraft, mapReady]);

  // Set the map cursor for the active tool and suppress MapLibre's
  // double-click zoom while drawing (so dbl-click can finish a line/area).
  useEffect(() => {
    toolRef.current = tool;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (tool === "line" || tool === "area") map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = toolCursor(tool);
  }, [tool, mapReady]);

  // Airbases overlay — 1240 military airbases as a data-driven circle layer
  // (GeoJSON streamed from /public; click opens a detail popup).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource(AIRBASES_SOURCE)) {
      map.addSource(AIRBASES_SOURCE, { type: "geojson", data: AIRBASES_DATA_URL });
      map.addLayer({
        id: AIRBASES_LAYER,
        type: "circle",
        source: AIRBASES_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2, 6, 3.4, 10, 5],
          "circle-color": [
            "match",
            ["get", "status"],
            "Active",
            "#e0a82e",
            ["Closed", "Inactive"],
            "#7a6a52",
            "#9aa1ab",
          ],
          "circle-opacity": ["match", ["get", "status"], "Active", 0.95, 0.6],
          "circle-stroke-color": "#05070b",
          "circle-stroke-width": 1,
        },
      });
    }

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "264px",
      className: "iw-airbase-popup",
    });

    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const coords = feature.geometry.coordinates.slice(0, 2) as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(buildAirbasePopup(feature.properties ?? {}))
        .addTo(map);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = toolCursor(toolRef.current);
    };

    map.on("click", AIRBASES_LAYER, handleClick);
    map.on("mouseenter", AIRBASES_LAYER, handleEnter);
    map.on("mouseleave", AIRBASES_LAYER, handleLeave);

    return () => {
      map.off("click", AIRBASES_LAYER, handleClick);
      map.off("mouseenter", AIRBASES_LAYER, handleEnter);
      map.off("mouseleave", AIRBASES_LAYER, handleLeave);
      popup.remove();
    };
  }, [mapReady]);

  // Chokepoints overlay — strategic maritime passages as a toggleable circle layer
  // (GeoJSON streamed from /public; click opens a detail popup).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource(CHOKEPOINTS_SOURCE)) {
      map.addSource(CHOKEPOINTS_SOURCE, { type: "geojson", data: CHOKEPOINTS_DATA_URL });
      map.addLayer({
        id: CHOKEPOINTS_LAYER,
        type: "circle",
        source: CHOKEPOINTS_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.5, 6, 4.4, 10, 6.5],
          "circle-color": "#4fd1c5",
          "circle-opacity": 0.92,
          "circle-stroke-color": "#041014",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 1, 8, 1.6],
        },
      });
    }

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "264px",
      className: "iw-airbase-popup",
    });

    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const coords = feature.geometry.coordinates.slice(0, 2) as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(buildChokepointPopup(feature.properties ?? {}))
        .addTo(map);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = toolCursor(toolRef.current);
    };

    map.on("click", CHOKEPOINTS_LAYER, handleClick);
    map.on("mouseenter", CHOKEPOINTS_LAYER, handleEnter);
    map.on("mouseleave", CHOKEPOINTS_LAYER, handleLeave);

    return () => {
      map.off("click", CHOKEPOINTS_LAYER, handleClick);
      map.off("mouseenter", CHOKEPOINTS_LAYER, handleEnter);
      map.off("mouseleave", CHOKEPOINTS_LAYER, handleLeave);
      popup.remove();
    };
  }, [mapReady]);

  // Ports overlay — ~3,669 world ports as a data-driven circle layer
  // (native GeoJSON layer, not HTML markers, so the globe stays smooth;
  // GeoJSON streamed from /public; click opens a detail popup).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource(PORTS_SOURCE)) {
      map.addSource(PORTS_SOURCE, { type: "geojson", data: PORTS_DATA_URL });
      map.addLayer({
        id: PORTS_LAYER,
        type: "circle",
        source: PORTS_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.8, 6, 3, 10, 4.6],
          "circle-color": "#4aa8ff",
          "circle-opacity": 0.85,
          "circle-stroke-color": "#04121f",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 1.2],
        },
      });
    }

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "264px",
      className: "iw-airbase-popup",
    });

    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const coords = feature.geometry.coordinates.slice(0, 2) as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(buildPortPopup(feature.properties ?? {}))
        .addTo(map);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = toolCursor(toolRef.current);
    };

    map.on("click", PORTS_LAYER, handleClick);
    map.on("mouseenter", PORTS_LAYER, handleEnter);
    map.on("mouseleave", PORTS_LAYER, handleLeave);

    return () => {
      map.off("click", PORTS_LAYER, handleClick);
      map.off("mouseenter", PORTS_LAYER, handleEnter);
      map.off("mouseleave", PORTS_LAYER, handleLeave);
      popup.remove();
    };
  }, [mapReady]);

  // Nuclear facilities overlay — civil, military, and strategic nuclear sites
  // (GeoJSON streamed from /public; click opens a detail popup).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource(NUCLEAR_FACILITIES_SOURCE)) {
      map.addSource(NUCLEAR_FACILITIES_SOURCE, {
        type: "geojson",
        data: NUCLEAR_FACILITIES_DATA_URL,
      });
      map.addLayer({
        id: NUCLEAR_FACILITIES_LAYER,
        type: "circle",
        source: NUCLEAR_FACILITIES_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.2, 6, 3.8, 10, 5.8],
          "circle-color": "#9cff6a",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#061008",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 0.7, 8, 1.4],
        },
      });
    }

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "292px",
      className: "iw-airbase-popup",
    });

    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const coords = feature.geometry.coordinates.slice(0, 2) as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(buildNuclearFacilityPopup(feature.properties ?? {}))
        .addTo(map);
    };
    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = toolCursor(toolRef.current);
    };

    map.on("click", NUCLEAR_FACILITIES_LAYER, handleClick);
    map.on("mouseenter", NUCLEAR_FACILITIES_LAYER, handleEnter);
    map.on("mouseleave", NUCLEAR_FACILITIES_LAYER, handleLeave);

    return () => {
      map.off("click", NUCLEAR_FACILITIES_LAYER, handleClick);
      map.off("mouseenter", NUCLEAR_FACILITIES_LAYER, handleEnter);
      map.off("mouseleave", NUCLEAR_FACILITIES_LAYER, handleLeave);
      popup.remove();
    };
  }, [mapReady]);

  // Apply the left-panel overlay toggles to their MapLibre layers.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    for (const overlay of MAP_OVERLAYS) {
      if (!map.getLayer(overlay.layerId)) continue;
      map.setLayoutProperty(
        overlay.layerId,
        "visibility",
        overlayVisibility[overlay.id] ? "visible" : "none",
      );
    }
  }, [overlayVisibility, mapReady]);

  function toggleOverlay(id: string) {
    setOverlayVisibility((current) => ({ ...current, [id]: !current[id] }));
  }

  // Undo: first steps back through the active draft, then pops the last
  // workspace snapshot (covers pin/drawing add, delete, move, clear, import).
  function handleUndo() {
    if ((tool === "line" || tool === "area") && draft.length > 0) {
      setDraft((current) => current.slice(0, -1));
      return;
    }
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((current) => current.slice(0, -1));
    setPins(last.pins);
    setAnnotations(last.annotations);
    setSelection(null);
  }

  // Clear: two-step confirm — first click arms the button, second click
  // wipes pins + drawings (undoable via the history snapshot).
  function handleClear() {
    if (draft.length === 0 && annotations.length === 0 && pins.length === 0) return;
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmClearTimer.current) window.clearTimeout(confirmClearTimer.current);
      confirmClearTimer.current = window.setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    if (confirmClearTimer.current) window.clearTimeout(confirmClearTimer.current);
    setConfirmClear(false);
    pushHistory();
    setDraft([]);
    setAnnotations([]);
    setPins([]);
    setSelection(null);
  }

  function showTransferNote(message: string) {
    setTransferNote(message);
    if (transferNoteTimer.current) window.clearTimeout(transferNoteTimer.current);
    transferNoteTimer.current = window.setTimeout(() => setTransferNote(null), 6000);
  }

  // Export the analyst workspace as a plain GeoJSON FeatureCollection.
  function handleExport() {
    if (pins.length === 0 && annotations.length === 0) return;
    const featureCollection = {
      type: "FeatureCollection",
      features: [
        ...pins.map((pin) => ({
          type: "Feature",
          properties: {
            echisKind: "pin",
            title: pin.title,
            type: pin.type,
            severity: pin.severity,
            note: pin.note,
            source: pin.source,
            updated: pin.updated,
          },
          geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
        })),
        ...annotations.map((annotation) => ({
          type: "Feature",
          properties: {
            echisKind: "annotation",
            name: annotation.name ?? "",
            color: annotation.color,
          },
          geometry:
            annotation.kind === "area"
              ? {
                  type: "Polygon",
                  coordinates: [[...annotation.coordinates, annotation.coordinates[0]]],
                }
              : { type: "LineString", coordinates: annotation.coordinates },
        })),
      ],
    };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `intel-watch-${stamp}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
    showTransferNote(`${pins.length} markers, ${annotations.length} drawings exported.`);
  }

  // Import a GeoJSON file: Points become pins, LineStrings/Polygons drawings.
  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          features?: {
            geometry?: { type?: string; coordinates?: unknown };
            properties?: Record<string, unknown>;
          }[];
        };
        const features = Array.isArray(parsed?.features) ? parsed.features : [];
        const importedPins: Pin[] = [];
        const importedAnnotations: Annotation[] = [];
        for (const feature of features) {
          const geometry = feature?.geometry;
          const properties = feature?.properties ?? {};
          if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
            const pin = sanitizePin({
              ...properties,
              id: undefined,
              lng: geometry.coordinates[0],
              lat: geometry.coordinates[1],
            });
            if (pin) importedPins.push(pin);
          } else if (geometry?.type === "LineString") {
            const annotation = sanitizeAnnotation({
              ...properties,
              id: undefined,
              kind: "line",
              coordinates: geometry.coordinates,
            });
            if (annotation) importedAnnotations.push(annotation);
          } else if (geometry?.type === "Polygon" && Array.isArray(geometry.coordinates)) {
            const ring = Array.isArray(geometry.coordinates[0])
              ? (geometry.coordinates[0] as unknown[]).slice(0, -1)
              : [];
            const annotation = sanitizeAnnotation({
              ...properties,
              id: undefined,
              kind: "area",
              coordinates: ring,
            });
            if (annotation) importedAnnotations.push(annotation);
          }
        }
        if (!importedPins.length && !importedAnnotations.length) {
          showTransferNote("No importable items were found in the file.");
          return;
        }
        pushHistory();
        setPins((current) => [...current, ...importedPins]);
        setAnnotations((current) => [...current, ...importedAnnotations]);
        showTransferNote(
          `${importedPins.length} markers, ${importedAnnotations.length} drawings imported.`,
        );
      } catch {
        showTransferNote("File could not be read - it is not valid GeoJSON.");
      }
    };
    reader.readAsText(file);
  }

  // Search result: select + fly to the hit; reveal its overlay if hidden.
  const handleSearchHit = useCallback((hit: SearchHit) => {
    const map = mapRef.current;
    if (!map) return;
    if (hit.kind === "pin") {
      setSelection({ type: "pin", id: hit.id });
    } else if (hit.kind === "annotation") {
      setSelection({ type: "annotation", id: hit.id });
    } else if (hit.overlayId) {
      const overlayId = hit.overlayId;
      setOverlayVisibility((current) => ({ ...current, [overlayId]: true }));
    }
    map.flyTo({
      center: [hit.lng, hit.lat],
      zoom: Math.max(map.getZoom(), 6.5),
      duration: 900,
    });
    setSearchQuery("");
  }, []);

  function handleButtonZoom(direction: "in" | "out") {
    if (direction === "in") mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  }

  function handleRecenter() {
    mapRef.current?.flyTo({
      center: ECHIS_VIEW.center,
      zoom: ECHIS_VIEW.zoom,
      duration: 900,
    });
  }

  function updatePin(pinId: string, patch: Partial<Pin>) {
    setPins((current) =>
      current.map((pin) =>
        pin.id === pinId ? { ...pin, ...patch, updated: "Now" } : pin,
      ),
    );
  }

  function updateAnnotation(annotationId: string, patch: Partial<Annotation>) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === annotationId ? { ...annotation, ...patch } : annotation,
      ),
    );
  }

  function handleDeletePin(pinId: string) {
    pushHistory();
    setPins((current) => current.filter((pin) => pin.id !== pinId));
    setSelection(null);
  }

  function handleDeleteAnnotation(annotationId: string) {
    pushHistory();
    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== annotationId),
    );
    setSelection(null);
  }

  function handleFocusSelection() {
    const map = mapRef.current;
    if (!map) return;
    if (selectedPin) {
      map.flyTo({
        center: [selectedPin.lng, selectedPin.lat],
        zoom: Math.max(map.getZoom(), 6.5),
        duration: 900,
      });
      return;
    }
    if (selectedAnnotation) {
      const lngs = selectedAnnotation.coordinates.map((c) => c[0]);
      const lats = selectedAnnotation.coordinates.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 90, duration: 900, maxZoom: 8 },
      );
    }
  }

  // Render committed annotations + the in-progress draft as GeoJSON layers.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const annotationData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: annotations.map((annotation) => ({
        type: "Feature",
        properties: {
          id: annotation.id,
          color: annotation.color,
          selected:
            selection?.type === "annotation" && selection.id === annotation.id,
        },
        geometry:
          annotation.kind === "area"
            ? {
                type: "Polygon",
                coordinates: [
                  [...annotation.coordinates, annotation.coordinates[0]],
                ],
              }
            : { type: "LineString", coordinates: annotation.coordinates },
      })),
    };

    const draftData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features:
        draft.length > 1
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: draft },
              },
            ]
          : [],
    };

    const annoSource = map.getSource("iw-annotations");
    if (annoSource) {
      (annoSource as maplibregl.GeoJSONSource).setData(annotationData);
    } else {
      map.addSource("iw-annotations", { type: "geojson", data: annotationData });
      map.addLayer({
        id: "iw-annotations-fill",
        type: "fill",
        source: "iw-annotations",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.24,
            0.12,
          ],
        },
      });
      map.addLayer({
        id: "iw-annotations-line",
        type: "line",
        source: "iw-annotations",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["boolean", ["get", "selected"], false], 3.4, 2],
          "line-opacity": ["case", ["boolean", ["get", "selected"], false], 1, 0.9],
        },
      });
    }

    const draftSource = map.getSource("iw-draft");
    if (draftSource) {
      (draftSource as maplibregl.GeoJSONSource).setData(draftData);
    } else {
      map.addSource("iw-draft", { type: "geojson", data: draftData });
      map.addLayer({
        id: "iw-draft-line",
        type: "line",
        source: "iw-draft",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#c4ccd6",
          "line-width": 1.6,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });
    }
  }, [annotations, draft, mapReady, selection]);

  // Analyst pins — severity-coloured circle layer with a selection ring.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const pinData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pins.map((pin) => ({
        type: "Feature",
        properties: {
          id: pin.id,
          severity: pin.severity,
          selected: selection?.type === "pin" && selection.id === pin.id,
        },
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
      })),
    };

    const pinSource = map.getSource(PINS_SOURCE);
    if (pinSource) {
      (pinSource as maplibregl.GeoJSONSource).setData(pinData);
    } else {
      map.addSource(PINS_SOURCE, { type: "geojson", data: pinData });
      map.addLayer({
        id: PINS_LAYER,
        type: "circle",
        source: PINS_SOURCE,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            ["match", ["get", "severity"], "critical", 3.9, "high", 3.4, 3],
            6,
            ["match", ["get", "severity"], "critical", 6, "high", 5.2, 4.6],
            10,
            ["match", ["get", "severity"], "critical", 8.6, "high", 7.4, 6.6],
          ],
          "circle-color": [
            "match",
            ["get", "severity"],
            "critical",
            SEVERITY_META.critical.color,
            "high",
            SEVERITY_META.high.color,
            "medium",
            SEVERITY_META.medium.color,
            "low",
            SEVERITY_META.low.color,
            "#c4ccd6",
          ],
          "circle-opacity": 0.95,
          "circle-stroke-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            "#f5f7fa",
            "#05070b",
          ],
          "circle-stroke-width": [
            "case",
            ["boolean", ["get", "selected"], false],
            2,
            1.1,
          ],
        },
      });
    }
  }, [pins, mapReady, selection]);

  // Drag-to-move for analyst pins: with the select tool, mousedown on a pin
  // grabs it; the map pan is suppressed for that gesture via preventDefault.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let draggingId: string | null = null;
    let moved = false;
    let dragSnapshot: WorkspaceSnapshot | null = null;

    const onMove = (event: maplibregl.MapMouseEvent) => {
      if (!draggingId) return;
      moved = true;
      const { lng, lat } = event.lngLat;
      setPins((current) =>
        current.map((pin) =>
          pin.id === draggingId ? { ...pin, lng, lat, updated: "Now" } : pin,
        ),
      );
    };
    const onUp = () => {
      if (!draggingId) return;
      if (moved && dragSnapshot) pushHistory(dragSnapshot);
      draggingId = null;
      dragSnapshot = null;
      map.off("mousemove", onMove);
      map.getCanvas().style.cursor = toolCursor(toolRef.current);
    };
    const onDown = (event: maplibregl.MapLayerMouseEvent) => {
      if (toolRef.current !== "select") return;
      const id = event.features?.[0]?.properties?.id;
      if (!id) return;
      event.preventDefault(); // keep dragPan from grabbing this gesture
      draggingId = String(id);
      moved = false;
      dragSnapshot = workspaceRef.current;
      map.getCanvas().style.cursor = "grabbing";
      map.on("mousemove", onMove);
    };

    map.on("mousedown", PINS_LAYER, onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      map.off("mousedown", PINS_LAYER, onDown);
      map.off("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [mapReady, pushHistory]);

  // Pointer cursor over selectable pins/drawings while the select tool is on.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const handleEnter = () => {
      if (toolRef.current !== "select") return;
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = toolCursor(toolRef.current);
    };
    const hitLayers = [PINS_LAYER, ...ANNOTATION_HIT_LAYERS];
    hitLayers.forEach((layerId) => {
      map.on("mouseenter", layerId, handleEnter);
      map.on("mouseleave", layerId, handleLeave);
    });
    return () => {
      hitLayers.forEach((layerId) => {
        map.off("mouseenter", layerId, handleEnter);
        map.off("mouseleave", layerId, handleLeave);
      });
    };
  }, [mapReady]);

  // Name + measurement labels — one lightweight HTML marker per drawing
  // (annotation counts stay tiny, so DOM markers are safe here).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    annotationMarkersRef.current.forEach((marker) => marker.remove());
    annotationMarkersRef.current = [];

    annotations.forEach((annotation) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "iw-anno-label";
      element.style.setProperty("--anno-color", annotation.color);
      element.textContent = annotation.name
        ? `${annotation.name} · ${annotationMeasurement(annotation)}`
        : annotationMeasurement(annotation);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (toolRef.current !== "select") return;
        setSelection({ type: "annotation", id: annotation.id });
      });
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat(annotationAnchor(annotation.coordinates))
        .addTo(map);
      annotationMarkersRef.current.push(marker);
    });

    return () => {
      annotationMarkersRef.current.forEach((marker) => marker.remove());
      annotationMarkersRef.current = [];
    };
  }, [annotations, mapReady]);

  const mapReadout = formatCoordinate(cursorCoordinate[1], cursorCoordinate[0]);

  return (
    <section className="iw-shell" aria-label="ECHIS Intel Watch workbench">
      <style>{`
        .iw-shell {
          /* Single black used by every panel/dark surface in Intel Watch.
             Pure neutral tone — no anthracite/blue tint. */
          --iw-black: #040404;
          --iw-panel-font: var(--font-ui), "Hanken Grotesk", "Segoe UI", system-ui, sans-serif;
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
          background: var(--iw-black);
          color: #c4ccd6;
          font-family: var(--font-ui), "Hanken Grotesk", sans-serif;
        }

        .iw-shell button,
        .iw-shell input {
          font: inherit;
        }

        .iw-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff2b3d;
          box-shadow: 0 0 6px #ff2b3d;
          animation: iw-blink 1.8s infinite;
        }

        .iw-search {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 420px;
          height: 30px;
        }

        .iw-search svg {
          position: absolute;
          left: 12px;
          color: var(--c-t5);
          pointer-events: none;
        }

        .iw-search input {
          width: 100%;
          height: 30px;
          padding: 0 12px 0 34px;
          border: 1px solid var(--c-border-1);
          border-radius: 8px;
          outline: none;
          background: rgba(255, 255, 255, 0.03);
          color: var(--c-t1);
          font-size: 11.5px;
          transition: background 140ms ease, border-color 140ms ease;
        }

        .iw-search input::placeholder {
          color: var(--c-t6);
        }

        .iw-search input:focus {
          border-color: rgba(255, 43, 61, 0.45);
          background: rgba(255, 43, 61, 0.04);
        }

        .iw-panel-search {
          width: auto;
          max-width: none;
          height: 27px;
          margin: 8px 11px 7px;
          flex: 0 0 auto;
          justify-self: stretch;
        }

        .iw-panel-search input {
          height: 27px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.025);
          font-size: 9.8px;
        }

        .iw-panel-search svg {
          color: var(--c-t4);
        }

        .iw-panel-search input::placeholder {
          color: var(--c-t4);
        }

        /* Panel search results — inline list under the search input. */
        .iw-search-results {
          flex: 0 0 auto;
          display: grid;
          gap: 2px;
          max-height: 218px;
          overflow-y: auto;
          margin: 0 11px 8px;
          padding: 4px;
          border: 1px solid var(--c-border-2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.014);
        }

        .iw-search-hit {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          padding: 5px 7px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--c-t3);
          cursor: pointer;
          text-align: left;
          transition: background 140ms ease;
        }

        .iw-search-hit:hover {
          background: rgba(255, 43, 61, 0.08);
        }

        .iw-search-hit-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .iw-search-hit-copy {
          display: grid;
          min-width: 0;
          gap: 2px;
        }

        .iw-search-hit-label {
          overflow: hidden;
          color: var(--c-t2);
          font-size: 9.6px;
          font-weight: 600;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .iw-search-hit-sub {
          color: var(--c-t4);
          font-size: 7.6px;
          font-weight: 600;
          letter-spacing: 0.06em;
          line-height: 1;
          text-transform: uppercase;
        }

        .iw-search-empty {
          padding: 7px;
          color: var(--c-t4);
          font-size: 9px;
          text-align: center;
        }

        .iw-map-area {
          position: absolute;
          top: 0;
          left: 0;
          right: ${PANEL_WIDTH}px;
          bottom: 0;
          overflow: hidden;
          background: var(--iw-black);
        }

        .iw-map-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: var(--iw-black);
        }

        .iw-map-canvas .maplibregl-canvas {
          outline: none;
        }

        .iw-airbase-popup .maplibregl-popup-content {
          padding: 0;
          overflow: hidden;
          border: 1px solid var(--c-border-1);
          border-radius: 10px;
          background: var(--iw-black);
          box-shadow: 0 14px 44px rgba(0, 0, 0, 0.62);
          color: var(--c-t3);
          font-family: var(--font-ui), "Hanken Grotesk", sans-serif;
        }

        .iw-airbase-popup .maplibregl-popup-tip {
          border-top-color: var(--iw-black);
          border-bottom-color: var(--iw-black);
        }

        .iw-airbase-popup .maplibregl-popup-close-button {
          width: 20px;
          height: 20px;
          color: var(--c-t5);
          font-size: 15px;
          line-height: 1;
        }

        .iw-airbase-popup .maplibregl-popup-close-button:hover {
          background: transparent;
          color: var(--c-t1);
        }

        .iw-ab {
          padding: 10px 12px 11px;
        }

        .iw-ab-title {
          padding-right: 14px;
          color: var(--c-t1);
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 11.5px;
          font-weight: 600;
          line-height: 1.25;
        }

        .iw-ab-sub {
          margin-top: 4px;
          color: #e0a82e;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8.6px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .iw-ab-meta {
          display: grid;
          gap: 4px;
          margin-top: 9px;
        }

        .iw-ab-row {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          font-size: 9.4px;
        }

        .iw-ab-row span {
          flex: 0 0 auto;
          color: var(--c-t5);
        }

        .iw-ab-row b {
          color: var(--c-t2);
          font-weight: 600;
          text-align: right;
        }

        .iw-ab-link {
          display: inline-block;
          margin-top: 10px;
          color: var(--c-accent-text);
          font-size: 9.4px;
          font-weight: 600;
          text-decoration: none;
        }

        .iw-ab-link:hover {
          text-decoration: underline;
        }

        .iw-glass {
          border: 1px solid var(--c-border-1);
          background: rgba(4, 4, 4, 0.78);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(14px);
        }

        .iw-left-stack {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }

        .iw-tool-rail {
          width: 56px;
          border-radius: 13px;
          padding: 9px 8px 10px;
        }

        .iw-rail-label {
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 8.4px;
          font-weight: 700;
          letter-spacing: 0.18em;
          line-height: 1;
          text-transform: uppercase;
        }

        .iw-section-label {
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 8.2px;
          font-weight: 700;
          letter-spacing: 0.12em;
          line-height: 1;
          text-transform: uppercase;
        }

        .iw-rail-label {
          margin-bottom: 10px;
          text-align: center;
        }

        .iw-tool-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .iw-tool-item {
          width: 40px;
          display: grid;
          justify-items: center;
          gap: 4px;
        }

        .iw-tool-item span {
          max-width: 46px;
          color: var(--c-t3);
          font-family: var(--iw-panel-font);
          font-size: 8.4px;
          font-weight: 600;
          line-height: 1.05;
          text-align: center;
          white-space: normal;
        }

        .iw-tool-button {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid var(--c-border-1);
          border-radius: 9px;
          background: rgba(4, 4, 4, 0.5);
          color: var(--c-t4);
          cursor: pointer;
          transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease;
        }

        .iw-tool-button:hover:not(:disabled) {
          border-color: rgba(255, 43, 61, 0.34);
          color: #ff6470;
        }

        .iw-tool-button[aria-pressed="true"] {
          border-color: rgba(255, 43, 61, 0.55);
          background: linear-gradient(180deg, rgba(255, 43, 61, 0.24), rgba(179, 18, 31, 0.10));
          color: #ff6470;
        }

        .iw-tool-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .iw-tool-divider {
          width: 36px;
          height: 1px;
          background: var(--c-border-1);
        }

        .iw-panel-header {
          display: flex;
          align-items: center;
        }

        .iw-coordinates {
          position: absolute;
          left: 50%;
          bottom: 16px;
          z-index: 19;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          color: var(--c-t4);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 10px;
          pointer-events: none;
          transform: translateX(-50%);
          white-space: nowrap;
        }

        .iw-map-controls {
          position: absolute;
          right: 14px;
          bottom: 14px;
          z-index: 20;
          display: grid;
          gap: 9px;
        }

        .iw-zoom-group {
          display: grid;
          overflow: hidden;
          border-radius: 11px;
        }

        .iw-control-button {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 0;
          border-bottom: 1px solid var(--c-border-1);
          background: transparent;
          color: #c4ccd6;
          cursor: pointer;
          transition: background 140ms ease, color 140ms ease;
        }

        .iw-control-button:hover {
          background: rgba(255, 43, 61, 0.10);
          color: #ff6470;
        }

        .iw-control-button:last-child {
          border-bottom: 0;
        }

        .iw-control-single {
          border: 1px solid var(--c-border-1);
          border-radius: 11px;
        }

        .iw-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 25;
          width: ${PANEL_WIDTH}px;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--c-border-1);
          background: var(--iw-black);
          color: var(--c-t2);
          font-family: var(--iw-panel-font);
        }

        .iw-panel-header {
          justify-content: space-between;
          flex: 0 0 auto;
          gap: 8px;
          padding: 8px 11px 7px;
          border-bottom: 1px solid var(--c-border-2);
        }

        .iw-panel-title {
          color: var(--c-t1);
          font-family: var(--iw-panel-font);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
        }

        .iw-panel-mode-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex: 0 0 auto;
          height: 22px;
          border-bottom: 1px solid var(--c-border-2);
          color: var(--c-t3);
          font-family: var(--iw-panel-font);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* Panel tabs (Layers / Workspace) — same ribbon height as the
           DETAILS mode title so switching selection doesn't shift the layout. */
        .iw-panel-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          flex: 0 0 auto;
          height: 22px;
          border-bottom: 1px solid var(--c-border-2);
        }

        .iw-panel-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 0;
          background: transparent;
          color: var(--c-t4);
          cursor: pointer;
          font-family: var(--iw-panel-font);
          font-size: 7.2px;
          font-weight: 600;
          letter-spacing: 0.04em;
          transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease;
        }

        .iw-panel-tab:hover {
          color: var(--c-t2);
        }

        .iw-panel-tab[data-active="true"] {
          background: rgba(255, 43, 61, 0.06);
          box-shadow: inset 0 -1px 0 rgba(255, 43, 61, 0.55);
          color: #ff6470;
        }

        .iw-panel-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
        }

        .iw-layers-body {
          padding: 9px 10px 13px;
        }

        .iw-data-layer-list {
          display: grid;
          gap: 4px;
          margin-top: 7px;
        }

        .iw-data-layer-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 7px;
          width: 100%;
          min-height: 31px;
          padding: 5px 7px;
          border: 1px solid var(--c-border-3);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.014);
          color: var(--c-t3);
          cursor: pointer;
          text-align: left;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }

        .iw-data-layer-row:hover {
          border-color: rgba(255, 43, 61, 0.34);
          background: rgba(255, 43, 61, 0.08);
        }

        .iw-data-layer-row[data-visible="true"] {
          border-color: rgba(255, 43, 61, 0.55);
          background: linear-gradient(180deg, rgba(255, 43, 61, 0.24), rgba(179, 18, 31, 0.10));
          color: #ff6470;
        }

        .iw-data-layer-icon {
          width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--layer-hue) 42%, transparent);
          border-radius: 7px;
          background: color-mix(in srgb, var(--layer-hue) 12%, transparent);
          color: var(--layer-hue);
        }

        .iw-data-layer-row[data-visible="false"] .iw-data-layer-icon {
          opacity: 0.45;
        }

        .iw-data-layer-row[data-visible="true"] .iw-data-layer-icon {
          border-color: rgba(255, 43, 61, 0.50);
          background: rgba(255, 43, 61, 0.14);
          color: #ff6470;
        }

        .iw-data-layer-copy {
          display: grid;
          min-width: 0;
          gap: 2px;
        }

        .iw-data-layer-name {
          overflow: hidden;
          color: var(--c-t2);
          font-size: 9.6px;
          font-weight: 600;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .iw-data-layer-meta {
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 7.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .iw-data-layer-row[data-visible="true"] .iw-data-layer-meta {
          color: #ff6470;
        }

        /* Workspace tab — saved-item counters + GeoJSON transfer. */
        .iw-workspace-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          margin-top: 7px;
        }

        .iw-workspace-stat {
          display: grid;
          gap: 4px;
          padding: 8px 10px;
          border: 1px solid var(--c-border-2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
        }

        .iw-workspace-stat strong {
          color: var(--c-t1);
          font-family: var(--iw-panel-font);
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1;
        }

        .iw-workspace-stat span {
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 7.4px;
          font-weight: 700;
          letter-spacing: 0.1em;
          line-height: 1;
        }

        .iw-transfer-section {
          margin-top: 13px;
        }

        .iw-transfer-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          margin-top: 7px;
        }

        .iw-transfer-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 29px;
          padding: 5px 7px;
          border: 1px solid var(--c-border-3);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.014);
          color: var(--c-t3);
          cursor: pointer;
          font-size: 9.2px;
          font-weight: 600;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }

        .iw-transfer-button:hover:not(:disabled) {
          border-color: rgba(255, 43, 61, 0.34);
          background: rgba(255, 43, 61, 0.08);
          color: #ff6470;
        }

        .iw-transfer-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .iw-transfer-note {
          margin-top: 7px;
          color: var(--c-t4);
          font-size: 8.6px;
          line-height: 1.4;
        }

        /* Floating tool config for line/area draw palette. */
        .iw-tool-config {
          position: absolute;
          top: 18px;
          left: 50%;
          z-index: 21;
          display: grid;
          gap: 7px;
          padding: 9px 12px 8px;
          border-radius: 12px;
          transform: translateX(-50%);
        }

        .iw-config-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .iw-config-label {
          flex: 0 0 auto;
          min-width: 28px;
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 7.4px;
          font-weight: 700;
          letter-spacing: 0.14em;
        }

        .iw-config-hint {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--c-t3);
          font-size: 9.8px;
          white-space: nowrap;
        }

        .iw-config-measure {
          margin-left: 2px;
          color: var(--c-t1);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 9.2px;
          font-weight: 600;
        }

        .iw-chip-row,
        .iw-detail-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .iw-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3.5px 7px;
          border: 1px solid var(--c-border-1);
          border-radius: 999px;
          background: rgba(4, 4, 4, 0.5);
          color: var(--c-t4);
          cursor: pointer;
          font-family: var(--iw-panel-font);
          font-size: 7.8px;
          font-weight: 600;
          letter-spacing: 0.05em;
          white-space: nowrap;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }

        .iw-chip:hover {
          border-color: rgba(255, 255, 255, 0.22);
          color: var(--c-t2);
        }

        .iw-chip[data-active="true"] {
          border-color: color-mix(in srgb, var(--chip-color, #ff6470) 62%, transparent);
          background: color-mix(in srgb, var(--chip-color, #ff6470) 14%, transparent);
          color: var(--chip-color, #ff6470);
        }

        .iw-swatch-row {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .iw-swatch {
          width: 15px;
          height: 15px;
          flex: 0 0 auto;
          padding: 0;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 50%;
          background: var(--swatch-color);
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }

        .iw-swatch:hover {
          transform: scale(1.15);
        }

        .iw-swatch[data-active="true"] {
          box-shadow:
            0 0 0 2px var(--iw-black),
            0 0 0 3.5px var(--swatch-color);
        }

        /* Drawing name + measurement labels rendered as map markers. */
        .iw-anno-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2.5px 8px;
          border: 1px solid color-mix(in srgb, var(--anno-color, #c4ccd6) 45%, transparent);
          border-radius: 999px;
          background: rgba(4, 4, 4, 0.82);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
          color: #c4ccd6;
          cursor: pointer;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .iw-anno-label::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--anno-color, #c4ccd6);
        }

        /* Detail panel (selected pin / drawing). */
        .iw-detail-strip {
          height: 3px;
          background: linear-gradient(90deg, var(--detail-color, #ff2b3d), transparent);
        }

        .iw-detail-body {
          padding: 10px 11px 14px;
        }

        .iw-back-link {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-bottom: 10px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--c-t4);
          cursor: pointer;
          font-family: var(--iw-panel-font);
          font-size: 7.6px;
          font-weight: 700;
          letter-spacing: 0.14em;
          transition: color 140ms ease;
        }

        .iw-back-link:hover {
          color: #ff6470;
        }

        .iw-type-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border: 1px solid var(--c-border-1);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--c-t3);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 7.8px;
        }

        .iw-detail-coord {
          color: var(--c-t3);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8.6px;
        }

        .iw-detail-section {
          margin-top: 12px;
        }

        .iw-detail-label {
          margin-bottom: 6px;
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 7.4px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .iw-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 10px;
          border: 1px solid var(--c-border-2);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
        }

        .iw-meta-row span {
          color: var(--c-t2);
          font-size: 9px;
          font-weight: 600;
        }

        .iw-source-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 30px;
          padding: 7px 9px;
          border: 1px solid var(--c-border-2);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
          color: var(--c-t3);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8.8px;
          line-height: 1.35;
        }

        .iw-detail-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
        }

        .iw-primary-action {
          height: 30px;
          flex: 1 1 auto;
          border: 0;
          border-radius: 9px;
          background: linear-gradient(180deg, #ff2b3d, #b3121f);
          box-shadow: 0 4px 16px rgba(255, 43, 61, 0.30);
          color: white;
          cursor: pointer;
          font-size: 9.6px;
          font-weight: 700;
          transition: filter 140ms ease;
        }

        .iw-primary-action:hover {
          filter: brightness(1.08);
        }

        .iw-delete-action {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border: 1px solid var(--c-border-1);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
          color: var(--c-t4);
          cursor: pointer;
          transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
        }

        .iw-delete-action:hover {
          border-color: rgba(255, 43, 61, 0.32);
          background: rgba(255, 43, 61, 0.08);
          color: #ff6470;
        }

        .iw-edit-input,
        .iw-edit-textarea {
          width: 100%;
          padding: 7px 9px;
          border: 1px solid var(--c-border-1);
          border-radius: 8px;
          outline: none;
          background: rgba(255, 255, 255, 0.03);
          color: var(--c-t1);
          font-size: 10px;
          transition: border-color 140ms ease, background 140ms ease;
        }

        .iw-edit-input:focus,
        .iw-edit-textarea:focus {
          border-color: rgba(255, 43, 61, 0.45);
          background: rgba(255, 43, 61, 0.04);
        }

        .iw-edit-input::placeholder,
        .iw-edit-textarea::placeholder {
          color: var(--c-t5);
        }

        .iw-edit-textarea {
          min-height: 86px;
          resize: vertical;
          font-size: 9.6px;
          line-height: 1.5;
        }

        @keyframes iw-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.28; }
        }

        @media (max-width: 820px) {
          .iw-panel {
            width: 300px;
          }
          .iw-map-area {
            right: 300px;
          }
        }
      `}</style>

      <div className="iw-map-area">
        <div ref={mapContainerRef} className="iw-map-canvas" />

        {!loaderGone && (
          <IntelMapLoader
            ready={mapFullyLoaded}
            accent="#ff2b3d"
            onDone={() => setLoaderGone(true)}
          />
        )}

        <div className="iw-left-stack">
        <aside className="iw-glass iw-tool-rail" aria-label="Map tools">
          <div className="iw-rail-label">TOOLS</div>
          <div className="iw-tool-stack">
            <ToolButton
              active={tool === "select"}
              icon={MousePointer2}
              label="Select"
              onClick={() => setActiveTool("select")}
            />
            <ToolButton
              active={tool === "pin"}
              icon={MapPin}
              label="Marker"
              onClick={() => setActiveTool("pin")}
            />
            <ToolButton
              active={tool === "line"}
              icon={Route}
              label="Line"
              onClick={() => setActiveTool("line")}
            />
            <ToolButton
              active={tool === "area"}
              icon={Pentagon}
              label="Area"
              onClick={() => setActiveTool("area")}
            />
            <div className="iw-tool-divider" />
            <ToolButton
              disabled={draft.length === 0 && history.length === 0}
              icon={Undo2}
              label="Undo"
              onClick={handleUndo}
            />
            <ToolButton
              active={confirmClear}
              disabled={
                draft.length === 0 && annotations.length === 0 && pins.length === 0
              }
              icon={Trash2}
              label={confirmClear ? "Confirm?" : "Clear"}
              onClick={handleClear}
            />
          </div>
        </aside>

        </div>

        {(tool === "line" || tool === "area") && (
          <div className="iw-glass iw-tool-config" role="toolbar" aria-label="Drawing settings">
            <div className="iw-config-row">
              <span className="iw-config-label">COLOR</span>
              <div className="iw-swatch-row">
                {DRAW_PALETTE.map((color) => (
                  <button
                    key={color}
                    aria-label={`Drawing color ${color}`}
                    className="iw-swatch"
                    data-active={drawColor === color}
                    style={{ "--swatch-color": color } as CSSProperties}
                    type="button"
                    onClick={() => setDrawColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="iw-config-hint">
              <span className="iw-dot" aria-hidden="true" />
              {tool === "line"
                ? "Click points - double-click to finish - Esc cancels"
                : "Click vertices - 3+ points - double-click to finish - Esc cancels"}
              {draftMeasurement && (
                <b className="iw-config-measure">{draftMeasurement}</b>
              )}
            </div>
          </div>
        )}


        <div className="iw-glass iw-coordinates">
          <MapPin size={12} strokeWidth={1.8} />
          {mapReadout}
        </div>

        <div className="iw-map-controls" aria-label="Map controls">
          <div className="iw-glass iw-zoom-group">
            <button
              aria-label="Zoom in"
              className="iw-control-button"
              type="button"
              onClick={() => handleButtonZoom("in")}
            >
              <Plus size={17} strokeWidth={2.2} />
            </button>
            <button
              aria-label="Zoom out"
              className="iw-control-button"
              type="button"
              onClick={() => handleButtonZoom("out")}
            >
              <Minus size={17} strokeWidth={2.2} />
            </button>
          </div>
          <button
            aria-label="Recenter map"
            className="iw-glass iw-control-button iw-control-single"
            type="button"
            onClick={handleRecenter}
          >
            <Target size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <aside className="iw-panel" aria-label="Intel Watch status panel">
        <div className="iw-panel-header">
          <div className="iw-panel-title">STATUS PANEL</div>
        </div>

        <label className="iw-search iw-panel-search">
          <Search size={14} strokeWidth={1.8} />
          <input
            value={searchQuery}
            placeholder="Search: marker, base, port, facility..."
            onChange={(event) => {
              ensureOverlayIndex();
              setSearchQuery(event.target.value);
            }}
            onFocus={ensureOverlayIndex}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) {
                handleSearchHit(searchResults[0]);
              }
              if (event.key === "Escape") setSearchQuery("");
            }}
          />
        </label>

        {searchQuery.trim().length >= 2 && (
          <div className="iw-search-results" aria-label="Search results">
            {searchResults.length ? (
              searchResults.map((hit) => (
                <SearchHitRow
                  key={`${hit.kind}-${hit.id}`}
                  hit={hit}
                  onSelect={handleSearchHit}
                />
              ))
            ) : (
              <div className="iw-search-empty">
                {overlayIndex ? "No results found." : "Building index..."}
              </div>
            )}
          </div>
        )}

        {hasSelection ? (
          <div className="iw-panel-mode-title">
            <Info size={10} strokeWidth={1.8} />
            DETAILS
          </div>
        ) : (
          <div className="iw-panel-tabs" role="tablist" aria-label="Panel tabs">
            <button
              aria-selected={panelTab === "layers"}
              className="iw-panel-tab"
              data-active={panelTab === "layers"}
              role="tab"
              type="button"
              onClick={() => setPanelTab("layers")}
            >
              <Layers size={10} strokeWidth={1.8} />
              Layers
            </button>
            <button
              aria-selected={panelTab === "workspace"}
              className="iw-panel-tab"
              data-active={panelTab === "workspace"}
              role="tab"
              type="button"
              onClick={() => setPanelTab("workspace")}
            >
              <FolderOpen size={10} strokeWidth={1.8} />
              Workspace
            </button>
          </div>
        )}

        <div className="iw-panel-body intel-watch-scrollbar tm-scrollbar">
          {selectedPin ? (
            <div
              style={
                {
                  "--detail-color": SEVERITY_META[selectedPin.severity].color,
                } as CSSProperties
              }
            >
              <div className="iw-detail-strip" />
              <div className="iw-detail-body">
                <button
                  className="iw-back-link"
                  type="button"
                  onClick={() => setSelection(null)}
                >
                  <ChevronLeft size={11} strokeWidth={2.2} />
                  BACK
                </button>

                <div className="iw-detail-section" style={{ marginTop: 0 }}>
                  <div className="iw-detail-label">TYPE</div>
                  <div className="iw-detail-chips">
                    {PIN_TYPE_ORDER.map((type) => {
                      const meta = TYPE_META[type];
                      return (
                        <button
                          key={type}
                          className="iw-chip"
                          data-active={selectedPin.type === type}
                          style={{ "--chip-color": "#ff6470" } as CSSProperties}
                          type="button"
                          onClick={() => updatePin(selectedPin.id, { type })}
                        >
                          <meta.Icon size={10} strokeWidth={2} />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">TITLE</div>
                  <input
                    className="iw-edit-input"
                    value={selectedPin.title}
                    onChange={(event) =>
                      updatePin(selectedPin.id, { title: event.target.value })
                    }
                  />
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">PRIORITY</div>
                  <div className="iw-detail-chips">
                    {SEVERITY_ORDER.map((severity) => (
                      <button
                        key={severity}
                        className="iw-chip"
                        data-active={selectedPin.severity === severity}
                        style={
                          {
                            "--chip-color": SEVERITY_META[severity].color,
                          } as CSSProperties
                        }
                        type="button"
                        onClick={() => updatePin(selectedPin.id, { severity })}
                      >
                        {SEVERITY_META[severity].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">NOTE</div>
                  <textarea
                    className="iw-edit-textarea"
                    value={selectedPin.note}
                    onChange={(event) =>
                      updatePin(selectedPin.id, { note: event.target.value })
                    }
                  />
                </div>

                <div className="iw-detail-section">
                  <div className="iw-meta-row">
                    <div className="iw-detail-label" style={{ marginBottom: 0 }}>
                      LOCATION
                    </div>
                    <span className="iw-detail-coord">
                      {formatCoordinate(selectedPin.lat, selectedPin.lng)}
                    </span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">SOURCE</div>
                  <div className="iw-source-row">
                    <Globe2 size={13} strokeWidth={1.8} />
                    <span>{selectedPin.source}</span>
                  </div>
                </div>

                <div className="iw-detail-actions">
                  <button
                    className="iw-primary-action"
                    type="button"
                    onClick={handleFocusSelection}
                  >
                    Focus
                  </button>
                  <button
                    aria-label="Delete marker"
                    className="iw-delete-action"
                    type="button"
                    onClick={() => handleDeletePin(selectedPin.id)}
                  >
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          ) : selectedAnnotation ? (
            <div
              style={{ "--detail-color": selectedAnnotation.color } as CSSProperties}
            >
              <div className="iw-detail-strip" />
              <div className="iw-detail-body">
                <button
                  className="iw-back-link"
                  type="button"
                  onClick={() => setSelection(null)}
                >
                  <ChevronLeft size={11} strokeWidth={2.2} />
                  BACK
                </button>

                <div className="iw-type-chip">
                  {selectedAnnotation.kind === "area" ? (
                    <Pentagon size={11} strokeWidth={2.2} />
                  ) : (
                    <Route size={11} strokeWidth={2.2} />
                  )}
                  {selectedAnnotation.kind === "area" ? "Area" : "Line"}
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">NAME LABEL</div>
                  <input
                    className="iw-edit-input"
                    placeholder="e.g. Exercise area"
                    value={selectedAnnotation.name ?? ""}
                    onChange={(event) =>
                      updateAnnotation(selectedAnnotation.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="iw-detail-section">
                  <div className="iw-meta-row">
                    <div className="iw-detail-label" style={{ marginBottom: 0 }}>
                      {selectedAnnotation.kind === "area" ? "AREA" : "LENGTH"}
                    </div>
                    <span>{annotationMeasurement(selectedAnnotation)}</span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">COLOR</div>
                  <div className="iw-swatch-row">
                    {DRAW_PALETTE.map((color) => (
                      <button
                        key={color}
                        aria-label={`Drawing color ${color}`}
                        className="iw-swatch"
                        data-active={selectedAnnotation.color === color}
                        style={{ "--swatch-color": color } as CSSProperties}
                        type="button"
                        onClick={() =>
                          updateAnnotation(selectedAnnotation.id, { color })
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="iw-detail-actions">
                  <button
                    className="iw-primary-action"
                    type="button"
                    onClick={handleFocusSelection}
                  >
                    Focus
                  </button>
                  <button
                    aria-label="Delete drawing"
                    className="iw-delete-action"
                    type="button"
                    onClick={() => handleDeleteAnnotation(selectedAnnotation.id)}
                  >
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          ) : panelTab === "layers" ? (
            <div className="iw-layers-body">
              <div className="iw-data-layer-section">
                <div className="iw-section-label">DATA LAYERS</div>
                <div className="iw-data-layer-list">
                  {MAP_OVERLAYS.map((overlay) => {
                    const Icon = overlay.Icon;
                    const isVisible = overlayVisibility[overlay.id] ?? false;
                    return (
                      <button
                        key={overlay.id}
                        className="iw-data-layer-row"
                        data-visible={isVisible}
                        style={{ "--layer-hue": overlay.color } as CSSProperties}
                        type="button"
                        onClick={() => toggleOverlay(overlay.id)}
                      >
                        <span className="iw-data-layer-icon">
                          <Icon size={13} strokeWidth={1.9} />
                        </span>
                        <span className="iw-data-layer-copy">
                          <span className="iw-data-layer-name">{overlay.label}</span>
                          <span className="iw-data-layer-meta">
                            {isVisible ? "Visible" : "Hidden"}
                          </span>
                        </span>
                        {isVisible ? (
                          <Eye size={12} color="#ff6470" strokeWidth={1.9} />
                        ) : (
                          <EyeOff size={12} color="#8a94a3" strokeWidth={1.9} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="iw-layers-body">
              <div className="iw-section-label">SAVED ITEMS</div>
              <div className="iw-workspace-stats">
                <div className="iw-workspace-stat">
                  <strong>{pins.length}</strong>
                  <span>MARKERS</span>
                </div>
                <div className="iw-workspace-stat">
                  <strong>{annotations.length}</strong>
                  <span>DRAWINGS</span>
                </div>
              </div>

              <div className="iw-transfer-section">
                <div className="iw-section-label">TRANSFER</div>
                <div className="iw-transfer-buttons">
                  <button
                    className="iw-transfer-button"
                    disabled={pins.length === 0 && annotations.length === 0}
                    type="button"
                    onClick={handleExport}
                  >
                    <Download size={12} strokeWidth={1.9} />
                    Export
                  </button>
                  <button
                    className="iw-transfer-button"
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Upload size={12} strokeWidth={1.9} />
                    Import
                  </button>
                </div>
                {transferNote && <div className="iw-transfer-note">{transferNote}</div>}
                <input
                  ref={importInputRef}
                  accept=".geojson,.json,application/geo+json,application/json"
                  hidden
                  type="file"
                  onChange={handleImportFile}
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
