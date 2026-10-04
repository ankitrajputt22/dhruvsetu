// The look of the Polar Map globe. It is written for this site: a pale globe
// with a polar-blue ocean, white ice and few labels.
//
// Map data: vector tiles of OpenFreeMap (https://openfreemap.org), which are
// free to use without an API key. They follow the OpenMapTiles schema and are
// made from OpenStreetMap data. Attribution is required: the globe shows it,
// and the page repeats it under the globe (BASEMAP_CREDITS in globe.ts).
//
// National borders are left out on purpose. The map is about polar research
// locations, and borders drawn from OpenStreetMap would not match the official
// maps of every country.

import type { StyleSpecification } from "maplibre-gl";

export const BASEMAP_TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const OCEAN = "#bcd8ea";
const LAND = "#eef1ec";
const ICE = "#ffffff";
const LABEL = "#3f5568";
const HALO = "rgba(255, 255, 255, 0.85)";

const polygons = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const points = ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false];
const englishName = ["coalesce", ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];

export const globeStyle = {
  version: 8,
  name: "DhruvSetu polar globe",
  projection: { type: "globe" },
  // A thin, pale edge of atmosphere that fades out when zoomed in.
  sky: {
    "sky-color": "#9cc4e0",
    "horizon-color": "#dcecf7",
    "fog-color": "#dcecf7",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.4,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 4, 0.3, 7, 0],
  },
  glyphs: GLYPHS,
  sources: {
    basemap: { type: "vector", url: BASEMAP_TILES },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": LAND } },
    {
      id: "water",
      type: "fill",
      source: "basemap",
      "source-layer": "water",
      filter: ["all", polygons, ["!=", ["get", "brunnel"], "tunnel"]],
      // No outline: it would also be drawn along the seams between tiles.
      paint: { "fill-color": OCEAN },
    },
    {
      id: "ice",
      type: "fill",
      source: "basemap",
      "source-layer": "landcover",
      filter: ["all", polygons, ["in", ["get", "subclass"], ["literal", ["glacier", "ice_shelf"]]]],
      paint: { "fill-color": ICE },
    },
    {
      id: "ocean-names",
      type: "symbol",
      source: "basemap",
      "source-layer": "water_name",
      filter: ["all", points, ["in", ["get", "class"], ["literal", ["ocean", "sea"]]]],
      layout: {
        "text-field": englishName,
        "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 6, 13],
        "text-letter-spacing": 0.15,
        "text-max-width": 6,
      },
      paint: { "text-color": "#4a6f8c", "text-halo-color": "rgba(255, 255, 255, 0.6)", "text-halo-width": 1 },
    },
    {
      id: "continent-names",
      type: "symbol",
      source: "basemap",
      "source-layer": "place",
      maxzoom: 2.5,
      filter: ["==", ["get", "class"], "continent"],
      layout: {
        "text-field": englishName,
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.12,
      },
      paint: { "text-color": LABEL, "text-halo-color": HALO, "text-halo-width": 1.2 },
    },
    {
      id: "country-names",
      type: "symbol",
      source: "basemap",
      "source-layer": "place",
      minzoom: 2.5,
      maxzoom: 7,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": englishName,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2.5, 10, 6, 14],
        "text-max-width": 6,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": LABEL, "text-halo-color": HALO, "text-halo-width": 1.2 },
    },
    {
      id: "place-names",
      type: "symbol",
      source: "basemap",
      "source-layer": "place",
      minzoom: 6,
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "island"]]],
      layout: {
        "text-field": englishName,
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-max-width": 7,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": LABEL, "text-halo-color": HALO, "text-halo-width": 1.2 },
    },
  ],
} as StyleSpecification;
