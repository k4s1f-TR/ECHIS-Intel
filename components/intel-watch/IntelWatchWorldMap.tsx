"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";

const topology = countriesAtlas as unknown as TopoJSON.Topology;
const countriesGeo = feature(
  topology,
  topology.objects.countries as TopoJSON.GeometryCollection,
) as GeoJSON.FeatureCollection;

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 430;
const PADDING_X = 36;
const PADDING_Y = 24;
const RADIAN = Math.PI / 180;
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const ZOOM_FACTOR = 1.12;
const COUNTRY_FOCUS_MIN_ZOOM = 1.35;
const DRAG_CLICK_THRESHOLD = 5;
const SMOOTH_TRANSFORM_DURATION = 420;

type Position = [number, number];
type RawPoint = readonly [number, number];
type PanState = {
  x: number;
  y: number;
};
type DragState = {
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  hasExceededClickThreshold: boolean;
} | null;
type TooltipState = {
  name: string;
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
} | null;

function displayCountryName(featureItem: GeoJSON.Feature) {
  const properties = featureItem.properties as
    | { name?: string; name_long?: string; formal_en?: string }
    | null
    | undefined;

  return properties?.name ?? properties?.name_long ?? properties?.formal_en ?? "";
}

function countryName(featureItem: GeoJSON.Feature) {
  return displayCountryName(featureItem).toLowerCase();
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampPan(pan: PanState, zoom: number) {
  if (zoom <= MIN_ZOOM) return { x: 0, y: 0 };

  return {
    x: Math.min(0, Math.max(VIEW_WIDTH * (1 - zoom), pan.x)),
    y: Math.min(0, Math.max(VIEW_HEIGHT * (1 - zoom), pan.y)),
  };
}

function zoomFromPoint(
  currentZoom: number,
  currentPan: PanState,
  nextZoom: number,
  origin: PanState,
) {
  const ratio = nextZoom / currentZoom;

  return clampPan(
    {
      x: origin.x - (origin.x - currentPan.x) * ratio,
      y: origin.y - (origin.y - currentPan.y) * ratio,
    },
    nextZoom,
  );
}

function screenPointToViewBox(
  event: WheelEvent,
  rect: DOMRect,
) {
  const scale = Math.min(rect.width / VIEW_WIDTH, rect.height / VIEW_HEIGHT);
  const renderedWidth = VIEW_WIDTH * scale;
  const renderedHeight = VIEW_HEIGHT * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;

  return {
    x: Math.min(
      VIEW_WIDTH,
      Math.max(0, (event.clientX - rect.left - offsetX) / scale),
    ),
    y: Math.min(
      VIEW_HEIGHT,
      Math.max(0, (event.clientY - rect.top - offsetY) / scale),
    ),
  };
}

function screenDeltaToViewBox(deltaX: number, deltaY: number, rect: DOMRect) {
  const scale = Math.min(rect.width / VIEW_WIDTH, rect.height / VIEW_HEIGHT);

  return {
    x: deltaX / scale,
    y: deltaY / scale,
  };
}

function shouldRenderCountry(featureItem: GeoJSON.Feature) {
  const name = countryName(featureItem);
  return name !== "antarctica" && name !== "fr. s. antarctic lands";
}

function naturalEarthRaw(longitude: number, latitude: number): RawPoint {
  const lambda = longitude * RADIAN;
  const phi = latitude * RADIAN;
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;

  return [
    lambda *
      (0.8707 -
        0.131979 * phi2 +
        phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
    phi *
      (1.007226 +
        phi2 *
          (0.015085 +
            phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))),
  ];
}

function unwrapDateLineRing(ring: Position[]) {
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let positivePoints = 0;
  let negativePoints = 0;

  ring.forEach(([longitude]) => {
    minLongitude = Math.min(minLongitude, longitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    if (longitude >= 0) positivePoints += 1;
    else negativePoints += 1;
  });

  const crossesDateLine = minLongitude < -170 && maxLongitude > 170;

  if (!crossesDateLine || positivePoints < negativePoints) {
    return { ring, crossesDateLine };
  }

  return {
    ring: ring.map(([longitude, latitude]) => [
      longitude < 0 ? longitude + 360 : longitude,
      latitude,
    ]) as Position[],
    crossesDateLine,
  };
}

function collectRings(geometry: GeoJSON.Geometry | null) {
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return geometry.coordinates as Position[][];
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as Position[][][]).flat();
  }

  return [];
}

const renderedFeatures = countriesGeo.features.filter(shouldRenderCountry);
const projectedRings = renderedFeatures.flatMap((featureItem) =>
  collectRings(featureItem.geometry).map((ring) => {
    const { ring: unwrappedRing, crossesDateLine } = unwrapDateLineRing(ring);

    return {
      id: String(featureItem.id ?? countryName(featureItem)),
      crossesDateLine,
      points: unwrappedRing.map((position) => naturalEarthRaw(...position)),
      source: unwrappedRing,
    };
  }),
);

const bounds = projectedRings.reduce(
  (currentBounds, ring) => {
    ring.points.forEach(([x, y]) => {
      currentBounds.minX = Math.min(currentBounds.minX, x);
      currentBounds.maxX = Math.max(currentBounds.maxX, x);
      currentBounds.minY = Math.min(currentBounds.minY, y);
      currentBounds.maxY = Math.max(currentBounds.maxY, y);
    });

    return currentBounds;
  },
  {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  },
);

const mapScale = Math.min(
  (VIEW_WIDTH - PADDING_X * 2) / (bounds.maxX - bounds.minX),
  (VIEW_HEIGHT - PADDING_Y * 2) / (bounds.maxY - bounds.minY),
);
const mapCenterX = (bounds.minX + bounds.maxX) / 2;
const mapCenterY = (bounds.minY + bounds.maxY) / 2;

function projectPoint([x, y]: RawPoint) {
  return [
    VIEW_WIDTH / 2 + (x - mapCenterX) * mapScale,
    VIEW_HEIGHT / 2 - (y - mapCenterY) * mapScale,
  ] as const;
}

function ringPath({
  crossesDateLine,
  points,
  source,
}: {
  crossesDateLine: boolean;
  points: RawPoint[];
  source: Position[];
}) {
  const path = points
    .map((point, index) => {
      const [x, y] = projectPoint(point);
      const previousPosition = source[index - 1];
      const crossesSegment =
        previousPosition &&
        Math.abs(source[index][0] - previousPosition[0]) > 180;
      const command = index === 0 || crossesSegment ? "M" : "L";

      return `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return crossesDateLine ? path : `${path} Z`;
}

const countryPaths = renderedFeatures
  .map((featureItem) => ({
    id: String(featureItem.id ?? countryName(featureItem)),
    name: displayCountryName(featureItem),
    path: collectRings(featureItem.geometry)
      .map((ring) => {
        const { ring: unwrappedRing, crossesDateLine } =
          unwrapDateLineRing(ring);

        return ringPath({
          crossesDateLine,
          points: unwrappedRing.map((position) => naturalEarthRaw(...position)),
          source: unwrappedRing,
        });
      })
      .join(" "),
  }))
  .filter(({ path }) => path.length > 0);

const intelMarkers = [
  {
    id: "m1",
    name: "Ankara",
    location: "Ankara, Türkiye",
    region: "Türkiye / Eastern Mediterranean",
    signalType: "Regional Security Signal",
    severity: "High",
    category: "Policy / Security",
    sourceType: "Public OSINT",
    updated: "12 min ago",
    eventBrief:
      "Public-source reporting indicates increased policy and security-related activity connected to Ankara over the past 24 hours. The item is associated with diplomatic statements, cross-border security commentary, and public institutional mentions from regional media and official channels. Turkish foreign ministry statements referenced bilateral security frameworks with neighboring states, while several outlets reported additional official scheduling activity. No single confirmed operational incident is attached to this marker; it represents a consolidated open-source event note based on observable public reporting.",
    sourceContext:
      "Sources include Turkish-language institutional references, regional news coverage, open-source aggregation, and English-language Gulf and European media. No signals intelligence, closed-source reporting, or live collection is represented. The entry should be read as a frontend-only OSINT mock item, not a confirmed operational assessment.",
    coordinates: [32.8597, 39.9334],
    pulseDelay: 0,
  },
  {
    id: "m2",
    name: "Berlin",
    location: "Berlin, Germany",
    region: "Central Europe / EU Policy",
    signalType: "Policy Monitoring Signal",
    severity: "Medium",
    category: "Policy / Defense",
    sourceType: "Media / Institutional",
    updated: "28 min ago",
    eventBrief:
      "Open-source references around Berlin show increased public mentions of defense policy, energy-security coordination, and regional diplomatic scheduling. The item is tied to parliamentary agenda notes, German government press releases, and media coverage of European security posture discussions. Recent references include Bundestag committee activity related to defense spending and critical infrastructure, as well as bilateral diplomatic meeting announcements. No single confirmed incident drives this marker; it reflects an aggregated pattern of public institutional activity.",
    sourceContext:
      "Sources include mainstream German media, parliamentary disclosure portals, European institutional press offices, and English-language policy-tracking references. All cited source types are publicly accessible. The entry is a static OSINT mock item and should not be treated as a confirmed operational development.",
    coordinates: [13.405, 52.52],
    pulseDelay: 0.5,
  },
  {
    id: "m3",
    name: "Moscow",
    location: "Moscow, Russia",
    region: "Eurasia / Russia",
    signalType: "State Media Activity",
    severity: "High",
    category: "Security / Media",
    sourceType: "Public Reporting",
    updated: "35 min ago",
    eventBrief:
      "Public-source reporting indicates a denser cluster of state-media output, official commentary, and policy-security messaging originating from Moscow during the current reporting window. The marker reflects increased reference volume across Russian-language institutional channels, with repeated framing around regional security and foreign-policy pressure points directed at Western partners. Open-source media trackers noted similar language appearing across official outlets. This does not represent a confirmed operational event; it is an OSINT event note based on observable media activity.",
    sourceContext:
      "Primary source material consists of Russian state-media output available through open channels, supplemented by public Western media-monitoring references. State-media provenance introduces institutional bias and should be interpreted with caution. No closed-source intelligence or live collection is represented in this frontend-only mock entry.",
    coordinates: [37.6173, 55.7558],
    pulseDelay: 1,
  },
  {
    id: "m4",
    name: "Riyadh",
    location: "Riyadh, Saudi Arabia",
    region: "Gulf / Middle East",
    signalType: "Energy Security Signal",
    severity: "Medium",
    category: "Energy / Diplomacy",
    sourceType: "Public OSINT",
    updated: "47 min ago",
    eventBrief:
      "Public references connected to Riyadh increased around energy-market coordination, maritime security, and diplomatic engagement. The item is drawn from media reporting, official schedule references, and sector commentary rather than a single incident report. Open-source references include coverage of upcoming OPEC+ ministerial consultations, bilateral energy-sector meeting announcements, and public statements from the Saudi Energy Ministry. No unilateral policy change has been announced; the marker reflects observable institutional activity in the energy-diplomatic space.",
    sourceContext:
      "Sources include Gulf-region English and Arabic media, energy-sector news services, and OPEC observer reporting. No direct government-issued policy change is represented in the item. The source pool is consistent with commodity-sector OSINT practice and is presented here as static mock data.",
    coordinates: [46.6753, 24.7136],
    pulseDelay: 1.4,
  },
  {
    id: "m5",
    name: "Beijing",
    location: "Beijing, China",
    region: "East Asia / Indo-Pacific",
    signalType: "Diplomatic Activity Signal",
    severity: "Medium",
    category: "Diplomacy / Maritime",
    sourceType: "Official / Media",
    updated: "1 hr ago",
    eventBrief:
      "Open-source reporting around Beijing indicates elevated public discussion of diplomatic positioning, maritime policy references, and institutional statements related to regional security. Official and media mentions increased across several public channels, with Chinese Foreign Ministry transcripts referencing South China Sea maritime frameworks and bilateral diplomatic scheduling. Regional English-language reporting also noted PLA Navy exercise announcements and statements related to Taiwan Strait passage protocols. This marker does not indicate a confirmed incident; it is an aggregated OSINT event note based on public institutional activity.",
    sourceContext:
      "Sources include Chinese state-media output, Foreign Ministry transcript references, and regional English-language diplomatic reporting. PRC state-media sources carry institutional bias and require careful interpretation. The entry reflects frontend-only static OSINT data and does not represent confirmed intelligence reporting.",
    coordinates: [116.4074, 39.9042],
    pulseDelay: 1.8,
  },
  {
    id: "m6",
    name: "Washington",
    location: "Washington, DC",
    region: "North America / Transatlantic Policy",
    signalType: "Sanctions Policy Signal",
    severity: "Low",
    category: "Sanctions / Policy",
    sourceType: "Public Institutional",
    updated: "1 hr 18 min ago",
    eventBrief:
      "Public institutional references from Washington reflect renewed activity around sanctions enforcement, partner coordination language, and foreign-policy messaging. The item is based on public statements from the U.S. Treasury's Office of Foreign Assets Control, agency press notices, and media coverage of Congressional hearings on sanctions effectiveness. Washington-origin policy language can influence allied government statements, compliance expectations among multinational institutions, and market-facing regulatory commentary. The marker reflects an observable uptick in public institutional output rather than a newly confirmed enforcement action.",
    sourceContext:
      "Sources include Federal Register notices, Congressional hearing transcripts, Treasury and State Department press releases, and mainstream financial news coverage. Primary source types are publicly accessible through U.S. government portals. This frontend-only mock entry should be read as an open-source institutional event note.",
    coordinates: [-77.0369, 38.9072],
    pulseDelay: 2.1,
  },
].map(({ coordinates, ...marker }) => {
  const [x, y] = projectPoint(
    naturalEarthRaw(...(coordinates as Position)),
  );

  return {
    ...marker,
    x,
    y,
  };
});

export function IntelWatchWorldMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const panRef = useRef<PanState>({ x: 0, y: 0 });
  const dragRef = useRef<DragState>(null);
  const blockNextCountryClickRef = useRef(false);
  const selectedMarkerRef = useRef<string | null>(null);
  const smoothTransformTimeoutRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSmoothTransform, setIsSmoothTransform] = useState(false);
  const canZoomIn = zoom < MAX_ZOOM;
  const canZoomOut = zoom > MIN_ZOOM;
  const hasCustomZoom = zoom !== DEFAULT_ZOOM;
  const selectedMarker =
    intelMarkers.find((marker) => marker.id === selectedMarkerId) ?? null;

  function closeMarkerModal() {
    selectedMarkerRef.current = null;
    setSelectedMarkerId(null);
  }

  function stopSmoothTransform() {
    if (smoothTransformTimeoutRef.current) {
      window.clearTimeout(smoothTransformTimeoutRef.current);
      smoothTransformTimeoutRef.current = null;
    }

    setIsSmoothTransform(false);
  }

  function beginSmoothTransform() {
    if (smoothTransformTimeoutRef.current) {
      window.clearTimeout(smoothTransformTimeoutRef.current);
    }

    setIsSmoothTransform(true);
    smoothTransformTimeoutRef.current = window.setTimeout(() => {
      smoothTransformTimeoutRef.current = null;
      setIsSmoothTransform(false);
    }, SMOOTH_TRANSFORM_DURATION);
  }

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [pan, zoom]);

  useEffect(() => {
    selectedMarkerRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closeMarkerModal();
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (smoothTransformTimeoutRef.current) {
        window.clearTimeout(smoothTransformTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const mapNode = node;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      if (selectedMarkerRef.current) return;

      stopSmoothTransform();

      const rect = mapNode.getBoundingClientRect();
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const nextZoom = Number(
        clampZoom(
          event.deltaY < 0
            ? currentZoom * ZOOM_FACTOR
            : currentZoom / ZOOM_FACTOR,
        ).toFixed(3),
      );

      if (nextZoom === currentZoom) return;

      const nextPan = zoomFromPoint(
        currentZoom,
        currentPan,
        nextZoom,
        screenPointToViewBox(event, rect),
      );

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    }

    mapNode.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      mapNode.removeEventListener("wheel", handleWheel);
    };
  }, []);

  function setZoomAndPan(
    nextZoom: number,
    nextPan: PanState,
    options?: { smooth?: boolean },
  ) {
    if (options?.smooth) {
      beginSmoothTransform();
    } else {
      stopSmoothTransform();
    }

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }

  function changeZoom(direction: "in" | "out") {
    const currentZoom = zoomRef.current;
    const nextZoom = Number(
      clampZoom(
        direction === "in"
          ? currentZoom * ZOOM_FACTOR
          : currentZoom / ZOOM_FACTOR,
      ).toFixed(3),
    );

    if (nextZoom === currentZoom) return;

    setZoomAndPan(
      nextZoom,
      zoomFromPoint(currentZoom, panRef.current, nextZoom, {
        x: VIEW_WIDTH / 2,
        y: VIEW_HEIGHT / 2,
      }),
      { smooth: true },
    );
  }

  function resetZoom() {
    dragRef.current = null;
    setIsDragging(false);
    setZoomAndPan(DEFAULT_ZOOM, { x: 0, y: 0 }, { smooth: true });
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    blockNextCountryClickRef.current = false;

    if (
      zoomRef.current <= MIN_ZOOM ||
      target?.closest('[aria-label="Map zoom controls"]')
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      hasExceededClickThreshold: false,
    };
    setTooltip(null);
    setIsDragging(true);
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const delta = screenDeltaToViewBox(
      event.clientX - dragState.x,
      event.clientY - dragState.y,
      rect,
    );
    const hasExceededClickThreshold =
      dragState.hasExceededClickThreshold ||
      Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY,
      ) > DRAG_CLICK_THRESHOLD;
    const nextPan = clampPan(
      {
        x: panRef.current.x + delta.x,
        y: panRef.current.y + delta.y,
      },
      zoomRef.current,
    );

    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: dragState.startX,
      startY: dragState.startY,
      hasExceededClickThreshold,
    };
    blockNextCountryClickRef.current = hasExceededClickThreshold;
    panRef.current = nextPan;
    setPan(nextPan);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsDragging(false);
  }

  function focusCountry(event: MouseEvent<SVGPathElement>) {
    event.stopPropagation();

    if (blockNextCountryClickRef.current) {
      blockNextCountryClickRef.current = false;
      return;
    }

    const bbox = event.currentTarget.getBBox();
    const countryCenterX = bbox.x + bbox.width / 2;
    const countryCenterY = bbox.y + bbox.height / 2;
    const viewCenterX = VIEW_WIDTH / 2;
    const viewCenterY = VIEW_HEIGHT / 2;
    const targetZoom = Number(
      clamp(
        Math.min(
          (VIEW_WIDTH * 0.32) / Math.max(bbox.width, 1),
          (VIEW_HEIGHT * 0.36) / Math.max(bbox.height, 1),
        ),
        COUNTRY_FOCUS_MIN_ZOOM,
        MAX_ZOOM,
      ).toFixed(3),
    );
    const targetPan = clampPan(
      {
        x: viewCenterX - countryCenterX * targetZoom,
        y: viewCenterY - countryCenterY * targetZoom,
      },
      targetZoom,
    );

    setZoomAndPan(targetZoom, targetPan, { smooth: true });
  }

  function updateTooltip(
    event: MouseEvent<SVGPathElement>,
    countryLabel: string,
  ) {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect || !countryLabel) {
      setTooltip(null);
      return;
    }

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const flipX = localX > rect.width - 170;
    const flipY = localY > rect.height - 42;
    const xOffset = flipX ? -12 : 12;
    const yOffset = flipY ? -12 : 12;

    setTooltip({
      name: countryLabel,
      x: Math.min(Math.max(localX + xOffset, 8), rect.width - 8),
      y: Math.min(Math.max(localY + yOffset, 8), rect.height - 8),
      flipX,
      flipY,
    });
  }

  function showMarkerPopup(
    event: MouseEvent<SVGGElement>,
    marker: (typeof intelMarkers)[number],
  ) {
    event.preventDefault();
    event.stopPropagation();

    setTooltip(null);
    selectedMarkerRef.current = marker.id;
    setSelectedMarkerId(marker.id);
  }

  function handleMarkerKeyDown(
    event: KeyboardEvent<SVGGElement>,
    marker: (typeof intelMarkers)[number],
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopPropagation();

    setTooltip(null);
    selectedMarkerRef.current = marker.id;
    setSelectedMarkerId(marker.id);
  }

  return (
    <div
      ref={containerRef}
      data-map-dragging={isDragging ? "true" : undefined}
      data-map-smooth-transform={isSmoothTransform ? "true" : undefined}
      data-map-zoomed={zoom > MIN_ZOOM ? "true" : undefined}
      className="relative h-full w-full overflow-hidden"
      onPointerCancel={endDrag}
      onPointerDown={beginDrag}
      onPointerLeave={endDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      style={{
        background: "var(--c-bg-deep)",
        cursor: zoom > MIN_ZOOM ? (isDragging ? "grabbing" : "grab") : "default",
        isolation: "isolate",
        touchAction: "none",
      }}
    >
      <style>
        {`
          .intel-map-zoom-button {
            display: grid;
            place-items: center;
            min-width: 28px;
            height: 28px;
            border-radius: 7px;
            border: 1px solid rgba(255, 255, 255, 0.24);
            background: rgba(255, 43, 61, 0.1);
            color: rgba(248, 250, 252, 0.98);
            cursor: pointer;
            font-size: 15px;
            font-weight: 800;
            line-height: 1;
            transition:
              background 140ms ease,
              border-color 140ms ease,
              opacity 140ms ease;
          }

          .intel-map-zoom-button:hover:not(:disabled) {
            background: rgba(255, 43, 61, 0.16);
            border-color: rgba(255, 72, 84, 0.42);
          }

          .intel-map-zoom-button:disabled {
            opacity: 0.48;
            cursor: not-allowed;
          }

          [data-map-zoomed="true"] .country {
            cursor: grab;
          }

          [data-map-dragging="true"] .country {
            cursor: grabbing;
          }
        `}
      </style>
      <svg
        aria-label="Intel Watch world map"
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        style={{ overflow: "visible", position: "relative", zIndex: 0 }}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      >
        <style>
          {`
            .map-zoom-layer {
              transition: none;
            }

            [data-map-smooth-transform="true"] .map-zoom-layer {
              transition: transform ${SMOOTH_TRANSFORM_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1);
            }

            [data-map-dragging="true"] .map-zoom-layer {
              transition: none;
            }

            .country {
              fill: rgba(210, 216, 222, 0.82);
              stroke: rgba(24, 30, 38, 0.72);
              stroke-width: 0.28;
              stroke-linejoin: round;
              stroke-linecap: round;
              vector-effect: non-scaling-stroke;
              shape-rendering: geometricPrecision;
              transition:
                fill 150ms ease,
                stroke 150ms ease,
                stroke-opacity 150ms ease,
                filter 150ms ease;
              cursor: pointer;
            }

            .country:hover {
              fill: rgba(226, 235, 242, 0.96);
              stroke: rgba(245, 250, 255, 0.72);
              stroke-opacity: 1;
              filter: drop-shadow(0 0 7px rgba(130, 180, 220, 0.24));
            }

            .country:focus-visible {
              outline: none;
              fill: rgba(226, 235, 242, 0.96);
              stroke: rgba(245, 250, 255, 0.82);
              stroke-opacity: 1;
              filter: drop-shadow(0 0 7px rgba(130, 180, 220, 0.24));
            }

            .intel-marker-layer {
              pointer-events: auto;
            }

            .intel-marker {
              cursor: pointer;
              outline: none;
            }

            .intel-marker,
            .intel-marker *,
            .intel-marker:focus,
            .intel-marker:focus-visible,
            .intel-marker:active {
              outline: none;
            }

            .intel-marker-pulse {
              animation: markerPulse 2400ms ease-out infinite;
              stroke: rgba(255, 31, 45, 0.58);
              stroke-width: 1.4;
              fill: none;
              transform-box: fill-box;
              transform-origin: center;
            }

            .intel-marker-halo {
              fill: rgba(255, 31, 45, 0.22);
              filter: drop-shadow(0 0 5px rgba(255, 20, 35, 0.32));
            }

            .intel-marker-core {
              animation: markerCoreGlow 2400ms ease-in-out infinite;
              fill: rgba(255, 31, 45, 0.98);
              stroke: rgba(255, 235, 238, 0.56);
              stroke-width: 0.55;
            }

            @keyframes markerPulse {
              0% {
                transform: scale(0.72);
                opacity: 0.46;
              }

              68% {
                transform: scale(1.64);
                opacity: 0.1;
              }

              100% {
                transform: scale(1.84);
                opacity: 0;
              }
            }

            @keyframes markerCoreGlow {
              0%,
              100% {
                opacity: 0.92;
              }

              50% {
                opacity: 1;
              }
            }
          `}
        </style>
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="var(--c-bg-deep)" />
        <g
          className="map-zoom-layer"
          transform={`translate(${pan.x.toFixed(2)} ${pan.y.toFixed(
            2,
          )}) scale(${zoom})`}
        >
          <g
            fill="none"
            stroke="rgba(245, 250, 255, 0.16)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0.22"
            style={{
              shapeRendering: "geometricPrecision",
              vectorEffect: "non-scaling-stroke",
            }}
          >
            {countryPaths.map(({ id, path }) => (
              <path key={`outline-${id}`} d={path} />
            ))}
          </g>
          <g
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              shapeRendering: "geometricPrecision",
              vectorEffect: "non-scaling-stroke",
            }}
          >
            {countryPaths.map(({ id, name, path }) => (
              <path
                key={id}
                aria-label={name}
                className="country"
                d={path}
                onClick={focusCountry}
                onMouseEnter={(event) => updateTooltip(event, name)}
                onMouseLeave={() => setTooltip(null)}
                onMouseMove={(event) => updateTooltip(event, name)}
              />
            ))}
          </g>
          <g className="intel-marker-layer">
            {intelMarkers.map((marker) => (
              <g
                key={marker.id}
                aria-label={`Open intelligence note for ${marker.name}`}
                className="intel-marker"
                role="button"
                tabIndex={0}
                transform={`translate(${marker.x.toFixed(2)} ${marker.y.toFixed(
                  2,
                )}) scale(${(1 / zoom).toFixed(4)})`}
                onClick={(event) => showMarkerPopup(event, marker)}
                onKeyDown={(event) => handleMarkerKeyDown(event, marker)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <circle
                  className="intel-marker-pulse"
                  r="5.5"
                  style={{ animationDelay: `${marker.pulseDelay}s` }}
                />
                <circle className="intel-marker-halo" r="4.8" />
                <circle
                  className="intel-marker-core"
                  r="2.7"
                  style={{ animationDelay: `${marker.pulseDelay}s` }}
                />
              </g>
            ))}
          </g>
        </g>
      </svg>
      <div
        aria-label="Map zoom controls"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderRadius: 12,
          pointerEvents: "auto",
          background: "var(--bg-panel)",
          border: "1px solid var(--c-border-1)",
          boxShadow: "var(--shadow-inset-highlight), 0 12px 32px rgba(0, 0, 0, 0.58)",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          aria-label="Zoom out"
          className="intel-map-zoom-button"
          disabled={!canZoomOut}
          onClick={() => changeZoom("out")}
          type="button"
        >
          &minus;
        </button>
        <span
          style={{
            minWidth: 48,
            textAlign: "center",
            color: "rgba(226, 232, 240, 0.96)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          aria-label="Zoom in"
          className="intel-map-zoom-button"
          disabled={!canZoomIn}
          onClick={() => changeZoom("in")}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Reset map view"
          className="intel-map-zoom-button"
          disabled={!hasCustomZoom}
          onClick={resetZoom}
          style={{
            padding: "0 8px",
            width: "auto",
            gap: 5,
            display: "grid",
            placeItems: "center",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
          type="button"
        >
          Reset
        </button>
      </div>
      {tooltip ? (
        <div
          className="absolute z-20 max-w-[calc(100%-16px)] whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: `translate(${tooltip.flipX ? "-100%" : "0"}, ${
              tooltip.flipY ? "-100%" : "0"
            })`,
            pointerEvents: "none",
            padding: "5px 8px",
            borderRadius: 6,
            background: "var(--bg-panel)",
            border: "1px solid var(--c-border-1)",
            color: "rgba(232, 238, 244, 0.92)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            lineHeight: 1,
            textTransform: "uppercase",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
            backdropFilter: "blur(8px)",
          }}
        >
          {tooltip.name}
        </div>
      ) : null}
      {selectedMarker ? (
        <div
          className="absolute inset-0 z-50"
          data-marker-modal="true"
          style={{
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(3, 2, 3, 0.62)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            cursor: "default",
          }}
          onClick={closeMarkerModal}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div
            aria-modal="true"
            role="dialog"
            style={{
              width: "min(624px, calc(100% - 48px))",
              maxHeight: "min(560px, calc(100% - 48px))",
              overflow: "hidden",
              borderRadius: 18,
              background: "var(--bg-panel)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "var(--shadow-inset-highlight), 0 32px 90px rgba(0, 0, 0, 0.55)",
              color: "rgba(232, 238, 244, 0.94)",
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              style={{
                height: 3,
                background: "#ff1f2d",
                opacity: 0.95,
              }}
            />
            <div
              style={{
                maxHeight: "calc(min(560px, calc(100vh - 48px)) - 3px)",
                overflowY: "auto",
                padding: "20px 24px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 18,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#ff1f2d",
                        boxShadow: "0 0 10px rgba(255, 31, 45, 0.42)",
                        flex: "0 0 auto",
                      }}
                    />
                    <span
                      style={{
                        color: "rgba(148, 163, 184, 0.78)",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        lineHeight: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      OSINT Event Note
                    </span>
                  </div>
                  <div
                    style={{
                      color: "rgba(248, 250, 252, 0.96)",
                      fontSize: 20,
                      fontWeight: 850,
                      letterSpacing: "0.01em",
                      lineHeight: 1.15,
                    }}
                  >
                    {selectedMarker.location}
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      color: "rgba(177, 190, 205, 0.86)",
                      fontSize: 13,
                      fontWeight: 650,
                      lineHeight: 1.25,
                    }}
                  >
                    {selectedMarker.signalType}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: "0 0 auto",
                  }}
                >
                  <span
                    style={{
                      borderRadius: 4,
                      border: "1px solid rgba(255, 31, 45, 0.32)",
                      background: "rgba(255, 31, 45, 0.1)",
                      color: "rgba(255, 210, 214, 0.95)",
                      flex: "0 0 auto",
                      padding: "5px 7px",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      lineHeight: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedMarker.severity}
                  </span>
                  <button
                    aria-label="Close marker detail"
                    className="intel-map-zoom-button"
                    onClick={closeMarkerModal}
                    style={{
                      width: 28,
                      minWidth: 28,
                      height: 28,
                      padding: 0,
                      fontSize: 14,
                    }}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: "14px 0",
                  borderTop: "1px solid rgba(255, 255, 255, 0.09)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.09)",
                }}
              >
                <div
                  style={{
                    color: "rgba(148, 163, 184, 0.72)",
                    fontSize: 10,
                    fontWeight: 850,
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Metadata
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "12px 14px",
                    marginTop: 12,
                  }}
                >
                  {[
                    ["Source", selectedMarker.sourceType],
                    ["Updated", selectedMarker.updated],
                    ["Region", selectedMarker.region],
                    ["Category", selectedMarker.category],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div
                        style={{
                          color: "rgba(148, 163, 184, 0.62)",
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.11em",
                          lineHeight: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          color: "rgba(220, 228, 238, 0.9)",
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.35,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    color: "rgba(255, 210, 214, 0.9)",
                    fontSize: 10,
                    fontWeight: 850,
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Event Brief
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: "rgba(203, 213, 225, 0.9)",
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  {selectedMarker.eventBrief}
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255, 255, 255, 0.07)",
                }}
              >
                <div
                  style={{
                    color: "rgba(148, 163, 184, 0.72)",
                    fontSize: 10,
                    fontWeight: 850,
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Source Context
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: "rgba(160, 175, 192, 0.78)",
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1.6,
                  }}
                >
                  {selectedMarker.sourceContext}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
