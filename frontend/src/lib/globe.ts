// Plain helpers for the Polar Map globe. Nothing here needs the map library,
// so the page, the Lite Mode list and the tests can all use it.

import { mapTypeLabels } from "@/lib/map-markers";
import type { MapLocation, MapLocationType } from "@/lib/types";

export type GlobeRegion = "global" | "antarctic" | "arctic";

// What the globe should look at: a whole region, or one location.
export type GlobeTarget = GlobeRegion | { locationId: string };

export type GlobePoint = {
  id: string;
  // Short name drawn beside the marker.
  name: string;
  // What a screen reader says for the marker.
  label: string;
  latitude: number;
  longitude: number;
  type: MapLocationType;
};

// A request to turn the globe. A new key asks for the same target again.
export type GlobeCameraRequest = {
  target: GlobeTarget;
  key: number;
};

// Who the map data comes from. Shown under the globe at all times.
export const BASEMAP_CREDITS = [
  { name: "OpenFreeMap", url: "https://openfreemap.org" },
  { name: "© OpenMapTiles", url: "https://www.openmaptiles.org/" },
  { name: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
];

export type GlobeCamera = {
  center: [longitude: number, latitude: number];
  // How wide the whole globe is drawn, as a share of the shorter side of its
  // box. 1 fits the globe in the box, 2 shows about half of it.
  size: number;
};

// The three views were chosen by eye so that the stations are easy to see:
// the world with India near the middle, Antarctica with Maitri and Bharati on
// either side, and Svalbard for Himadri.
export const regionCameras: Record<GlobeRegion, GlobeCamera> = {
  global: { center: [48, 3], size: 0.86 },
  antarctic: { center: [44, -76], size: 1.7 },
  arctic: { center: [12, 78.5], size: 2.1 },
};

export const LOCATION_SIZE = 3.4;

export const regionLabels: Record<GlobeRegion, string> = {
  global: "Global",
  antarctic: "Antarctica",
  arctic: "Arctic",
};

// How wide the globe looks on screen, measured with the narrow camera angle
// that polar-globe.tsx sets: about 0.92 of the 512 x 2^zoom / pi that the tile
// size alone would give. The rest is hidden behind the edge of the sphere.
const DRAWN = 0.92;

function latitudeShift(latitude: number): number {
  // The library draws the globe larger when the view is centred near a pole.
  const clamped = Math.min(Math.abs(latitude), 85);
  return Math.log2(Math.cos((clamped * Math.PI) / 180));
}

// The zoom that draws the globe at the wanted size, wherever it is centred.
export function globeZoom(size: number, latitude: number, boxPixels: number): number {
  const diameter = size * Math.max(boxPixels, 240);
  return Math.log2((diameter * Math.PI) / (512 * DRAWN)) + latitudeShift(latitude);
}

// The reverse: how large the globe is drawn at a zoom and latitude.
export function globeSize(zoom: number, latitude: number, boxPixels: number): number {
  const diameter = (DRAWN * 512 * 2 ** (zoom - latitudeShift(latitude))) / Math.PI;
  return diameter / Math.max(boxPixels, 240);
}

function shortName(location: MapLocation): string {
  // A station is known by its own name: "Maitri", not "Maitri Station".
  return location.stations[0]?.name ?? location.name.replace(/\s*\(.*\)$/, "");
}

export function globePoints(locations: MapLocation[]): GlobePoint[] {
  const points: GlobePoint[] = [];
  for (const location of locations) {
    if (!location.mappable || location.latitude === null || location.longitude === null) {
      continue;
    }
    const name = shortName(location);
    const kind = mapTypeLabels[location.location_type].toLowerCase();
    points.push({
      id: location.id,
      name,
      label: location.region ? `${name} ${kind}, ${location.region}` : `${name} ${kind}`,
      latitude: location.latitude,
      longitude: location.longitude,
      type: location.location_type,
    });
  }
  return points;
}

export type MapFilters = {
  query: string;
  type: MapLocationType | "all";
  expeditionId: string;
  topicId: string;
};

export const noFilters: MapFilters = { query: "", type: "all", expeditionId: "", topicId: "" };

export function hasFilters(filters: MapFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.type !== "all" ||
    filters.expeditionId !== "" ||
    filters.topicId !== ""
  );
}

export function filterLocations(locations: MapLocation[], filters: MapFilters): MapLocation[] {
  const search = filters.query.trim().toLowerCase();
  return locations.filter(
    (location) =>
      (filters.type === "all" || location.location_type === filters.type) &&
      (filters.expeditionId === "" ||
        location.expeditions.some((item) => item.id === filters.expeditionId)) &&
      (filters.topicId === "" ||
        location.research_topics.some((item) => item.id === filters.topicId)) &&
      (search === "" ||
        [location.name, ...location.stations.map((item) => item.name)].some((text) =>
          text.toLowerCase().includes(search),
        ) ||
        // A region matches from the start of a word, so that "arctic" does
        // not also find "Antarctica".
        (location.region ?? "")
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.startsWith(search))),
  );
}

// Where the globe should turn to show a set of locations: the one location,
// the polar region they share, or the whole world.
export function targetFor(locations: MapLocation[]): GlobeTarget {
  const shown = locations.filter((location) => location.mappable);
  if (shown.length === 1) {
    return { locationId: shown[0].id };
  }
  const regions = new Set(shown.map((location) => location.polar_region));
  const [only] = regions;
  if (shown.length > 0 && regions.size === 1 && (only === "antarctic" || only === "arctic")) {
    return only;
  }
  return "global";
}

export function sameTarget(a: GlobeTarget, b: GlobeTarget): boolean {
  if (typeof a === "string" || typeof b === "string") {
    return a === b;
  }
  return a.locationId === b.locationId;
}

function kilometresBetween(a: MapLocation, b: MapLocation): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) {
    return null;
  }
  const radians = Math.PI / 180;
  const half =
    Math.sin(((b.latitude - a.latitude) * radians) / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(((b.longitude - a.longitude) * radians) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(half));
}

// Locations so close to this one that their markers overlap until the globe
// is zoomed far in. The details panel offers them as buttons.
export function nearbyLocations(
  location: MapLocation,
  all: MapLocation[],
  withinKilometres = 25,
): MapLocation[] {
  return all.filter((other) => {
    if (other.id === location.id) return false;
    const distance = kilometresBetween(location, other);
    return distance !== null && distance <= withinKilometres;
  });
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
