import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import {
  BASEMAP_CREDITS,
  filterLocations,
  globePoints,
  globeSize,
  globeZoom,
  hasFilters,
  nearbyLocations,
  noFilters,
  regionCameras,
  sameTarget,
  targetFor,
} from "@/lib/globe";
import { BASEMAP_TILES, globeStyle } from "@/lib/globe-style";
import { locationPhoto, siteImages } from "@/lib/images";
import { mapTypeLabels, markerSvg } from "@/lib/map-markers";
import {
  bharati,
  djupranen,
  himadri,
  kongsfjorden,
  maitri,
  realLocations,
  unplaced,
} from "@/test/map-locations";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("globe views", () => {
  it("looks at the stations in each region", () => {
    // Antarctica is centred between Maitri and Bharati, the Arctic on Svalbard.
    const [antarcticLongitude, antarcticLatitude] = regionCameras.antarctic.center;
    expect(antarcticLongitude).toBeGreaterThan(maitri.longitude as number);
    expect(antarcticLongitude).toBeLessThan(bharati.longitude as number);
    expect(antarcticLatitude).toBeLessThan(-60);
    const [arcticLongitude, arcticLatitude] = regionCameras.arctic.center;
    expect(Math.abs(arcticLongitude - (himadri.longitude as number))).toBeLessThan(1);
    expect(Math.abs(arcticLatitude - (himadri.latitude as number))).toBeLessThan(1);
    // The world view fits the whole globe in its box. The others zoom in.
    expect(regionCameras.global.size).toBeLessThan(1);
    expect(regionCameras.antarctic.size).toBeGreaterThan(1);
    expect(regionCameras.arctic.size).toBeGreaterThan(1);
  });

  it("draws the globe at the wanted size at any latitude", () => {
    for (const latitude of [0, 3, -76, 78.5]) {
      for (const size of [0.86, 1.7, 3.4]) {
        const zoom = globeZoom(size, latitude, 480);
        expect(globeSize(zoom, latitude, 480)).toBeCloseTo(size, 6);
      }
    }
    // Near a pole the same size needs a lower zoom.
    expect(globeZoom(1, -76, 480)).toBeLessThan(globeZoom(1, 0, 480));
    // A box that has no size yet still gives a usable zoom.
    expect(Number.isFinite(globeZoom(0.86, 3, 0))).toBe(true);
  });

  it("turns to the one match, the shared region, or the whole world", () => {
    expect(targetFor(realLocations)).toBe("global");
    expect(targetFor([maitri, bharati, djupranen])).toBe("antarctic");
    expect(targetFor([himadri, kongsfjorden])).toBe("arctic");
    expect(targetFor([maitri])).toEqual({ locationId: "maitri" });
    expect(targetFor([])).toBe("global");
    // A location without coordinates cannot be turned to.
    expect(targetFor([unplaced])).toBe("global");
    expect(targetFor([unplaced, himadri])).toEqual({ locationId: "himadri" });

    expect(sameTarget("arctic", "arctic")).toBe(true);
    expect(sameTarget("arctic", "global")).toBe(false);
    expect(sameTarget({ locationId: "maitri" }, { locationId: "maitri" })).toBe(true);
    expect(sameTarget({ locationId: "maitri" }, "antarctic")).toBe(false);
  });
});

describe("globe markers", () => {
  it("names each point for the eye and for a screen reader", () => {
    const points = globePoints([...realLocations, unplaced]);

    expect(points.map((point) => [point.name, point.label])).toEqual([
      ["Bharati", "Bharati research station, Antarctica"],
      ["Djupranen Ice Rise", "Djupranen Ice Rise other repository location, Antarctica"],
      ["Himadri", "Himadri research station, Arctic"],
      ["Kongsfjorden", "Kongsfjorden expedition location, Arctic"],
      ["Maitri", "Maitri research station, Antarctica"],
    ]);
    // The stored coordinates are passed on untouched.
    const point = points.find((item) => item.id === "maitri");
    expect([point?.latitude, point?.longitude]).toEqual([-70.764444, 11.734167]);
  });

  it("gives each type its own shape, and the selected marker an outline", () => {
    const station = markerSvg("station");
    const expedition = markerSvg("expedition_location");
    const other = markerSvg("other");

    // A filled circle with a flag, an open ring, and a diamond.
    expect(station).toContain('<circle cx="16" cy="16" r="11" fill="#075985"');
    expect(expedition).toContain('fill="#ffffff" stroke="#075985"');
    expect(other).toContain("<path d=\"M16 5 27 16 16 27 5 16Z\"");
    expect(new Set([station, expedition, other]).size).toBe(3);
    expect(markerSvg("station", true)).not.toBe(station);
    expect(markerSvg("station", true)).toContain('r="14.5"');
    expect(Object.values(mapTypeLabels)).toEqual([
      "Research station",
      "Expedition location",
      "Other repository location",
    ]);
  });

  it("finds locations whose markers overlap", () => {
    // Himadri and the Kongsfjorden mooring site are about 2 km apart.
    expect(nearbyLocations(himadri, realLocations).map((item) => item.id)).toEqual([
      "kongsfjorden",
    ]);
    expect(nearbyLocations(kongsfjorden, realLocations).map((item) => item.id)).toEqual([
      "himadri",
    ]);
    // Maitri and the Djupranen Ice Rise are about 115 km apart.
    expect(nearbyLocations(maitri, realLocations)).toEqual([]);
    expect(nearbyLocations(unplaced, realLocations)).toEqual([]);
  });
});

describe("map filters", () => {
  it("search by name, region or station name", () => {
    const find = (query: string) =>
      filterLocations(realLocations, { ...noFilters, query }).map((item) => item.id);

    expect(find("Maitri")).toEqual(["maitri"]);
    expect(find("  himadri ")).toEqual(["himadri"]);
    expect(find("arctic")).toEqual(["himadri", "kongsfjorden"]);
    expect(find("nowhere")).toEqual([]);
    expect(hasFilters(noFilters)).toBe(false);
    expect(hasFilters({ ...noFilters, query: " " })).toBe(false);
    expect(hasFilters({ ...noFilters, query: "x" })).toBe(true);
  });

  it("filter by type, expedition and topic", () => {
    const ids = (filters: Partial<typeof noFilters>) =>
      filterLocations(realLocations, { ...noFilters, ...filters }).map((item) => item.id);

    expect(ids({ type: "station" })).toEqual(["bharati", "himadri", "maitri"]);
    expect(ids({ type: "other" })).toEqual(["djupranen"]);
    expect(ids({ expeditionId: "arctic-15" })).toEqual(["himadri", "kongsfjorden"]);
    expect(ids({ expeditionId: "isea-41" })).toEqual(["bharati", "maitri"]);
    expect(ids({ topicId: "atmosphere", type: "station" })).toEqual(["himadri"]);
  });
});

describe("location photographs", () => {
  it("shows only what a licensed photograph really shows", () => {
    expect(locationPhoto(maitri)?.image).toBe(siteImages.maitriStation);
    // The photograph is of the settlement, not of the Himadri building.
    expect(locationPhoto(himadri)).toEqual({
      image: siteImages.nyAlesund,
      caption: "Ny-Ålesund, where Himadri is located.",
    });
    expect(locationPhoto(kongsfjorden)?.image).toBe(siteImages.kongsfjordenShore);
    // No licensed photograph of Bharati exists, so none is shown.
    expect(locationPhoto(bharati)).toBeNull();
    expect(locationPhoto(djupranen)).toBeNull();
    expect(locationPhoto(unplaced)).toBeNull();
  });
});

describe("map library and basemap", () => {
  it("draws a globe from a keyless basemap, with its attribution", () => {
    expect(globeStyle.projection).toEqual({ type: "globe" });
    expect(BASEMAP_TILES).toBe("https://tiles.openfreemap.org/planet");
    expect(JSON.stringify(globeStyle)).not.toMatch(/api[_-]?key|access_token|token=/i);
    expect(BASEMAP_CREDITS.map((credit) => credit.name)).toEqual([
      "OpenFreeMap",
      "© OpenMapTiles",
      "© OpenStreetMap contributors",
    ]);
    // Land, water, ice and a few names. No borders, roads or buildings.
    expect(globeStyle.layers.map((layer) => layer.id)).toEqual([
      "land",
      "water",
      "ice",
      "ocean-names",
      "continent-names",
      "country-names",
      "place-names",
    ]);
  });

  it("uses MapLibre and no longer depends on Leaflet", () => {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    expect(Object.keys(dependencies).filter((name) => /leaflet/i.test(name))).toEqual([]);
    // An exact version: the worker files in public/maplibre belong to it.
    expect(packageJson.dependencies["maplibre-gl"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("serves the worker files of the installed MapLibre version", () => {
    for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
      const served = fs.readFileSync(path.join(ROOT, "public/maplibre", file));
      const packaged = fs.readFileSync(path.join(ROOT, "node_modules/maplibre-gl/dist", file));
      // After upgrading maplibre-gl, run: npm run maplibre:worker
      expect(served.equals(packaged), `${file} is out of date`).toBe(true);
    }
    expect(fs.existsSync(path.join(ROOT, "public/maplibre/LICENSE.txt"))).toBe(true);
  });
});
