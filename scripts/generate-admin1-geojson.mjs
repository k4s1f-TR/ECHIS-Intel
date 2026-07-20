import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Generates /public/data/home-globe-admin1.geojson — an admin-1
 * (province / state / il) BORDER line set, in the same shape as
 * home-globe.geojson so EchisGlobe can draw it as integrated sphere lines.
 *
 * Data source: Natural Earth 10m admin-1 states/provinces — the COMPLETE set.
 * The 50m set only carries internal subdivisions for a handful of large
 * countries (US, Canada, Russia, China, Brazil, India…) and leaves most of the
 * world — Turkey, Germany, France, all of Africa and the Middle East — with no
 * province lines at all. 10m has every country (4596 units), so this is the
 * only source that gives full global coverage.
 *
 * The trade-off is size: raw 10m is ~1.29M points / ~20 MB. We decimate it with
 * a minimum vertex spacing (SIMPLIFY_MIN_STEP_DEG) — at globe zoom the dropped
 * detail is invisible — bringing it down to ~165k points / ~2.3 MB while
 * keeping every country. Lowering the precision alone does NOT help (it trims
 * digits, not points); the spacing filter is what cuts the payload.
 *
 *   Option A (offline): download this file next to the script first:
 *     scripts/ne_10m_admin_1_states_provinces.geojson
 *     from https://github.com/nvkelso/natural-earth-vector
 *     (path: geojson/ne_10m_admin_1_states_provinces.geojson)
 *   Option B (online): if the local file is missing, the script fetches it
 *     from the pinned source below (needs network + Node 18+ fetch).
 *
 * Run:  node scripts/generate-admin1-geojson.mjs
 * Wire: package.json →  "generate:admin1": "node scripts/generate-admin1-geojson.mjs"
 */

const LOCAL_INPUT = new URL("./ne_10m_admin_1_states_provinces.geojson", import.meta.url);
const CDN_INPUT =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const outputUrl = new URL("../public/data/home-globe-admin1.geojson", import.meta.url);

const ANTIMERIDIAN_JUMP_DEG = 180;
const POLAR_ARTIFACT_LAT = 85;
const COORDINATE_PRECISION = 2;
// Minimum spacing (degrees, ~16 km) between kept vertices along a border. The
// ring's endpoints are always kept so segments stay closed. Raise it for a
// smaller file / coarser lines, lower it for more detail.
const SIMPLIFY_MIN_STEP_DEG = 0.15;
const SIMPLIFY_MIN_STEP_SQ = SIMPLIFY_MIN_STEP_DEG * SIMPLIFY_MIN_STEP_DEG;

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
  let lastKept = null;
  const flush = () => {
    if (currentLine.length >= 2) lines.push(currentLine);
    currentLine = [];
    lastKept = null;
  };
  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (!previous || !current || !isDrawableOutlineEdge(previous, current)) {
      flush();
      continue;
    }
    if (currentLine.length === 0) {
      currentLine.push([roundCoordinate(previous[0]), roundCoordinate(previous[1])]);
      lastKept = previous;
    }
    // Keep this vertex only if it is at least SIMPLIFY_MIN_STEP_DEG from the
    // last kept one — but always keep the ring's final vertex so the outline
    // stays closed.
    const deltaLng = current[0] - lastKept[0];
    const deltaLat = current[1] - lastKept[1];
    const isLastVertex = index === ring.length - 1;
    if (deltaLng * deltaLng + deltaLat * deltaLat >= SIMPLIFY_MIN_STEP_SQ || isLastVertex) {
      currentLine.push([roundCoordinate(current[0]), roundCoordinate(current[1])]);
      lastKept = current;
    }
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
    console.log("Local admin-1 file not found — fetching from source…");
    const res = await fetch(CDN_INPUT);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
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
let pointCount = 0;
for (const line of lines) pointCount += line.length;
console.log(
  `Generated ${fileURLToPath(outputUrl)} ` +
    `(${(Buffer.byteLength(serialized) / 1048576).toFixed(2)} MB, ` +
    `${lines.length} segments, ${pointCount} points, from ${collection.features?.length ?? 0} admin units)`,
);
