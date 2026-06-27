"use client";

import {
  Building2,
  Eye,
  EyeOff,
  Factory,
  Globe2,
  Info,
  Layers,
  Lock,
  MapPin,
  Minus,
  MousePointer2,
  Pentagon,
  Plus,
  Route,
  Satellite,
  Search,
  Shield,
  Target,
  Trash2,
  Undo2,
  Unlock,
  Warehouse,
  Waves,
} from "lucide-react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ECHIS_VIEW,
  addGraticule,
  buildEchisCommandStyle,
} from "./echisCommandBasemap";

const PANEL_WIDTH = 318;

type Tool = "select" | "pin" | "line" | "area";
type Tab = "layers" | "detail";
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
};

type Annotation = {
  id: string;
  kind: "line" | "area";
  layer: string;
  color: string;
  coordinates: LngLat[];
};

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  critical: { label: "KRİTİK", color: "#ff2b3d" },
  high: { label: "YÜKSEK", color: "#ff9533" },
  medium: { label: "ORTA", color: "#ffd23d" },
  low: { label: "DÜŞÜK", color: "#4fd1c5" },
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const TYPE_META: Record<PinType, { label: string; Icon: LucideIcon }> = {
  naval: { label: "Deniz", Icon: Waves },
  airdef: { label: "Hava Savunma", Icon: Shield },
  logistics: { label: "Lojistik", Icon: Warehouse },
  sigint: { label: "SIGINT", Icon: Satellite },
  facility: { label: "Tesis", Icon: Factory },
  incident: { label: "Olay", Icon: Building2 },
};

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

const ECHIS_MARKER_PULSE_CSS = `
@keyframes iwEchisPulse {
  0%   { transform: scale(0.45); opacity: 0.55; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}`;

/**
 * Build the HTML element for an event pin — a pulsing ring + solid core,
 * coloured by its layer hue (colour = data, per the basemap brief).
 */
function createEventMarkerElement(color: string) {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:14px;height:14px;cursor:pointer";
  const ring = document.createElement("div");
  ring.style.cssText =
    "position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;" +
    `border-radius:50%;background:${color};animation:iwEchisPulse 2.6s ease-out infinite`;
  const core = document.createElement("div");
  core.style.cssText =
    "position:relative;width:14px;height:14px;border-radius:50%;" +
    `background:${color};box-shadow:0 0 0 3px ${color}33, 0 0 10px ${color}88;` +
    "border:1.5px solid rgba(255,255,255,0.85)";
  el.append(ring, core);
  return el;
}

function safeLayerCount(counts: Record<string, number>, id: string) {
  return counts[id] ?? 0;
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

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      aria-label={label}
      className="iw-icon-button"
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MarkerGlyph({ type }: { type: PinType }) {
  const Icon = TYPE_META[type].Icon;
  return <Icon size={12} strokeWidth={2.2} />;
}

export function IntelWatchMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, MapLibreMarker>());
  const [mapReady, setMapReady] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [tab, setTab] = useState<Tab>("layers");
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [pins, setPins] = useState<Pin[]>(INITIAL_PINS);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState("annot");
  const [filters, setFilters] = useState<Record<Severity, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(ECHIS_VIEW.zoom);
  const [cursorCoordinate, setCursorCoordinate] = useState<LngLat>(ECHIS_VIEW.center);

  const layerMap = useMemo(() => {
    const map = new Map<string, Layer>();
    layers.forEach((layer) => map.set(layer.id, layer));
    return map;
  }, [layers]);

  const selectedPin = useMemo(
    () => pins.find((pin) => pin.id === selectedPinId) ?? null,
    [pins, selectedPinId],
  );

  const activeLayerData = useMemo(
    () => layers.find((layer) => layer.id === activeLayer) ?? layers.find((layer) => !layer.locked) ?? layers[0],
    [activeLayer, layers],
  );

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    layers.forEach((layer) => {
      counts[layer.id] = 0;
    });
    pins.forEach((pin) => {
      counts[pin.layer] = (counts[pin.layer] ?? 0) + 1;
    });
    annotations.forEach((annotation) => {
      counts[annotation.layer] = (counts[annotation.layer] ?? 0) + 1;
    });
    return counts;
  }, [annotations, layers, pins]);

  const totalPins = pins.length;
  const criticalPins = pins.filter((pin) => pin.severity === "critical").length;

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
    map.on("zoom", () => setZoom(map.getZoom()));
    map.on("mousemove", (event) =>
      setCursorCoordinate([event.lngLat.lng, event.lngLat.lat]),
    );

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const markers = markersRef.current;
    return () => {
      resizeObserver.disconnect();
      markers.forEach((marker) => marker.remove());
      markers.clear();
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
    setAnnotations((current) => [
      ...current,
      {
        id: makeId("annotation"),
        kind: tool,
        layer: layer.id,
        color: layer.hue,
        coordinates: draft,
      },
    ]);
    setDraft([]);
    setTool("select");
  }, [draft, getWritableLayer, tool]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (event.key === "Escape" && (tool === "line" || tool === "area")) {
        event.preventDefault();
        cancelDraft();
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
          title: "Yeni İşaret",
          source: "Analist girdisi",
          updated: "Şimdi",
          note: "Harita üzerine eklenen kullanıcı işareti. Kaynak ve not alanları detay panelinden izlenebilir.",
        };
        setActiveLayer(layer.id);
        setLayers((currentLayers) =>
          currentLayers.map((item) =>
            item.id === layer.id ? { ...item, visible: true } : item,
          ),
        );
        setPins((current) => [...current, nextPin]);
        setSelectedPinId(nextPin.id);
        setTab("detail");
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
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (tool === "line" || tool === "area") map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = toolCursor(tool);
  }, [tool, mapReady]);

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
  }

  function handleCreateLayer() {
    const createdCount = layers.filter((layer) => layer.userCreated).length + 1;
    const hues = ["#7dd3fc", "#9cff6a", "#ff7ad9", "#f2d36b"];
    const nextLayer: Layer = {
      id: makeId("layer"),
      name: `Yeni Katman ${createdCount}`,
      hue: hues[(createdCount - 1) % hues.length],
      visible: true,
      locked: false,
      userCreated: true,
    };
    setLayers((current) => [...current, nextLayer]);
    setActiveLayer(nextLayer.id);
  }

  function handleSetActiveLayer(layer: Layer) {
    if (layer.locked) return;
    setActiveLayer(layer.id);
  }

  function handleToggleLayerVisible(layerId: string) {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }

  function handleToggleLayerLocked(layerId: string) {
    setLayers((current) => {
      const toggled = current.map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer,
      );
      const lockedActive = toggled.find((layer) => layer.id === activeLayer)?.locked;
      if (lockedActive) {
        const nextActive = toggled.find((layer) => !layer.locked);
        if (nextActive) setActiveLayer(nextActive.id);
      }
      return toggled;
    });
  }

  function handleDeleteLayer(layerId: string) {
    setLayers((current) => {
      const nextLayers = current.filter((layer) => layer.id !== layerId);
      if (activeLayer === layerId) {
        const nextActive = nextLayers.find((layer) => !layer.locked) ?? nextLayers[0];
        if (nextActive) setActiveLayer(nextActive.id);
      }
      return nextLayers;
    });
    setPins((current) => current.filter((pin) => pin.layer !== layerId));
    setAnnotations((current) => current.filter((annotation) => annotation.layer !== layerId));
    if (selectedPin?.layer === layerId) setSelectedPinId(null);
  }

  function handleToggleSeverity(severity: Severity) {
    setFilters((current) => ({ ...current, [severity]: !current[severity] }));
  }

  function handleFocusPin(pin: Pin) {
    setSelectedPinId(pin.id);
    mapRef.current?.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(mapRef.current.getZoom(), 6.5),
      duration: 900,
    });
  }

  function handleDeletePin(pinId: string) {
    setPins((current) => current.filter((pin) => pin.id !== pinId));
    setSelectedPinId(null);
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

  // Sync event pins to MapLibre HTML markers (visible layers + severity filter).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    pins.forEach((pin) => {
      const layer = layerMap.get(pin.layer);
      const visible = (layer?.visible ?? true) && filters[pin.severity];
      if (!visible) return;
      seen.add(pin.id);

      const existing = markers.get(pin.id);
      if (existing) {
        existing.setLngLat([pin.lng, pin.lat]);
        return;
      }

      const element = createEventMarkerElement(layer?.hue ?? "#c4ccd6");
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedPinId(pin.id);
        setTab("detail");
      });
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      markers.set(pin.id, marker);
    });

    markers.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    });
  }, [pins, layerMap, filters, mapReady]);

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
          properties: { color: annotation.color },
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
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "iw-annotations-line",
        type: "line",
        source: "iw-annotations",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.9,
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
  }, [annotations, draft, layerMap, mapReady]);

  const mapReadout = formatCoordinate(cursorCoordinate[1], cursorCoordinate[0]);

  return (
    <section className="iw-shell" aria-label="ECHIS Intel Watch workbench">
      <style>{`
        .iw-shell {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
          background: #060305;
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
          background: linear-gradient(180deg, #08070c, #05040980);
          border-bottom: 1px solid rgba(158, 167, 184, 0.10);
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
          color: #050406;
        }

        .iw-wordmark {
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.16em;
          color: #eef1f5;
        }

        .iw-divider {
          width: 1px;
          height: 18px;
          flex: 0 0 auto;
          background: rgba(158, 167, 184, 0.16);
        }

        .iw-kicker {
          overflow: hidden;
          color: #8b95a3;
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
          color: #5b6471;
          pointer-events: none;
        }

        .iw-search input {
          width: 100%;
          height: 30px;
          padding: 0 12px 0 34px;
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 8px;
          outline: none;
          background: rgba(255, 255, 255, 0.03);
          color: #eef1f5;
          font-size: 11.5px;
          transition: background 140ms ease, border-color 140ms ease;
        }

        .iw-search input::placeholder {
          color: #4a525d;
        }

        .iw-search input:focus {
          border-color: rgba(255, 43, 61, 0.45);
          background: rgba(255, 43, 61, 0.04);
        }

        .iw-panel-search {
          width: auto;
          max-width: none;
          height: 29px;
          margin: 9px 12px 8px;
          flex: 0 0 auto;
          justify-self: stretch;
        }

        .iw-panel-search input {
          height: 29px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.025);
          font-size: 10.5px;
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
          color: #eef1f5;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1;
        }

        .iw-caption {
          color: #5b6471;
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
          border: 1px solid rgba(158, 167, 184, 0.14);
          border-radius: 7px;
          background: linear-gradient(150deg, #141319, #1e1d28);
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
          background: #030203;
        }

        .iw-map-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: #13161b;
        }

        .iw-map-canvas .maplibregl-canvas {
          outline: none;
        }

        .iw-glass {
          border: 1px solid rgba(158, 167, 184, 0.12);
          background: rgba(8, 8, 12, 0.78);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(14px);
        }

        .iw-tool-rail {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 20;
          width: 56px;
          border-radius: 13px;
          padding: 9px 8px 10px;
        }

        .iw-rail-label,
        .iw-section-label {
          color: #5b6471;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
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
          color: #8b95a3;
          font-size: 7.8px;
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
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 9px;
          background: rgba(13, 13, 18, 0.5);
          color: #8b95a3;
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
          box-shadow: 0 0 16px rgba(255, 43, 61, 0.30);
        }

        .iw-tool-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .iw-tool-divider {
          width: 36px;
          height: 1px;
          background: rgba(158, 167, 184, 0.12);
        }

        .iw-draw-hint {
          position: absolute;
          top: 18px;
          left: 50%;
          z-index: 21;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          color: #c4ccd6;
          font-size: 11px;
          transform: translateX(-50%);
          white-space: nowrap;
        }

        .iw-legend {
          position: absolute;
          left: 16px;
          bottom: 16px;
          z-index: 20;
          width: 194px;
          border-radius: 11px;
          padding: 9px;
          background: rgba(8, 8, 12, 0.70);
          box-shadow: 0 12px 34px rgba(0,0,0,0.48);
          backdrop-filter: blur(12px);
        }

        .iw-legend-head,
        .iw-panel-header,
        .iw-panel-stats,
        .iw-layer-top,
        .iw-detail-actions,
        .iw-meta-row,
        .iw-source-row,
        .iw-layer-ref {
          display: flex;
          align-items: center;
        }

        .iw-legend-head {
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .iw-legend-title {
          color: #8b95a3;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 7.8px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .iw-zoom-readout {
          color: #5b6471;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 7.8px;
        }

        .iw-legend-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 7px;
        }

        .iw-legend-item {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 5px;
          color: #8b95a3;
          font-size: 8.8px;
        }

        .iw-type-chip-icon {
          width: 15px;
          height: 15px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.04);
          color: #c4ccd6;
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
          color: #8b95a3;
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
          border-bottom: 1px solid rgba(158, 167, 184, 0.10);
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
          border: 1px solid rgba(158, 167, 184, 0.12);
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
          border-left: 1px solid rgba(158, 167, 184, 0.10);
          background: linear-gradient(180deg, #08070c, #050407);
        }

        .iw-panel-header {
          justify-content: space-between;
          flex: 0 0 auto;
          gap: 8px;
          padding: 9px 12px 8px;
          border-bottom: 1px solid rgba(158, 167, 184, 0.08);
        }

        .iw-panel-title {
          color: #eef1f5;
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 11.5px;
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
          border: 1px solid rgba(158, 167, 184, 0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
        }

        .iw-stat-chip strong {
          color: #eef1f5;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 10.5px;
          font-weight: 700;
          line-height: 1;
        }

        .iw-stat-chip[data-critical="true"] strong {
          color: #ff2b3d;
        }

        .iw-stat-chip span {
          color: #5b6471;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 7.4px;
          font-weight: 700;
          letter-spacing: 0.10em;
          line-height: 1;
        }

        .iw-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          flex: 0 0 auto;
          height: 36px;
          border-bottom: 1px solid rgba(158, 167, 184, 0.08);
        }

        .iw-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #5b6471;
          cursor: pointer;
          font-size: 9.3px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          transition: color 140ms ease, border-color 140ms ease;
        }

        .iw-tab[aria-selected="true"] {
          border-bottom-color: #ff2b3d;
          color: #eef1f5;
        }

        .iw-panel-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
        }

        .iw-layers-body {
          padding: 12px 12px 16px;
        }

        .iw-layer-top {
          justify-content: space-between;
          gap: 12px;
        }

        .iw-new-layer {
          flex: 0 0 auto;
          padding: 3px 8px;
          border: 1px solid rgba(255, 43, 61, 0.25);
          border-radius: 7px;
          background: rgba(255, 43, 61, 0.08);
          color: #ff6470;
          cursor: pointer;
          font-size: 8.8px;
          font-weight: 700;
          transition: background 140ms ease;
        }

        .iw-new-layer:hover {
          background: rgba(255, 43, 61, 0.16);
        }

        .iw-caption-copy {
          margin: 8px 0 10px;
          color: #5b6471;
          font-size: 9.4px;
          line-height: 1.4;
        }

        .iw-layer-list {
          display: grid;
          gap: 5px;
        }

        .iw-layer-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 6px;
          padding: 7px 7px 7px 9px;
          border: 1px solid rgba(158, 167, 184, 0.06);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.012);
        }

        .iw-layer-row[data-active="true"] {
          border-color: rgba(255, 43, 61, 0.38);
          background: rgba(255, 43, 61, 0.07);
        }

        .iw-layer-main {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 9px;
          min-width: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          padding: 0;
          text-align: left;
        }

        .iw-layer-main:disabled {
          cursor: default;
        }

        .iw-hue {
          width: 9px;
          height: 9px;
          border-radius: 2px;
          background: var(--layer-hue);
          box-shadow: 0 0 8px var(--layer-hue);
        }

        .iw-layer-row[data-visible="false"] .iw-hue {
          opacity: 0.28;
        }

        .iw-layer-name {
          overflow: hidden;
          color: #c4ccd6;
          font-size: 10.8px;
          font-weight: 500;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .iw-layer-row[data-visible="false"] .iw-layer-name {
          color: #5b6471;
        }

        .iw-layer-meta {
          margin-top: 4px;
          color: #5b6471;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8px;
          line-height: 1;
        }

        .iw-layer-meta[data-active="true"] {
          color: #ff6470;
        }

        .iw-layer-meta[data-locked="true"] {
          color: #9a8060;
        }

        .iw-layer-actions {
          display: flex;
          gap: 3px;
        }

        .iw-icon-button {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #5b6471;
          cursor: pointer;
          transition: background 140ms ease, color 140ms ease;
        }

        .iw-icon-button:hover {
          background: rgba(255,255,255,0.04);
          color: #c4ccd6;
        }

        .iw-severity-section {
          margin-top: 18px;
        }

        .iw-severity-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 8px;
        }

        .iw-severity-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 7px;
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.02);
          color: #5b6471;
          cursor: pointer;
          font-size: 8.6px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        .iw-severity-chip[data-active="true"] {
          border-color: color-mix(in srgb, var(--severity-color) 40%, transparent);
          background: color-mix(in srgb, var(--severity-color) 10%, transparent);
          color: #eef1f5;
        }

        .iw-severity-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--severity-color);
        }

        .iw-help-card {
          display: grid;
          gap: 7px;
          margin-top: 18px;
          padding: 10px;
          border: 1px solid rgba(158, 167, 184, 0.08);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
        }

        .iw-help-card p {
          margin: 0;
          color: #8b95a3;
          font-size: 9.6px;
          line-height: 1.42;
        }

        .iw-help-card b {
          color: #ff6470;
        }

        .iw-detail-strip {
          height: 3px;
          background: linear-gradient(90deg, var(--severity-color), transparent);
        }

        .iw-detail-body {
          padding: 12px 12px 16px;
        }

        .iw-type-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px;
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          color: #8b95a3;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8.5px;
        }

        .iw-detail-title {
          margin: 12px 0 8px;
          color: #eef1f5;
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.25;
          text-wrap: pretty;
        }

        .iw-detail-coord {
          color: #8b95a3;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 10px;
        }

        .iw-detail-section {
          margin-top: 18px;
        }

        .iw-detail-label {
          margin-bottom: 8px;
          color: #5b6471;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .iw-meta-row {
          justify-content: space-between;
          gap: 12px;
          padding: 11px 12px;
          border: 1px solid rgba(158, 167, 184, 0.08);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
        }

        .iw-meta-row span {
          color: #c4ccd6;
          font-size: 10.2px;
          font-weight: 600;
        }

        .iw-note-card {
          padding: 12px;
          border: 1px solid rgba(158, 167, 184, 0.08);
          border-left: 2px solid var(--severity-color);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
          color: #a9b2bd;
          font-size: 10.8px;
          line-height: 1.5;
        }

        .iw-layer-ref {
          gap: 7px;
          color: #8b95a3;
          font-size: 11px;
        }

        .iw-layer-ref strong {
          color: #c4ccd6;
          font-weight: 600;
        }

        .iw-source-row {
          gap: 9px;
          min-height: 34px;
          padding: 9px 10px;
          border: 1px solid rgba(158, 167, 184, 0.08);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.02);
          color: #a9b2bd;
          font-family: var(--font-mono), "JetBrains Mono", monospace;
          font-size: 10.5px;
          line-height: 1.35;
        }

        .iw-detail-actions {
          gap: 9px;
          margin-top: 20px;
        }

        .iw-primary-action {
          height: 36px;
          flex: 1 1 auto;
          border: 0;
          border-radius: 9px;
          background: linear-gradient(180deg, #ff2b3d, #b3121f);
          box-shadow: 0 4px 16px rgba(255, 43, 61, 0.30);
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          transition: filter 140ms ease;
        }

        .iw-primary-action:hover {
          filter: brightness(1.08);
        }

        .iw-delete-action {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 9px;
          background: rgba(255,255,255,0.02);
          color: #8b95a3;
          cursor: pointer;
          transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
        }

        .iw-delete-action:hover {
          border-color: rgba(255, 43, 61, 0.32);
          background: rgba(255, 43, 61, 0.08);
          color: #ff6470;
        }

        .iw-empty-detail {
          min-height: 360px;
          display: grid;
          place-items: center;
          padding: 24px;
          text-align: center;
        }

        .iw-empty-tile {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          margin: 0 auto 12px;
          border: 1px solid rgba(158, 167, 184, 0.12);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.03);
          color: #5b6471;
        }

        .iw-empty-detail strong {
          display: block;
          color: #8b95a3;
          font-family: var(--font-display), "Space Grotesk", sans-serif;
          font-size: 12.5px;
          font-weight: 600;
        }

        .iw-empty-detail p {
          max-width: 240px;
          margin: 7px auto 0;
          color: #5b6471;
          font-size: 11px;
          line-height: 1.45;
        }

        @keyframes iw-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.28; }
        }
        ${ECHIS_MARKER_PULSE_CSS}

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

        {(tool === "line" || tool === "area") && (
          <div className="iw-glass iw-draw-hint">
            <span className="iw-dot" aria-hidden="true" />
            {tool === "line"
              ? "Noktaları tıklayın · bitirmek için çift tıklayın · Esc iptal"
              : "Köşeleri tıklayın · 3+ nokta · bitirmek için çift tıklayın · Esc iptal"}
          </div>
        )}

        <aside className="iw-glass iw-legend" aria-label="Map legend">
          <div className="iw-legend-head">
            <div className="iw-legend-title">GÖSTERGE · TÜR</div>
            <div className="iw-zoom-readout">Z {zoom.toFixed(1)}</div>
          </div>
          <div className="iw-legend-grid">
            {(Object.keys(TYPE_META) as PinType[]).map((type) => {
              const Icon = TYPE_META[type].Icon;
              return (
                <div className="iw-legend-item" key={type}>
                  <span className="iw-type-chip-icon">
                    <Icon size={12} strokeWidth={2} />
                  </span>
                  <span>{TYPE_META[type].label}</span>
                </div>
              );
            })}
          </div>
        </aside>

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

        <div className="iw-tabs" role="tablist">
          <button
            aria-selected={tab === "layers"}
            className="iw-tab"
            role="tab"
            type="button"
            onClick={() => setTab("layers")}
          >
            <Layers size={14} strokeWidth={1.8} />
            KATMANLAR
          </button>
          <button
            aria-selected={tab === "detail"}
            className="iw-tab"
            role="tab"
            type="button"
            onClick={() => setTab("detail")}
          >
            <Info size={14} strokeWidth={1.8} />
            DETAY
          </button>
        </div>

        <div className="iw-panel-body intel-watch-scrollbar tm-scrollbar">
          {tab === "layers" ? (
            <div className="iw-layers-body">
              <div className="iw-layer-top">
                <div className="iw-section-label">TAKİP KATMANLARI</div>
                <button className="iw-new-layer" type="button" onClick={handleCreateLayer}>
                  + YENİ
                </button>
              </div>
              <div className="iw-caption-copy">
                Bir katmana tıklayarak aktif hedef yapın - yeni işaret ve çizimler oraya eklenir.
              </div>

              <div className="iw-layer-list">
                {layers.map((layer) => {
                  const count = safeLayerCount(layerCounts, layer.id);
                  const isActive = activeLayerData?.id === layer.id;
                  return (
                    <div
                      key={layer.id}
                      className="iw-layer-row"
                      data-active={isActive}
                      data-visible={layer.visible}
                      style={{ "--layer-hue": layer.hue } as CSSProperties}
                    >
                      <button
                        className="iw-layer-main"
                        disabled={layer.locked}
                        type="button"
                        onClick={() => handleSetActiveLayer(layer)}
                      >
                        <span className="iw-hue" />
                        <span style={{ minWidth: 0 }}>
                          <span className="iw-layer-name">{layer.name}</span>
                          <span
                            className="iw-layer-meta"
                            data-active={isActive && !layer.locked}
                            data-locked={layer.locked}
                          >
                            {layer.locked
                              ? `Kilitli · ${count} öğe`
                              : isActive
                                ? "● AKTİF HEDEF"
                                : `${count} öğe`}
                          </span>
                        </span>
                      </button>

                      <div className="iw-layer-actions">
                        <IconButton
                          label={layer.locked ? "Kilidi aç" : "Kilitle"}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleLayerLocked(layer.id);
                          }}
                        >
                          {layer.locked ? (
                            <Lock size={14} color="#ff6470" strokeWidth={1.8} />
                          ) : (
                            <Unlock size={14} strokeWidth={1.8} />
                          )}
                        </IconButton>
                        <IconButton
                          label={layer.visible ? "Gizle" : "Göster"}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleLayerVisible(layer.id);
                          }}
                        >
                          {layer.visible ? (
                            <Eye size={14} color={layer.hue} strokeWidth={1.8} />
                          ) : (
                            <EyeOff size={14} color="#444b55" strokeWidth={1.8} />
                          )}
                        </IconButton>
                        {layer.userCreated && (
                          <IconButton
                            label="Katmanı sil"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteLayer(layer.id);
                            }}
                          >
                            <Trash2 size={14} color="#5e5566" strokeWidth={1.8} />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="iw-severity-section">
                <div className="iw-section-label">ÖNEM FİLTRESİ</div>
                <div className="iw-severity-chips">
                  {SEVERITY_ORDER.map((severity) => (
                    <button
                      key={severity}
                      className="iw-severity-chip"
                      data-active={filters[severity]}
                      style={{ "--severity-color": SEVERITY_META[severity].color } as CSSProperties}
                      type="button"
                      onClick={() => handleToggleSeverity(severity)}
                    >
                      <span className="iw-severity-dot" />
                      {SEVERITY_META[severity].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="iw-help-card">
                <p>
                  <b>›</b> İşaret aracı ile haritaya yeni takip noktası ekleyin.
                </p>
                <p>
                  <b>›</b> Çizgi ve alan araçlarında çift tıklama çizimi tamamlar.
                </p>
                <p>
                  <b>›</b> Kilitli katmanlardaki işaretler seçilemez.
                </p>
                <p>
                  <b>›</b> Arama, görünür işaretleri başlık, tür ve kaynakla filtreler.
                </p>
              </div>
            </div>
          ) : selectedPin ? (
            <div style={{ "--severity-color": SEVERITY_META[selectedPin.severity].color } as CSSProperties}>
              <div className="iw-detail-strip" />
              <div className="iw-detail-body">
                <div className="iw-type-chip">
                  <MarkerGlyph type={selectedPin.type} />
                  {TYPE_META[selectedPin.type].label}
                </div>
                <h2 className="iw-detail-title">{selectedPin.title}</h2>
                <div className="iw-detail-coord">{formatCoordinate(selectedPin.lat, selectedPin.lng)}</div>

                <div className="iw-detail-section">
                  <div className="iw-meta-row">
                    <div className="iw-detail-label" style={{ marginBottom: 0 }}>
                      SON GÜNCELLEME
                    </div>
                    <span>{selectedPin.updated}</span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">ANALİST NOTU</div>
                  <div className="iw-note-card">{selectedPin.note}</div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-layer-ref">
                    <span
                      className="iw-hue"
                      style={
                        {
                          "--layer-hue": layerMap.get(selectedPin.layer)?.hue ?? "#c4ccd6",
                        } as CSSProperties
                      }
                    />
                    <span>
                      Katman: <strong>{layerMap.get(selectedPin.layer)?.name ?? "Bilinmeyen"}</strong>
                    </span>
                  </div>
                </div>

                <div className="iw-detail-section">
                  <div className="iw-detail-label">KAYNAK</div>
                  <div className="iw-source-row">
                    <Globe2 size={14} strokeWidth={1.8} />
                    <span>{selectedPin.source}</span>
                  </div>
                </div>

                <div className="iw-detail-actions">
                  <button
                    className="iw-primary-action"
                    type="button"
                    onClick={() => handleFocusPin(selectedPin)}
                  >
                    Odakla
                  </button>
                  <button
                    aria-label="İşareti sil"
                    className="iw-delete-action"
                    type="button"
                    onClick={() => handleDeletePin(selectedPin.id)}
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="iw-empty-detail">
              <div>
                <div className="iw-empty-tile">
                  <MapPin size={20} strokeWidth={1.7} />
                </div>
                <strong>İşaret seçilmedi</strong>
                <p>Haritadaki görünür bir işareti seçerek açık kaynak detaylarını görüntüleyin.</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
