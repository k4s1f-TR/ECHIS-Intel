import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const atlasPath = require.resolve("world-atlas/countries-50m.json");
const outputUrl = new URL("../public/data/home-globe.geojson", import.meta.url);

const ANTIMERIDIAN_JUMP_DEG = 180;
const POLAR_ARTIFACT_LAT = 85;
const COORDINATE_PRECISION = 3;

function roundCoordinate(value) {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

function roundCoordinates(coordinates) {
  if (typeof coordinates[0] === "number") {
    return [roundCoordinate(coordinates[0]), roundCoordinate(coordinates[1])];
  }
  return coordinates.map(roundCoordinates);
}

function compactGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "GeometryCollection") {
    return {
      type: "GeometryCollection",
      geometries: geometry.geometries.map(compactGeometry),
    };
  }
  return {
    type: geometry.type,
    coordinates: roundCoordinates(geometry.coordinates),
  };
}

function isDrawableOutlineEdge(previous, current) {
  if (Math.abs(previous[0] - current[0]) >= ANTIMERIDIAN_JUMP_DEG) {
    return false;
  }
  if (
    Math.abs(previous[1]) >= POLAR_ARTIFACT_LAT &&
    Math.abs(current[1]) >= POLAR_ARTIFACT_LAT
  ) {
    return false;
  }
  return true;
}

function appendRingLines(ring, lines) {
  let currentLine = [];

  const flush = () => {
    if (currentLine.length >= 2) lines.push(currentLine);
    currentLine = [];
  };

  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (!previous || !current || !isDrawableOutlineEdge(previous, current)) {
      flush();
      continue;
    }
    if (currentLine.length === 0) currentLine.push(previous);
    currentLine.push(current);
  }

  flush();
}

function collectOutlineLines(geometry, lines) {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => appendRingLines(ring, lines));
    return;
  }
  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => appendRingLines(ring, lines));
    });
  }
}

const topology = JSON.parse(await readFile(atlasPath, "utf8"));
const countries = feature(topology, topology.objects.countries);
const lines = [];

const landFeatures = countries.features.map((country) => {
  collectOutlineLines(country.geometry, lines);
  return {
    type: "Feature",
    properties: {
      kind: "land",
      id: String(country.id ?? country.properties?.name ?? "country"),
      name: country.properties?.name ?? "Unknown country",
    },
    geometry: compactGeometry(country.geometry),
  };
});

const homeGlobeGeoJson = {
  type: "FeatureCollection",
  features: [
    ...landFeatures,
    {
      type: "Feature",
      properties: { kind: "outline" },
      geometry: {
        type: "MultiLineString",
        coordinates: roundCoordinates(lines),
      },
    },
  ],
};

const serialized = JSON.stringify(homeGlobeGeoJson);
await writeFile(outputUrl, serialized);

const outputPath = fileURLToPath(outputUrl);
const byteLength = Buffer.byteLength(serialized);
console.log(`Generated ${outputPath} (${byteLength} bytes)`);
