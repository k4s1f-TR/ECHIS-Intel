"use client";

import {
  Anchor,
  Building2,
  ChevronLeft,
  Eye,
  EyeOff,
  Factory,
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
  Warehouse,
  Waves,
} from "lucide-react";
import type { CSSProperties } from "react";
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

const PANEL_WIDTH = 318;

type Tool = "select" | "pin" | "line" | "area";
type Severity = "critical" | "high" | "medium" | "low";
type PinType = "naval" | "airdef" | "logistics" | "sigint" | "facility" | "incident";
type LngLat = [number, number];

type Layer = {
  id: string;
  name: string;
  hue: string;
  visible: boolean;
  locked: boolean;
  userCreated?: boolean;
};

type Pin = {
  id: string;
  lng: number;
  lat: number;
  type: PinType;
  severity: Severity;
  layer: string;
  title: string;
  source: string;
  updated: string;
  note: string;
  /** Analyst-placed pins are editable in the detail panel; seed pins are not. */
  userCreated?: boolean;
};

type Annotation = {
  id: string;
  kind: "line" | "area";
  layer: string;
  color: string;
  coordinates: LngLat[];
  /** Optional analyst label rendered next to the measurement on the map. */
  name?: string;
};

type Selection =
  | { type: "pin"; id: string }
  | { type: "annotation"; id: string }
  | null;

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  critical: { label: "KRİTİK", color: "#ff2b3d" },
  high: { label: "YÜKSEK", color: "#ff9533" },
  medium: { label: "ORTA", color: "#ffd23d" },
  low: { label: "DÜŞÜK", color: "#4fd1c5" },
};
const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const TYPE_META: Record<PinType, { label: string; Icon: LucideIcon }> = {
  naval: { label: "Deniz", Icon: Waves },
  airdef: { label: "Hava Sav.", Icon: Shield },
  logistics: { label: "Lojistik", Icon: Warehouse },
  sigint: { label: "SIGINT", Icon: Satellite },
  facility: { label: "Tesis", Icon: Factory },
  incident: { label: "Olay", Icon: Building2 },
};
const PIN_TYPE_ORDER: PinType[] = [
  "naval",
  "airdef",
  "logistics",
  "sigint",
  "facility",
  "incident",
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

const DEFAULT_LAYERS: Layer[] = [
  { id: "naval", name: "Deniz Faaliyeti", hue: "#4aa8ff", visible: true, locked: false },
  { id: "airdef", name: "Hava Savunma", hue: "#ff2b3d", visible: true, locked: false },
  { id: "logistics", name: "Lojistik & İkmal", hue: "#f5a623", visible: true, locked: false },
  { id: "cyber", name: "Siber / SIGINT", hue: "#b06bff", visible: true, locked: false },
  { id: "unrest", name: "Sivil Karışıklık", hue: "#ff5e7a", visible: true, locked: false },
  { id: "annot", name: "Çizimlerim", hue: "#c4ccd6", visible: true, locked: false },
];

const INITIAL_PINS: Pin[] = [
  {
    id: "pin-tartus",
    lng: 35.88,
    lat: 34.9,
    type: "naval",
    severity: "high",
    layer: "naval",
    title: "Tartus liman faaliyeti izleme notu",
    source: "Public maritime advisory / regional media",
    updated: "12 dk önce",
    note:
      "Açık kaynaklarda liman çevresindeki rota uyarıları ve diplomatik açıklamalarda yoğunlaşma izleniyor. Girdi, kamuya açık denizcilik duyuruları ve bölgesel haber kapsamından türetilmiştir.",
  },
  {
    id: "pin-kyiv",
    lng: 30.52,
    lat: 50.45,
    type: "airdef",
    severity: "critical",
    layer: "airdef",
    title: "Kiev hava savunma açıklamaları yoğunlaştı",
    source: "Official statements / open-source reporting",
    updated: "18 dk önce",
    note:
      "Kamuya açık açıklamalar ve medya raporlarında hava savunma kapasitesi, yardım paketleri ve sivil altyapı güvenliği başlıkları öne çıkıyor.",
  },
  {
    id: "pin-suez",
    lng: 32.55,
    lat: 29.97,
    type: "logistics",
    severity: "medium",
    layer: "logistics",
    title: "Süveyş geçiş akışı lojistik takibi",
    source: "Port authority notices / trade press",
    updated: "31 dk önce",
    note:
      "Açık liman duyuruları ve ticaret basını, geçiş programları ile sigorta yorumlarında sınırlı ama izlenebilir hareketlilik gösteriyor.",
  },
  {
    id: "pin-taipei",
    lng: 121.56,
    lat: 25.04,
    type: "sigint",
    severity: "high",
    layer: "cyber",
    title: "Tayvan çevresi kamu sinyal yoğunluğu",
    source: "Public cyber advisories / media monitoring",
    updated: "44 dk önce",
    note:
      "Kamuya açık siber uyarılar, medya izleme verileri ve resmi açıklamalarda bölgesel gerilimle ilişkili anma yoğunluğu artmış görünüyor.",
  },
  {
    id: "pin-ankara",
    lng: 32.86,
    lat: 39.93,
    type: "facility",
    severity: "medium",
    layer: "annot",
    title: "Ankara diplomatik temas merkezi",
    source: "Government calendar / regional media",
    updated: "1 sa önce",
    note:
      "Kamu takvimleri ve bölgesel medya, savunma, enerji ve sınır güvenliği başlıklarında yoğun diplomatik temaslara işaret ediyor.",
  },
  {
    id: "pin-bab",
    lng: 43.33,
    lat: 12.58,
    type: "incident",
    severity: "low",
    layer: "unrest",
    title: "Bab el-Mandeb denizcilik ihtiyat duyurusu",
    source: "Maritime advisory / public reporting",
    updated: "1 sa 24 dk önce",
    note:
      "Kamuya açık denizcilik uyarıları transit hatlarında ihtiyat tavsiyesi yayımladı; rota yönlendirmelerinde açık kaynaklı büyük değişiklik görülmüyor.",
  },
];

const PIN_DETAIL_OVERRIDES: Record<
  string,
  Partial<Pick<Pin, "title" | "updated" | "note">>
> = {
  "pin-tartus": {
    title: "Tartus port activity monitoring note",
    updated: "12 min ago",
    note:
      "Open-source maritime advisories and regional reporting indicate increased attention around routing, port activity, and diplomatic messaging near Tartus. The signal is derived from public notices and media coverage, not from closed-source collection. Current reporting supports continued monitoring but does not confirm a discrete operational incident.",
  },
  "pin-kyiv": {
    title: "Kyiv air-defense statements intensify",
    updated: "18 min ago",
    note:
      "Public statements and open-source reporting show sustained emphasis on air-defense capacity, partner assistance, and civilian infrastructure protection around Kyiv. The item reflects a convergence of official messaging and media references. It should be treated as a public-source threat context note rather than a confirmed tactical update.",
  },
  "pin-suez": {
    title: "Suez transit flow logistics watch",
    updated: "31 min ago",
    note:
      "Port authority notices and trade-press references point to measurable attention around transit scheduling, insurance commentary, and logistics continuity through Suez. The available public material does not indicate a confirmed disruption. It does justify tracking because small routing changes can have downstream commercial impact.",
  },
  "pin-taipei": {
    title: "Taiwan public signal density increase",
    updated: "44 min ago",
    note:
      "Public cyber advisories, media-monitoring references, and official statements show increased mention density connected to Taiwan-related regional tension. The signal is informational and should not be read as evidence of a specific intrusion campaign. It provides context for tracking cyber and strategic communications activity in the area.",
  },
  "pin-ankara": {
    title: "Ankara diplomatic contact hub",
    updated: "1 hr ago",
    note:
      "Government calendars and regional media references indicate elevated diplomatic engagement in Ankara across defense, energy, and border-security topics. The available sources describe scheduling and public messaging rather than a single crisis event. The marker is useful as a context anchor for monitoring follow-on statements and partner reactions.",
  },
  "pin-bab": {
    title: "Bab el-Mandeb maritime caution advisory",
    updated: "1 hr 24 min ago",
    note:
      "Public maritime advisories recommend caution for transit lanes around Bab el-Mandeb, while open reporting has not confirmed a major routing change. The note reflects a watch condition based on public safety guidance and shipping-sector commentary. Continued monitoring is warranted because advisory language can shift quickly if threat reporting changes.",
  },
};

const INITIAL_DISPLAY_PINS = INITIAL_PINS.map((pin) => ({
  ...pin,
  ...PIN_DETAIL_OVERRIDES[pin.id],
}));

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
      ? Math.round(value).toLocaleString("tr-TR")
      : value.toFixed(1).replace(".", ",");
  return `${text} ${unit}`;
}

function annotationMeasurement(annotation: Pick<Annotation, "kind" | "coordinates">) {
  return annotation.kind === "area"
    ? formatKm(polygonAreaKm2(annotation.coordinates), "km²")
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
 * Toggleable map data overlays shown in the left "VERİ KATMANLARI" panel.
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
  { id: "airbases", label: "Üsler", color: "#e0a82e", layerId: AIRBASES_LAYER, Icon: Plane },
  { id: "chokepoints", label: "Chokepoints", color: "#4fd1c5", layerId: CHOKEPOINTS_LAYER, Icon: Waves },
  { id: "ports", label: "Limanlar", color: "#4aa8ff", layerId: PORTS_LAYER, Icon: Anchor, defaultVisible: false },
  {
    id: "nuclear-facilities",
    label: "Nükleer Tesis",
    color: "#9cff6a",
    layerId: NUCLEAR_FACILITIES_LAYER,
    Icon: Radiation,
  },
];

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
    `<div class="iw-ab-title">${escapeHtml(p.name || "Hava Üssü")}</div>` +
    (sub ? `<div class="iw-ab-sub">${sub}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Kullanım", p.usage) +
    airbaseRow("Kuruluş", p.operating_organization) +
    (codes ? `<div class="iw-ab-row"><span>Kod</span><b>${codes}</b></div>` : "") +
    airbaseRow("Yıl", p.year_built) +
    airbaseRow("İrtifa", p.elevation) +
    airbaseRow("Pist", p.runways) +
    `</div>` +
    (p.url
      ? `<a class="iw-ab-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Kaynak ↗</a>`
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
    airbaseRow("Tür", "Maritime chokepoint") +
    airbaseRow("Bölge", p.region) +
    `</div>` +
    `</div>`
  );
}

function buildPortPopup(p: Record<string, unknown>) {
  const coords =
    p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : "";
  return (
    `<div class="iw-ab">` +
    `<div class="iw-ab-title">${escapeHtml(p.name || "Liman")}</div>` +
    (p.country ? `<div class="iw-ab-sub">${escapeHtml(p.country)}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Liman boyutu", p.harbor_size) +
    airbaseRow("Liman tipi", p.harbor_type) +
    airbaseRow("Barınak", p.shelter) +
    airbaseRow("Giriş limanı", p.port_of_entry) +
    airbaseRow("Koordinat", coords) +
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
    `<div class="iw-ab-title">${escapeHtml(p.name || "Nükleer Tesis")}</div>` +
    (sub ? `<div class="iw-ab-sub">${sub}</div>` : "") +
    `<div class="iw-ab-meta">` +
    airbaseRow("Sınıf", p.group_label) +
    airbaseRow("Kategori", p.category) +
    airbaseRow("İşlev", p.function) +
    airbaseRow("Koordinat", coords) +
    `</div>` +
    `</div>`
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
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [pins, setPins] = useState<Pin[]>(INITIAL_DISPLAY_PINS);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [activeLayer, setActiveLayer] = useState("annot");
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

  const layerMap = useMemo(() => {
    const map = new Map<string, Layer>();
    layers.forEach((layer) => map.set(layer.id, layer));
    return map;
  }, [layers]);

  const totalPins = pins.length;
  const criticalPins = pins.filter((pin) => pin.severity === "critical").length;

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

  const getWritableLayer = useCallback(() => {
    return (
      layers.find((layer) => layer.id === activeLayer && !layer.locked) ??
      layers.find((layer) => !layer.locked) ??
      null
    );
  }, [activeLayer, layers]);

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

    const layer = getWritableLayer();
    if (!layer) return;

    setActiveLayer(layer.id);
    setLayers((currentLayers) =>
      currentLayers.map((item) =>
        item.id === layer.id ? { ...item, visible: true } : item,
      ),
    );
    const nextAnnotation: Annotation = {
      id: makeId("annotation"),
      kind: tool,
      layer: layer.id,
      color: drawColor,
      coordinates: draft,
    };
    setAnnotations((current) => [...current, nextAnnotation]);
    setDraft([]);
    setTool("select");
    // Open the annotation in the detail panel so it can be named right away.
    setSelection({ type: "annotation", id: nextAnnotation.id });
  }, [draft, drawColor, getWritableLayer, tool]);

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
        const layer = getWritableLayer();
        if (!layer) return;
        const nextPin: Pin = {
          id: makeId("pin"),
          lng: coordinate[0],
          lat: coordinate[1],
          type: "facility",
          severity: "medium",
          layer: layer.id,
          title: `Yeni ${TYPE_META.facility.label} işareti`,
          source: "Analist girdisi",
          updated: "Şimdi",
          note: "Harita üzerine eklenen kullanıcı işareti. Başlık, tür, önem ve not alanları detay panelinden düzenlenebilir.",
          userCreated: true,
        };
        setActiveLayer(layer.id);
        setLayers((currentLayers) =>
          currentLayers.map((item) =>
            item.id === layer.id ? { ...item, visible: true } : item,
          ),
        );
        setPins((current) => [...current, nextPin]);
        // Open the new pin in the detail panel so it can be titled right away.
        setSelection({ type: "pin", id: nextPin.id });
        return;
      }

      if (tool === "line" || tool === "area") {
        setDraft((current) => [...current, coordinate]);
      }
    },
    [tool, getWritableLayer],
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

  function handleUndo() {
    if ((tool === "line" || tool === "area") && draft.length > 0) {
      setDraft((current) => current.slice(0, -1));
      return;
    }
    setAnnotations((current) => current.slice(0, -1));
  }

  function handleClear() {
    setDraft([]);
    setAnnotations([]);
    if (selection?.type === "annotation") setSelection(null);
  }

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
        pin.id === pinId ? { ...pin, ...patch, updated: "Şimdi" } : pin,
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
    setPins((current) => current.filter((pin) => pin.id !== pinId));
    setSelection(null);
  }

  function handleDeleteAnnotation(annotationId: string) {
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
      features: annotations
        .filter((annotation) => layerMap.get(annotation.layer)?.visible ?? true)
        .map((annotation) => ({
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
  }, [annotations, draft, layerMap, mapReady, selection]);

  // Analyst pins — severity-coloured circle layer with a selection ring.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const pinData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pins
        .filter((pin) => layerMap.get(pin.layer)?.visible ?? true)
        .map((pin) => ({
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
  }, [pins, layerMap, mapReady, selection]);

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

    annotations
      .filter((annotation) => layerMap.get(annotation.layer)?.visible ?? true)
      .forEach((annotation) => {
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
  }, [annotations, layerMap, mapReady]);

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

        .iw-topbar {
          position: absolute;
          inset: 0 0 auto 0;
          z-index: 30;
          height: 48px;
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(180px, 360px) minmax(250px, 1fr);
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          background: var(--iw-black);
          border-bottom: 1px solid var(--c-border-1);
        }

        .iw-top-left,
        .iw-top-right,
        .iw-brand,
        .iw-live-pill,
        .iw-analyst,
        .iw-clock,
        .iw-search {
          display: flex;
          align-items: center;
        }

        .iw-top-left {
          gap: 16px;
          min-width: 0;
        }

        .iw-brand {
          gap: 9px;
          flex: 0 0 auto;
        }

        .iw-logo {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: linear-gradient(150deg, #ff2b3d, #b3121f);
          box-shadow: 0 0 16px rgba(255, 43, 61, 0.45);
          color: var(--c-panel-bg);
        }

        .iw-wordmark {
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.16em;
          color: var(--c-t1);
        }

        .iw-divider {
          width: 1px;
          height: 18px;
          flex: 0 0 auto;
          background: var(--c-border-1);
        }

        .iw-kicker {
          overflow: hidden;
          color: var(--c-t4);
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .iw-live-pill {
          gap: 6px;
          padding: 3px 8px;
          border: 1px solid rgba(255, 43, 61, 0.30);
          border-radius: 5px;
          background: rgba(255, 43, 61, 0.08);
          color: #ff6470;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 0.14em;
          line-height: 1;
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
          justify-self: center;
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

        .iw-top-right {
          justify-content: flex-end;
          gap: 18px;
          min-width: 0;
        }

        .iw-clock {
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          min-width: 0;
        }

        .iw-clock strong {
          color: var(--c-t1);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1;
        }

        .iw-caption {
          color: var(--c-t5);
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 0.12em;
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .iw-analyst {
          gap: 9px;
          min-width: 0;
        }

        .iw-avatar {
          width: 26px;
          height: 26px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid var(--c-border-1);
          border-radius: 7px;
          background: var(--iw-black);
          color: #c4ccd6;
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 10.5px;
          font-weight: 600;
        }

        .iw-analyst strong {
          display: block;
          color: #c4ccd6;
          font-size: 10.5px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
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

        .iw-panel-header,
        .iw-panel-stats {
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

        .iw-panel-stats {
          gap: 5px;
        }

        .iw-stat-chip {
          display: grid;
          min-width: 40px;
          gap: 2px;
          padding: 4px 6px;
          border: 1px solid var(--c-border-2);
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
        }

        .iw-stat-chip strong {
          color: var(--c-t1);
          font-family: var(--iw-panel-font);
          font-size: 9.8px;
          font-weight: 700;
          line-height: 1;
        }

        .iw-stat-chip[data-critical="true"] strong {
          color: #ff2b3d;
        }

        .iw-stat-chip span {
          color: var(--c-t4);
          font-family: var(--iw-panel-font);
          font-size: 7.6px;
          font-weight: 700;
          letter-spacing: 0.08em;
          line-height: 1;
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

        .iw-panel-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
        }

        .iw-layers-body {
          padding: 9px 10px 13px;
        }

        .iw-data-layer-section {
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--c-border-2);
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

        .iw-hue {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          background: #ff2b3d;
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

        .iw-detail-title {
          margin: 9px 0 0;
          color: var(--c-t1);
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.25;
          text-wrap: pretty;
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

        .iw-note-card {
          padding: 9px;
          border: 1px solid var(--c-border-2);
          border-left: 2px solid var(--detail-color, #ff2b3d);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
          color: var(--c-t3);
          font-size: 9.6px;
          line-height: 1.55;
          white-space: pre-line;
        }

        .iw-layer-ref {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--c-t4);
          font-size: 9px;
        }

        .iw-layer-ref strong {
          color: var(--c-t2);
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

        @media (max-width: 1020px) {
          .iw-topbar {
            grid-template-columns: minmax(220px, 1fr) minmax(160px, 280px) auto;
          }
          .iw-clock .iw-caption,
          .iw-analyst div:not(.iw-avatar) {
            display: none;
          }
        }

        @media (max-width: 820px) {
          .iw-panel {
            width: 300px;
          }
          .iw-map-area {
            right: 300px;
          }
          .iw-topbar {
            grid-template-columns: 1fr auto;
          }
          .iw-topbar .iw-search {
            display: none;
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
          <div className="iw-rail-label">ARAÇ</div>
          <div className="iw-tool-stack">
            <ToolButton
              active={tool === "select"}
              icon={MousePointer2}
              label="Seç"
              onClick={() => setActiveTool("select")}
            />
            <ToolButton
              active={tool === "pin"}
              icon={MapPin}
              label="İşaret"
              onClick={() => setActiveTool("pin")}
            />
            <ToolButton
              active={tool === "line"}
              icon={Route}
              label="Çizgi"
              onClick={() => setActiveTool("line")}
            />
            <ToolButton
              active={tool === "area"}
              icon={Pentagon}
              label="Alan"
              onClick={() => setActiveTool("area")}
            />
            <div className="iw-tool-divider" />
            <ToolButton
              disabled={draft.length === 0 && annotations.length === 0}
              icon={Undo2}
              label="Geri Al"
              onClick={handleUndo}
            />
            <ToolButton
              disabled={draft.length === 0 && annotations.length === 0}
              icon={Trash2}
              label="Temizle"
              onClick={handleClear}
            />
          </div>
        </aside>

        </div>

        {(tool === "line" || tool === "area") && (
          <div className="iw-glass iw-tool-config" role="toolbar" aria-label="Çizim ayarları">
            <div className="iw-config-row">
              <span className="iw-config-label">RENK</span>
              <div className="iw-swatch-row">
                {DRAW_PALETTE.map((color) => (
                  <button
                    key={color}
                    aria-label={`Çizim rengi ${color}`}
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
                ? "Noktaları tıklayın · bitirmek için çift tıklayın · Esc iptal"
                : "Köşeleri tıklayın · 3+ nokta · bitirmek için çift tıklayın · Esc iptal"}
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
          <div className="iw-panel-title">DURUM PANELİ</div>
          <div className="iw-panel-stats">
            <div className="iw-stat-chip">
              <strong>{totalPins}</strong>
              <span>OLAY</span>
            </div>
            <div className="iw-stat-chip" data-critical="true">
              <strong>{criticalPins}</strong>
              <span>KRİTİK</span>
            </div>
          </div>
        </div>

        <label className="iw-search iw-panel-search">
          <Search size={14} strokeWidth={1.8} />
          <input
            value={searchQuery}
            placeholder="İçerik ara…"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        <div className="iw-panel-mode-title">
          {hasSelection ? (
            <Info size={10} strokeWidth={1.8} />
          ) : (
            <Layers size={10} strokeWidth={1.8} />
          )}
          {hasSelection ? "DETAY" : "KATMANLAR"}
        </div>

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
                  KATMANLAR
                </button>

                {selectedPin.userCreated ? (
                  <>
                    <div className="iw-detail-section" style={{ marginTop: 0 }}>
                      <div className="iw-detail-label">TÜR</div>
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
                      <div className="iw-detail-label">BAŞLIK</div>
                      <input
                        className="iw-edit-input"
                        value={selectedPin.title}
                        onChange={(event) =>
                          updatePin(selectedPin.id, { title: event.target.value })
                        }
                      />
                    </div>

                    <div className="iw-detail-section">
                      <div className="iw-detail-label">ÖNEM</div>
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
                      <div className="iw-detail-label">NOT</div>
                      <textarea
                        className="iw-edit-textarea"
                        value={selectedPin.note}
                        onChange={(event) =>
                          updatePin(selectedPin.id, { note: event.target.value })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="iw-type-chip">
                      {(() => {
                        const meta = TYPE_META[selectedPin.type];
                        return (
                          <>
                            <meta.Icon size={11} strokeWidth={2.2} />
                            {meta.label}
                          </>
                        );
                      })()}
                      <b style={{ color: SEVERITY_META[selectedPin.severity].color }}>
                        {SEVERITY_META[selectedPin.severity].label}
                      </b>
                    </div>
                    <h2 className="iw-detail-title">{selectedPin.title}</h2>
                    <div className="iw-detail-section">
                      <div className="iw-meta-row">
                        <div className="iw-detail-label" style={{ marginBottom: 0 }}>
                          SON GÜNCELLEME
                        </div>
                        <span>{selectedPin.updated}</span>
                      </div>
                    </div>
                    <div className="iw-detail-section">
                      <div className="iw-detail-label">DURUM NOTU</div>
                      <div className="iw-note-card">{selectedPin.note}</div>
                    </div>
                  </>
                )}

                <div className="iw-detail-section">
                  <div className="iw-meta-row">
                    <div className="iw-detail-label" style={{ marginBottom: 0 }}>
                      KONUM
                    </div>
                    <span className="iw-detail-coord">
                      {formatCoordinate(selectedPin.lat, selectedPin.lng)}
                    </span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">KAYNAK</div>
                  <div className="iw-source-row">
                    <Globe2 size={13} strokeWidth={1.8} />
                    <span>{selectedPin.source}</span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-layer-ref">
                    <span
                      className="iw-hue"
                      style={
                        {
                          background:
                            layerMap.get(selectedPin.layer)?.hue ?? "#c4ccd6",
                        } as CSSProperties
                      }
                    />
                    <span>
                      Katman:{" "}
                      <strong>
                        {layerMap.get(selectedPin.layer)?.name ?? "Bilinmeyen"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="iw-detail-actions">
                  <button
                    className="iw-primary-action"
                    type="button"
                    onClick={handleFocusSelection}
                  >
                    Odakla
                  </button>
                  <button
                    aria-label="İşareti sil"
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
                  KATMANLAR
                </button>

                <div className="iw-type-chip">
                  {selectedAnnotation.kind === "area" ? (
                    <Pentagon size={11} strokeWidth={2.2} />
                  ) : (
                    <Route size={11} strokeWidth={2.2} />
                  )}
                  {selectedAnnotation.kind === "area" ? "Alan" : "Çizgi"}
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">İSİM ETİKETİ</div>
                  <input
                    className="iw-edit-input"
                    placeholder="örn. Tatbikat sahası"
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
                      {selectedAnnotation.kind === "area" ? "YÜZÖLÇÜMÜ" : "UZUNLUK"}
                    </div>
                    <span>{annotationMeasurement(selectedAnnotation)}</span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">RENK</div>
                  <div className="iw-swatch-row">
                    {DRAW_PALETTE.map((color) => (
                      <button
                        key={color}
                        aria-label={`Çizim rengi ${color}`}
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

                <div className="iw-detail-section">
                  <div className="iw-layer-ref">
                    <span
                      className="iw-hue"
                      style={
                        {
                          background:
                            layerMap.get(selectedAnnotation.layer)?.hue ?? "#c4ccd6",
                        } as CSSProperties
                      }
                    />
                    <span>
                      Katman:{" "}
                      <strong>
                        {layerMap.get(selectedAnnotation.layer)?.name ?? "Bilinmeyen"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="iw-detail-actions">
                  <button
                    className="iw-primary-action"
                    type="button"
                    onClick={handleFocusSelection}
                  >
                    Odakla
                  </button>
                  <button
                    aria-label="Çizimi sil"
                    className="iw-delete-action"
                    type="button"
                    onClick={() => handleDeleteAnnotation(selectedAnnotation.id)}
                  >
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="iw-layers-body">
              <div className="iw-data-layer-section">
                <div className="iw-section-label">VERİ KATMANLARI</div>
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
                            {isVisible ? "Gösteriliyor" : "Gizli"}
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
          )}
        </div>
      </aside>
    </section>
  );
}
