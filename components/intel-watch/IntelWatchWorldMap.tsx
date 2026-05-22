"use client";

import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
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

export function IntelWatchWorldMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const panRef = useRef<PanState>({ x: 0, y: 0 });
  const dragRef = useRef<DragState>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canZoomIn = zoom < MAX_ZOOM;
  const canZoomOut = zoom > MIN_ZOOM;
  const hasCustomZoom = zoom !== DEFAULT_ZOOM;

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [pan, zoom]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const mapNode = node;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

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

  function setZoomAndPan(nextZoom: number, nextPan: PanState) {
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
    );
  }

  function resetZoom() {
    dragRef.current = null;
    setIsDragging(false);
    setZoomAndPan(DEFAULT_ZOOM, { x: 0, y: 0 });
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as Element | null;

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
    };
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

  return (
    <div
      ref={containerRef}
      data-map-dragging={isDragging ? "true" : undefined}
      data-map-zoomed={zoom > MIN_ZOOM ? "true" : undefined}
      className="relative h-full w-full overflow-hidden"
      onPointerCancel={endDrag}
      onPointerDown={beginDrag}
      onPointerLeave={endDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      style={{
        background: "#050913",
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
            background: rgba(255, 255, 255, 0.14);
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
            background: rgba(255, 255, 255, 0.22);
            border-color: rgba(255, 255, 255, 0.38);
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
              transition: transform 220ms ease;
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
          `}
        </style>
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="#050913" />
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
                onMouseEnter={(event) => updateTooltip(event, name)}
                onMouseLeave={() => setTooltip(null)}
                onMouseMove={(event) => updateTooltip(event, name)}
              />
            ))}
          </g>
        </g>
      </svg>
      <div
        aria-label="Map zoom controls"
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
          background: "rgba(5, 9, 19, 0.96)",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.58)",
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
            background: "rgba(8, 13, 19, 0.86)",
            border: "1px solid rgba(220, 230, 239, 0.16)",
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
    </div>
  );
}
