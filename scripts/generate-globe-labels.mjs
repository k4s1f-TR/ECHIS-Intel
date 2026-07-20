import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Generates /public/data/home-globe-labels.json — the place-name anchors the
 * globe draws as HTML labels (tiered by zoom): country names when zoomed out,
 * province/state (admin-1) names when zoomed in.
 *
 *   { countries: [{ n, lng, lat }], admin1: [{ n, lng, lat }] }
 *
 * There is NO district (admin-2) tier — Natural Earth has no globally
 * consistent admin-2 set, so province/state is the deepest name level, matching
 * the admin-1 BORDER data in home-globe-admin1.geojson.
 *
 * Sources (fetched if not present next to this script):
 *   - countries: ne_110m_admin_0_countries  (~177 units, LABEL_X/LABEL_Y/NAME)
 *   - admin1:    ne_10m_admin_1_states_provinces (name + label_x/label_y or
 *                latitude/longitude) — the same file the border script uses.
 *
 * Run:  node scripts/generate-globe-labels.mjs
 * Wire: package.json → "generate:labels": "node scripts/generate-globe-labels.mjs"
 */

const OUTPUT = new URL("../public/data/home-globe-labels.json", import.meta.url);
const COORDINATE_PRECISION = 2;

const SOURCES = {
  countries: {
    local: new URL("./ne_110m_admin_0_countries.geojson", import.meta.url),
    cdn: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  },
  admin1: {
    local: new URL("./ne_10m_admin_1_states_provinces.geojson", import.meta.url),
    cdn: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
  },
};

const round = (value) => Number(value.toFixed(COORDINATE_PRECISION));

/** First present, finite property from a list of candidate keys. */
function pick(props, keys) {
  for (const key of keys) {
    const value = props?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** Rough centroid of a polygon/multipolygon outer ring, as a last-resort anchor. */
function fallbackCentroid(geometry) {
  if (!geometry) return null;
  const rings =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.map((polygon) => polygon[0])
        : [];
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const ring of rings) {
    for (const [lng, lat] of ring ?? []) {
      sumLng += lng;
      sumLat += lat;
      count += 1;
    }
  }
  return count ? [sumLng / count, sumLat / count] : null;
}

async function loadSource({ local, cdn }) {
  try {
    await access(local);
    return JSON.parse(await readFile(local, "utf8"));
  } catch {
    console.log(`  fetching ${cdn.split("/").pop()}…`);
    const res = await fetch(cdn);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  }
}

function extractLabels(collection, nameKeys, lngKeys, latKeys) {
  const labels = [];
  const seen = new Set();
  for (const feature of collection.features ?? []) {
    const props = feature.properties ?? {};
    const name = pick(props, nameKeys);
    if (!name) continue;
    let lng = pick(props, lngKeys);
    let lat = pick(props, latKeys);
    if (typeof lng !== "number" || typeof lat !== "number") {
      const centroid = fallbackCentroid(feature.geometry);
      if (!centroid) continue;
      [lng, lat] = centroid;
    }
    const key = `${name}@${round(lng)},${round(lat)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({ n: String(name), lng: round(lng), lat: round(lat) });
  }
  return labels;
}

console.log("Building globe labels…");
const [countriesRaw, admin1Raw] = await Promise.all([
  loadSource(SOURCES.countries),
  loadSource(SOURCES.admin1),
]);

const countries = extractLabels(
  countriesRaw,
  ["NAME_EN", "NAME", "name_en", "name", "ADMIN"],
  ["LABEL_X", "label_x"],
  ["LABEL_Y", "label_y"],
);
const admin1 = extractLabels(
  admin1Raw,
  ["name_en", "name", "gn_name", "woe_name"],
  ["label_x", "longitude", "label_x"],
  ["label_y", "latitude", "label_y"],
);

const serialized = JSON.stringify({ countries, admin1 });
await writeFile(OUTPUT, serialized);
console.log(
  `Generated ${fileURLToPath(OUTPUT)} ` +
    `(${(Buffer.byteLength(serialized) / 1024).toFixed(0)} KB, ` +
    `${countries.length} countries, ${admin1.length} admin-1)`,
);
