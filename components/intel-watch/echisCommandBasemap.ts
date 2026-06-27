import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

/**
 * ECHIS Command Basemap — TypeScript port of the `echis-map.js` design handoff
 * (MapLibre-compatible world map / design_handoff_echis_map).
 *
 * A dark, GREYSCALE 2D world basemap that sits *behind* Intel Watch's
 * operational data (event pins, drawings). High-fidelity: the colours, zoom
 * expressions and border conventions below are the handoff's final values —
 * recreated precisely so geography stays readable but recedes.
 *
 * Cartographic intent (do not "improve" without reason):
 *   1. Geography is RECESSED — it must never compete with data.
 *   2. Progressive disclosure by zoom (continents+countries -> +cities -> +roads).
 *   3. Typographic hierarchy: country = upper-case tracked grey; city = dot+name;
 *      water = italic, dimmest. Dark halo on all, none glowing.
 *   4. Country border = thin solid grey; admin border = dashed + dimmer.
 *   5. COLOURLESS geography — colour means data only (handled by the markers).
 */

/* Palette — the only colours geography is allowed to use. */
export const ECHIS_COLORS = {
  land: "#13161b",
  ocean: "#080a0e",
  waterway: "#0b0e13",
  borderCountry: "#3b424c",
  borderAdmin: "#2a2f37",
  road: "#22272e",
  halo: "#05070b",
  textCountry: "#7d838d",
  textCity: "#9aa1ab",
  textCapital: "#c3c8d0",
  textWater: "#4a5059",
  dotCity: "#c7ccd4",
  dotCapital: "#e4e7ec",
  graticule: "#ffffff", // drawn at ~0.045 opacity
} as const;

/* Default camera, tuned to the eastern-Mediterranean theatre. */
export const ECHIS_VIEW = {
  center: [35.88, 34.9] as [number, number], // [lng, lat]
  zoom: 5.4,
  minZoom: 1.7,
  maxZoom: 13,
  // Excludes polar regions. NOTE: a FULL-longitude bound (-180..180) combined
  // with renderWorldCopies:false breaks MapLibre's camera constraint solver —
  // keep longitude slightly inset (-179..179).
  maxBounds: [
    [-179, -58],
    [179, 76],
  ] as [[number, number], [number, number]],
};

const TILE_SOURCE_URL = "https://tiles.openfreemap.org/planet";
const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> ' +
  '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>';

/**
 * The MapLibre style (OpenMapTiles schema). Mirrors `buildEchisStyle()` from
 * the handoff `echis-map.js` exactly.
 */
export function buildEchisCommandStyle(
  c: typeof ECHIS_COLORS = ECHIS_COLORS,
): StyleSpecification {
  const src = "openmaptiles";
  return {
    version: 8,
    name: "ECHIS Command Basemap",
    glyphs: GLYPHS_URL,
    sources: {
      openmaptiles: { type: "vector", url: TILE_SOURCE_URL, attribution: ATTRIBUTION },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": c.land } },

      {
        id: "ocean",
        type: "fill",
        source: src,
        "source-layer": "water",
        paint: { "fill-color": c.ocean, "fill-antialias": true },
      },

      {
        id: "waterway",
        type: "line",
        source: src,
        "source-layer": "waterway",
        minzoom: 6,
        paint: {
          "line-color": c.waterway,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 12, 1.4],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 8, 0.8],
        },
      },

      // Admin (state/province) — dashed, dimmer, appears only from z4.
      {
        id: "boundary-state",
        type: "line",
        source: src,
        "source-layer": "boundary",
        minzoom: 4,
        filter: [
          "all",
          ["==", ["get", "admin_level"], 4],
          ["!=", ["get", "maritime"], 1],
        ],
        layout: { "line-join": "round" },
        paint: {
          "line-color": c.borderAdmin,
          "line-dasharray": [2, 2],
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.3, 8, 0.7],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 5, 0.35, 9, 0.5],
        },
      },

      // Country — thin solid grey.
      {
        id: "boundary-country",
        type: "line",
        source: src,
        "source-layer": "boundary",
        filter: [
          "all",
          ["==", ["get", "admin_level"], 2],
          ["!=", ["get", "maritime"], 1],
        ],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": c.borderCountry,
          "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.4, 6, 0.85, 10, 1.4],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.45, 6, 0.68],
        },
      },

      // Major roads — high zoom only, very dim.
      {
        id: "roads-major",
        type: "line",
        source: src,
        "source-layer": "transportation",
        minzoom: 7,
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": c.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.3, 12, 1.4],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 9, 0.6],
        },
      },

      // Water labels — italic, dimmest.
      {
        id: "label-water",
        type: "symbol",
        source: src,
        "source-layer": "water_name",
        minzoom: 2,
        layout: {
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 13, 9, 15],
          "text-letter-spacing": 0.1,
          "text-max-width": 6,
        },
        paint: {
          "text-color": c.textWater,
          "text-halo-color": c.halo,
          "text-halo-width": 1.1,
          "text-halo-blur": 0.6,
        },
      },

      // City labels + dots (collision + rank give natural progressive disclosure).
      {
        id: "label-city",
        type: "symbol",
        source: src,
        "source-layer": "place",
        minzoom: 4,
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        layout: {
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 8, 12.5],
          "text-anchor": "left",
          "text-offset": [0.6, 0],
          "text-optional": true,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: {
          "text-color": c.textCity,
          "text-halo-color": c.halo,
          "text-halo-width": 1.1,
          "text-halo-blur": 0.4,
        },
      },

      {
        id: "dot-city",
        type: "circle",
        source: src,
        "source-layer": "place",
        minzoom: 4,
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 8, 2.6],
          "circle-color": c.dotCity,
          "circle-opacity": 0.65,
          "circle-stroke-color": c.halo,
          "circle-stroke-width": 1,
        },
      },

      {
        id: "dot-capital",
        type: "circle",
        source: src,
        "source-layer": "place",
        minzoom: 3,
        filter: ["==", ["get", "capital"], 2],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 7, 3.4],
          "circle-color": c.dotCapital,
          "circle-opacity": 0.9,
          "circle-stroke-color": c.halo,
          "circle-stroke-width": 1.2,
        },
      },

      {
        id: "label-capital",
        type: "symbol",
        source: src,
        "source-layer": "place",
        minzoom: 3,
        filter: ["==", ["get", "capital"], 2],
        layout: {
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 7, 14],
          "text-anchor": "left",
          "text-offset": [0.7, 0],
          "text-optional": true,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: {
          "text-color": c.textCapital,
          "text-halo-color": c.halo,
          "text-halo-width": 1.2,
          "text-halo-blur": 0.4,
        },
      },

      // Country labels — upper-case, tracked, dim grey. Top of the basemap.
      {
        id: "label-country",
        type: "symbol",
        source: src,
        "source-layer": "place",
        minzoom: 2,
        filter: ["==", ["get", "class"], "country"],
        layout: {
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": ["Noto Sans Bold"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.18,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 4, 12, 7, 15],
          "text-max-width": 6,
          "text-padding": 6,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: {
          "text-color": c.textCountry,
          "text-halo-color": c.halo,
          "text-halo-width": 1.2,
          "text-halo-blur": 0.5,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.7, 5, 0.88],
        },
      },
    ],
  } as StyleSpecification;
}

/* Graticule — a faint lat/lng grid for the "command centre" feel. */
export function makeGraticule({
  lonStep = 20,
  latStep = 10,
  latMin = -56,
  latMax = 72,
}: {
  lonStep?: number;
  latStep?: number;
  latMin?: number;
  latMax?: number;
} = {}): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lon = -160; lon <= 160; lon += lonStep) {
    const coords: GeoJSON.Position[] = [];
    for (let lat = latMin; lat <= latMax; lat += 2) coords.push([lon, lat]);
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    });
  }
  for (let lat = Math.ceil(latMin / latStep) * latStep; lat <= latMax; lat += latStep) {
    const coords: GeoJSON.Position[] = [];
    for (let lon = -170; lon <= 170; lon += 2) coords.push([lon, lat]);
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    });
  }
  return { type: "FeatureCollection", features };
}

/** Insert the faint graticule under the water labels. Mirrors `addGraticule()`. */
export function addGraticule(
  map: MapLibreMap,
  {
    color = ECHIS_COLORS.graticule,
    opacity = 0.045,
    before = "label-water",
  }: { color?: string; opacity?: number; before?: string } = {},
) {
  if (map.getSource("graticule")) return;
  map.addSource("graticule", { type: "geojson", data: makeGraticule() });
  map.addLayer(
    {
      id: "graticule",
      type: "line",
      source: "graticule",
      paint: { "line-color": color, "line-opacity": opacity, "line-width": 0.5 },
    },
    map.getLayer(before) ? before : undefined,
  );
}
