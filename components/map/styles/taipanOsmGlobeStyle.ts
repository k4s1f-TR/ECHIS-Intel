import type { StyleSpecification } from "maplibre-gl";

// Accepted OSM-derived basemap is the default. CARTO remains available via
// NEXT_PUBLIC_TAIPAN_USE_CARTO_BASEMAP=1 for fallback testing.
const USE_TAIPAN_CARTO_BASEMAP =
  process.env.NEXT_PUBLIC_TAIPAN_USE_CARTO_BASEMAP === "1" ||
  process.env.NEXT_PUBLIC_TAIPAN_USE_CARTO_BASEMAP === "true";
export const USE_TAIPAN_OSM_BASEMAP =
  !USE_TAIPAN_CARTO_BASEMAP;

export const OSM_VECTOR_SOURCE_ID = "openfreemap-osm";

const OSM_VECTOR_TILEJSON_URL = "https://tiles.openfreemap.org/planet";
const OSM_ATTRIBUTION =
  '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
// Sub-national (state / province / district) lines sit *below* national
// borders in the visual hierarchy, so their grey is kept dimmer than the
// country border colour passed in via `borderCountry`.
const OSM_ADMIN_BOUNDARY = "rgba(142, 154, 150, 0.55)";

export type TaipanOsmGlobeStylePalette = {
  landFill: string;
  landOverlay: string;
  waterFill: string;
  waterwayFill: string;
  borderCountry: string;
  labelHalo: string;
};

export function createTaipanOsmGlobeStyle({
  landFill,
  landOverlay,
  waterFill,
  waterwayFill,
  borderCountry,
  labelHalo,
}: TaipanOsmGlobeStylePalette): StyleSpecification {
  const sourceLayer = (name: string) => ({
    source: OSM_VECTOR_SOURCE_ID,
    "source-layer": name,
  });

  return {
    version: 8,
    name: "TaipanMonitor OSM Dark",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      [OSM_VECTOR_SOURCE_ID]: {
        type: "vector",
        url: OSM_VECTOR_TILEJSON_URL,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": landFill },
      },
      {
        id: "landcover_glacier",
        type: "fill",
        ...sourceLayer("landcover"),
        filter: ["==", ["get", "class"], "ice"],
        paint: { "fill-color": landOverlay, "fill-opacity": 0.22 },
      },
      {
        id: "landuse_overlay",
        type: "fill",
        ...sourceLayer("landuse"),
        paint: { "fill-color": landOverlay, "fill-opacity": 0.25 },
      },
      {
        id: "park_overlay",
        type: "fill",
        ...sourceLayer("park"),
        paint: { "fill-color": landOverlay, "fill-opacity": 0.22 },
      },
      {
        id: "water",
        type: "fill",
        ...sourceLayer("water"),
        paint: { "fill-color": waterFill, "fill-opacity": 1 },
      },
      {
        id: "waterway",
        type: "line",
        ...sourceLayer("waterway"),
        minzoom: 4,
        paint: {
          "line-color": waterwayFill,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 9, 0.9],
          "line-opacity": 0.45,
        },
      },
      {
        id: "boundary_regional_admin",
        type: "line",
        ...sourceLayer("boundary"),
        minzoom: 3.2,
        filter: [
          "all",
          [">=", ["to-number", ["get", "admin_level"], 99], 3],
          ["<=", ["to-number", ["get", "admin_level"], 99], 6],
          ["!=", ["get", "maritime"], 1],
        ],
        paint: {
          "line-color": OSM_ADMIN_BOUNDARY,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3.2, 0.3, 5.5, 0.5, 8, 0.7],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 3.2, 0, 4.2, 0.48, 7, 0.72],
          // Sub-national borders use a dashed pattern (vs. the solid national
          // border) — the standard political-map convention.  This also makes
          // any segment crossing a lake (e.g. provinces meeting inside Van
          // Gölü / Tuz Gölü) read as an administrative line rather than a
          // coastline, so water and border no longer visually merge.
          "line-dasharray": [2.6, 1.8],
        },
      },
      {
        id: "boundary_local_admin",
        type: "line",
        ...sourceLayer("boundary"),
        minzoom: 5.4,
        filter: [
          "all",
          [">=", ["to-number", ["get", "admin_level"], 99], 7],
          ["!=", ["get", "maritime"], 1],
        ],
        paint: {
          "line-color": OSM_ADMIN_BOUNDARY,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5.4, 0.28, 8, 0.55, 11, 0.75],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 5.4, 0, 6.4, 0.34, 10, 0.58],
          // Dashed to match the regional admin line and the national-solid /
          // internal-dashed convention (see boundary_regional_admin).
          "line-dasharray": [2.2, 1.8],
        },
      },
      {
        id: "boundary_country",
        type: "line",
        ...sourceLayer("boundary"),
        filter: [
          "all",
          // Coerce admin_level to a number before comparing — some vector
          // tile sources encode it as a string ("2"), which a strict `==` 2
          // would silently miss and drop every national border.  Matches the
          // defensive pattern used by the regional / local admin layers.
          ["==", ["to-number", ["get", "admin_level"], 99], 2],
          ["!=", ["get", "maritime"], 1],
        ],
        paint: {
          "line-color": borderCountry,
          "line-width": 0.8,
          "line-opacity": 0.9,
        },
      },
      {
        id: "road_minor",
        type: "line",
        ...sourceLayer("transportation"),
        minzoom: 8,
        filter: [
          "match",
          ["get", "class"],
          ["minor", "service", "track", "path"],
          true,
          false,
        ],
        paint: {
          "line-color": "rgba(96, 104, 102, 0.20)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.25, 13, 0.8],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 0.2, 13, 0.36],
        },
      },
      {
        id: "road_major",
        type: "line",
        ...sourceLayer("transportation"),
        minzoom: 7,
        filter: [
          "match",
          ["get", "class"],
          ["motorway", "trunk", "primary"],
          true,
          false,
        ],
        paint: {
          "line-color": "rgba(118, 126, 122, 0.23)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.3, 13, 1.1],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 0.28, 13, 0.42],
        },
      },
      {
        id: "water_name",
        type: "symbol",
        ...sourceLayer("water_name"),
        minzoom: 2.2,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 8.5, 6, 11],
          "symbol-placement": "point",
          "text-letter-spacing": 0.03,
          "text-padding": 6,
        },
        paint: {
          "text-color": "rgba(122, 136, 140, 0.50)",
          "text-halo-color": labelHalo,
          "text-halo-width": 0.8,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.35, 6, 0.48],
        },
      },
      {
        id: "place_country_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: ["==", ["get", "class"], "country"],
        minzoom: 0,
        maxzoom: 7,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1.5, 11.5, 5, 15],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.11,
          "text-max-width": 7,
          "text-padding": 8,
        },
        paint: {
          "text-color": "rgba(196, 202, 198, 0.82)",
          "text-halo-color": labelHalo,
          "text-halo-width": 1,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.82, 6, 0.88],
        },
      },
      {
        id: "place_region_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: ["==", ["get", "class"], "state"],
        minzoom: 4.6,
        maxzoom: 8,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4.6, 9, 8, 11.5],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 6.5,
          "text-padding": 10,
        },
        paint: {
          "text-color": "rgba(174, 184, 180, 0.64)",
          "text-halo-color": labelHalo,
          "text-halo-width": 0.95,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 4.6, 0, 5.3, 0.54, 8, 0.66],
        },
      },
      {
        id: "place_capital_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: [
          "all",
          ["==", ["get", "class"], "city"],
          ["==", ["to-number", ["get", "capital"], 0], 2],
        ],
        minzoom: 3,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.8, 7, 13.2],
          "text-max-width": 7.5,
          "text-padding": 12,
          "symbol-sort-key": ["to-number", ["get", "rank"], 99],
        },
        paint: {
          "text-color": "rgba(190, 200, 195, 0.82)",
          "text-halo-color": labelHalo,
          "text-halo-width": 1,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0, 3.6, 0.7, 7, 0.82],
        },
      },
      {
        id: "place_major_city_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: [
          "all",
          ["==", ["get", "class"], "city"],
          ["!=", ["to-number", ["get", "capital"], 0], 2],
          ["<=", ["to-number", ["get", "rank"], 99], 4],
        ],
        minzoom: 3.9,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3.9, 9.8, 8, 12.4],
          "text-max-width": 7.5,
          "text-padding": 14,
          "symbol-sort-key": ["to-number", ["get", "rank"], 99],
        },
        paint: {
          "text-color": "rgba(182, 192, 187, 0.76)",
          "text-halo-color": labelHalo,
          "text-halo-width": 1,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 3.9, 0, 4.6, 0.62, 8, 0.76],
        },
      },
      {
        id: "place_regional_city_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: [
          "all",
          [
            "any",
            [
              "all",
              ["==", ["get", "class"], "city"],
              [">", ["to-number", ["get", "rank"], 99], 4],
            ],
            [
              "all",
              ["==", ["get", "class"], "town"],
              ["<=", ["to-number", ["get", "rank"], 99], 6],
            ],
          ],
        ],
        minzoom: 4.9,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4.9, 8.8, 9, 11.7],
          "text-max-width": 7,
          "text-padding": 14,
          "symbol-sort-key": ["to-number", ["get", "rank"], 99],
        },
        paint: {
          "text-color": "rgba(172, 182, 178, 0.70)",
          "text-halo-color": labelHalo,
          "text-halo-width": 0.9,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 4.9, 0, 5.7, 0.54, 9, 0.70],
        },
      },
      {
        id: "place_town_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: [
          "all",
          ["==", ["get", "class"], "town"],
          [">", ["to-number", ["get", "rank"], 99], 6],
        ],
        minzoom: 6.6,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6.6, 8.5, 10, 10.9],
          "text-max-width": 7,
          "text-padding": 16,
          "symbol-sort-key": ["to-number", ["get", "rank"], 99],
        },
        paint: {
          "text-color": "rgba(164, 174, 170, 0.62)",
          "text-halo-color": labelHalo,
          "text-halo-width": 0.85,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 6.6, 0, 7.4, 0.46, 10, 0.62],
        },
      },
      {
        id: "place_minor_label",
        type: "symbol",
        ...sourceLayer("place"),
        filter: [
          "all",
          [
            "match",
            ["get", "class"],
            ["village", "suburb"],
            true,
            false,
          ],
        ],
        minzoom: 8.2,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name_en"],
            ["get", "name:en"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8.2, 8, 11, 10.4],
          "text-max-width": 6.5,
          "text-padding": 18,
          "symbol-sort-key": ["to-number", ["get", "rank"], 99],
        },
        paint: {
          "text-color": "rgba(156, 166, 162, 0.54)",
          "text-halo-color": labelHalo,
          "text-halo-width": 0.8,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 8.2, 0, 9, 0.34, 11, 0.54],
        },
      },
    ],
  };
}
