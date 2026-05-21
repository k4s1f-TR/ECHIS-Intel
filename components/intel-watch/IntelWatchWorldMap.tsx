"use client";

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

type Position = [number, number];
type RawPoint = readonly [number, number];

function countryName(featureItem: GeoJSON.Feature) {
  return (
    (featureItem.properties as { name?: string } | null | undefined)?.name ?? ""
  ).toLowerCase();
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
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "#050913" }}
    >
      <svg
        aria-hidden="true"
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      >
        <defs>
          <clipPath id="intel-watch-world-map-clip">
            <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} />
          </clipPath>
        </defs>
        <style>
          {`
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
        <g clipPath="url(#intel-watch-world-map-clip)">
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
            {countryPaths.map(({ id, path }) => (
              <path key={id} className="country" d={path} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
