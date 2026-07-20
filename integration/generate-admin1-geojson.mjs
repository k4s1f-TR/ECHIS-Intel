import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Generates /public/data/home-globe-admin1.geojson — an admin-1
 * (province / state / il) BORDER line set, in the same shape as
 * home-globe.geojson so EchisGlobe can draw it as integrated sphere lines.
 *
 * Data source: Natural Earth 10m admin-1 states/provinces.
 *   Option A (offline): download this file next to the script first:
 *     scripts/ne_10m_admin_1_states_provinces.geojson
 *     from https://github.com/nvkelso/natural-earth-vector
 *     (path: geojson/ne_10m_admin_1_states_provinces.geojson)
 *   Option B (online): if the local file is missing, the script fetches it
 *     from the pinned CDN below (needs network + Node 18+ fetch).
 *
 * Run:  node scripts/generate-admin1-geojson.mjs
 * Wire: add to package.json →  "generate:admin1": "node scripts/generate-admin1-geojson.mjs"
 */

const LOCAL_INPUT = new URL("./ne_10m_admin_1_states_provinces.geojson", import.meta.url);
const CDN_INPUT =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_1_states_provinces.geojson";
const outputUrl = new URL("../public/data/home-globe-admin1.geojson", import.meta.url);

const ANTIMERIDIAN_JUMP_DEG = 180;
const POLAR_ARTIFACT_LAT = 85;
const COORDINATE_PRECISION = 3;

function roundCoordinate(value) {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

function isDrawableOutlineEdge(previous, current) {
  if (Math.abs(previous[0] - current[0]) >= ANTIMERIDIAN_JUMP_DEG) return false;
  if (Math.abs(previous[1]) >= POLAR_ARTIFACT_LAT && Math.abs(current[1]) >= POLAR_ARTIFACT_LAT) return false;
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
    if (currentLine.length === 0) currentLine.push([roundCoordinate(previous[0]), roundCoordinate(previous[1])]);
    currentLine.push([roundCoordinate(current[0]), roundCoordinate(current[1])]);
  }
  flush();
}

function collectOutlineLines(geometry, lines) {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => appendRingLines(ring, lines));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => appendRingLines(ring, lines)));
  }
}

async function loadInput() {
  try {
    await access(LOCAL_INPUT);
    return JSON.parse(await readFile(LOCAL_INPUT, "utf8"));
  } catch {
    console.log("Local admin-1 file not found — fetching from CDN…");
    const res = await fetch(CDN_INPUT);
    if (!res.ok) throw new Error(`CDN fetch failed: ${res.status}`);
    return res.json();
  }
}

const collection = await loadInput();
const lines = [];
for (const feature of collection.features ?? []) {
  collectOutlineLines(feature.geometry, lines);
}

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { kind: "admin1-outline" },
      geometry: { type: "MultiLineString", coordinates: lines },
    },
  ],
};

const serialized = JSON.stringify(geojson);
await writeFile(outputUrl, serialized);
console.log(`Generated ${fileURLToPath(outputUrl)} (${Buffer.byteLength(serialized)} bytes, ${lines.length} line segments)`);
