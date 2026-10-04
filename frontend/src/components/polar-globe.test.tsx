import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PolarGlobe from "@/components/polar-globe";
import {
  type GlobeCameraRequest,
  LOCATION_SIZE,
  globePoints,
  globeZoom,
  regionCameras,
} from "@/lib/globe";
import { realLocations } from "@/test/map-locations";

type CameraOptions = { center?: [number, number]; zoom?: number; duration?: number };
type Handler = (event: Record<string, unknown>) => void;

// A stand-in for the map library. No WebGL, no worker and no tile request.
const fake = vi.hoisted(() => {
  const state = {
    maps: [] as FakeMap[],
    markers: [] as FakeMarker[],
    workerUrl: null as string | null,
    failToStart: false,
  };

  class FakeMap {
    options: Record<string, unknown>;
    container: HTMLElement;
    handlers: Record<string, Handler[]> = {};
    controls: { control: { kind: string; options: unknown }; position: string }[] = [];
    center: { lng: number; lat: number };
    zoom: number;
    canvas = document.createElement("canvas");
    removed = false;
    jumps: CameraOptions[] = [];
    flights: CameraOptions[] = [];
    fieldOfView: number | null = null;
    stops = 0;
    touchZoomRotate = { disableRotation: vi.fn() };
    keyboard = { disableRotation: vi.fn() };

    constructor(options: Record<string, unknown>) {
      if (state.failToStart) {
        throw new Error("Failed to initialize WebGL");
      }
      this.options = options;
      this.container = options.container as HTMLElement;
      const [lng, lat] = options.center as [number, number];
      this.center = { lng, lat };
      this.zoom = options.zoom as number;
      state.maps.push(this);
    }
    on(name: string, handler: Handler) {
      (this.handlers[name] ??= []).push(handler);
      return this;
    }
    once(name: string, handler: Handler) {
      return this.on(name, handler);
    }
    fire(name: string, event: Record<string, unknown> = {}) {
      for (const handler of this.handlers[name] ?? []) handler(event);
    }
    addControl(control: { kind: string; options: unknown }, position: string) {
      this.controls.push({ control, position });
      return this;
    }
    setVerticalFieldOfView(degrees: number) {
      this.fieldOfView = degrees;
      return this;
    }
    getCanvas() {
      return this.canvas;
    }
    getContainer() {
      return this.container;
    }
    getZoom() {
      return this.zoom;
    }
    getCenter() {
      return this.center;
    }
    move(options: CameraOptions) {
      if (options.center) this.center = { lng: options.center[0], lat: options.center[1] };
      if (options.zoom !== undefined) this.zoom = options.zoom;
    }
    jumpTo(options: CameraOptions) {
      this.jumps.push(options);
      this.move(options);
      this.fire("move");
      return this;
    }
    flyTo(options: CameraOptions) {
      this.flights.push(options);
      this.move(options);
      this.fire("move");
      return this;
    }
    stop() {
      this.stops += 1;
      return this;
    }
    remove() {
      this.removed = true;
    }
  }

  class FakeMarker {
    element: HTMLElement;
    options: Record<string, unknown>;
    lngLat: [number, number] | null = null;
    removed = false;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.element = options.element as HTMLElement;
      state.markers.push(this);
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat;
      return this;
    }
    addTo(map: FakeMap) {
      map.container.append(this.element);
      return this;
    }
    getElement() {
      return this.element;
    }
    remove() {
      this.removed = true;
      this.element.remove();
    }
  }

  class FakeControl {
    kind: string;
    options: unknown;
    constructor(kind: string, options: unknown) {
      this.kind = kind;
      this.options = options;
    }
  }

  return { state, FakeMap, FakeMarker, FakeControl };
});

vi.mock("maplibre-gl", () => ({
  Map: fake.FakeMap,
  Marker: fake.FakeMarker,
  NavigationControl: class extends fake.FakeControl {
    constructor(options: unknown) {
      super("navigation", options);
    }
  },
  AttributionControl: class extends fake.FakeControl {
    constructor(options: unknown) {
      super("attribution", options);
    }
  },
  setWorkerUrl: (url: string) => {
    fake.state.workerUrl = url;
  },
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const points = globePoints(realLocations);
const onSelect = vi.fn();
const onUserMove = vi.fn();
const onUnavailable = vi.fn();

// Animation frames are run by hand, so the opening turn can be followed.
let frames: FrameRequestCallback[] = [];
let clock = 0;
function runFrames(count: number, milliseconds = 100) {
  for (let index = 0; index < count && frames.length > 0; index += 1) {
    clock += milliseconds;
    const callbacks = frames;
    frames = [];
    for (const callback of callbacks) callback(clock);
  }
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
  })) as typeof window.matchMedia;
}

// Set to false to keep the map in the moment before its style has loaded.
let styleLoads = true;

function show(
  camera: GlobeCameraRequest = { target: "global", key: 0 },
  selectedId: string | null = null,
  shown = points,
) {
  const element = (next: GlobeCameraRequest, selected: string | null, list = shown) => (
    <PolarGlobe
      camera={next}
      onSelect={onSelect}
      onUnavailable={onUnavailable}
      onUserMove={onUserMove}
      points={list}
      selectedId={selected}
    />
  );
  const view = render(element(camera, selectedId));
  if (styleLoads) {
    map()?.fire("style.load");
  }
  return {
    ...view,
    update: (next: GlobeCameraRequest, selected: string | null = selectedId, list = shown) =>
      view.rerender(element(next, selected, list)),
  };
}

const map = () => fake.state.maps[fake.state.maps.length - 1];
const marker = (label: string) =>
  document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
// The box has no size in the tests, so the smallest box is assumed.
const zoomFor = (size: number, latitude: number) => globeZoom(size, latitude, 0);

beforeEach(() => {
  fake.state.maps = [];
  fake.state.markers = [];
  fake.state.workerUrl = null;
  fake.state.failToStart = false;
  styleLoads = true;
  frames = [];
  clock = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("globe", () => {
  it("starts a MapLibre globe with a keyless basemap and visible attribution", () => {
    show();

    const options = map().options as {
      style: { projection: unknown; sources: Record<string, { url: string }> };
    } & Record<string, unknown>;
    expect(options.style.projection).toEqual({ type: "globe" });
    expect(options.style.sources.basemap.url).toBe("https://tiles.openfreemap.org/planet");
    expect(fake.state.workerUrl).toBe("/maplibre/maplibre-gl-worker.mjs");
    // The page keeps scrolling over the globe, and the globe is never tilted.
    expect(options.cooperativeGestures).toBe(true);
    expect(options.dragRotate).toBe(false);
    expect(options.maxPitch).toBe(0);
    expect(map().touchZoomRotate.disableRotation).toHaveBeenCalled();
    // A narrow camera angle, so both polar regions fit in the world view.
    expect(map().fieldOfView).toBe(12);
    // Only zoom buttons and the attribution. No compass, no measuring tools.
    expect(map().controls.map((item) => [item.control.kind, item.control.options])).toEqual([
      ["navigation", { showCompass: false }],
      ["attribution", { compact: true }],
    ]);
    expect(map().canvas.getAttribute("aria-label")).toMatch(/^Interactive globe of polar research locations/);
  });

  it("puts one labelled marker on each real location", () => {
    show();

    expect(fake.state.markers.map((item) => [item.element.getAttribute("aria-label"), item.lngLat])).toEqual([
      ["Bharati research station, Antarctica", [76.195333, -69.406833]],
      ["Djupranen Ice Rise other repository location, Antarctica", [9.18, -70.18]],
      ["Himadri research station, Arctic", [11.933333, 78.916667]],
      ["Kongsfjorden expedition location, Arctic", [12, 78.933333]],
      ["Maitri research station, Antarctica", [11.734167, -70.764444]],
    ]);
    const maitri = marker("Maitri research station, Antarctica");
    // A real button: it can be reached and pressed from the keyboard.
    expect(maitri.tagName).toBe("BUTTON");
    expect(maitri.dataset.type).toBe("station");
    expect(maitri.querySelector(".globe-marker-name")?.textContent).toBe("Maitri");
    expect(maitri.querySelector("svg")).toBeTruthy();
    // A marker on the far side of the globe is hidden, not faded.
    expect(fake.state.markers[0].options.opacityWhenCovered).toBe("0");
    // The three types are drawn differently.
    const shapes = ["Maitri research station, Antarctica", "Kongsfjorden expedition location, Arctic", "Djupranen Ice Rise other repository location, Antarctica"].map(
      (label) => marker(label).querySelector("svg")?.innerHTML,
    );
    expect(new Set(shapes).size).toBe(3);
  });

  it("reports the marker that is pressed, and marks the selected one", () => {
    const view = show();

    fireEvent.click(marker("Bharati research station, Antarctica"));
    expect(onSelect).toHaveBeenCalledWith("bharati");

    view.update({ target: "global", key: 0 }, "bharati");
    const bharati = marker("Bharati research station, Antarctica");
    expect(bharati.dataset.selected).toBe("true");
    expect(bharati.getAttribute("aria-pressed")).toBe("true");
    expect(marker("Maitri research station, Antarctica").dataset.selected).toBe("false");
    // The same five markers are kept. None is drawn twice.
    expect(fake.state.markers).toHaveLength(5);
  });

  it("removes the markers that a filter hides", () => {
    const view = show();

    view.update({ target: "global", key: 0 }, null, points.filter((point) => point.type === "station"));

    expect(document.querySelectorAll(".globe-marker")).toHaveLength(3);
    expect(marker("Kongsfjorden expedition location, Arctic")).toBeNull();
  });

  it("shows station names when the view is close, and all names when closer", () => {
    show();
    const box = map().container;
    expect(box.dataset.names).toBe("none");

    map().jumpTo({ center: [44, -76], zoom: zoomFor(1.7, -76) });
    expect(box.dataset.names).toBe("stations");

    map().jumpTo({ center: [12, 78.9], zoom: zoomFor(14, 78.9) });
    expect(box.dataset.names).toBe("all");
  });
});

describe("globe camera", () => {
  it("opens on the world and flies to Antarctica, the Arctic and back", () => {
    const view = show();
    const global = regionCameras.global;
    expect(map().options.center).toEqual(global.center);
    expect(map().options.zoom).toBe(zoomFor(global.size, global.center[1]));

    view.update({ target: "antarctic", key: 1 });
    expect(map().flights).toHaveLength(1);
    expect(map().flights[0]).toMatchObject({
      center: [44, -76],
      zoom: zoomFor(regionCameras.antarctic.size, -76),
      bearing: 0,
      pitch: 0,
    });

    view.update({ target: "arctic", key: 2 });
    expect(map().flights[1]).toMatchObject({ center: [12, 78.5] });

    view.update({ target: "global", key: 3 });
    expect(map().flights[2]).toMatchObject({ center: global.center });
    // The same request is not carried out twice.
    view.update({ target: "global", key: 3 });
    expect(map().flights).toHaveLength(3);
  });

  it("opens straight on the location of a link, and flies to a chosen one", () => {
    const view = show({ target: { locationId: "maitri" }, key: 0 }, "maitri");

    expect(map().jumps[0]).toEqual({
      center: [11.734167, -70.764444],
      zoom: zoomFor(LOCATION_SIZE, -70.764444),
    });
    // No opening turn when a link asked for one place.
    expect(frames).toHaveLength(0);

    view.update({ target: { locationId: "himadri" }, key: 1 }, "himadri");
    expect(map().flights[0]).toMatchObject({ center: [11.933333, 78.916667] });
  });

  it("turns slowly at first, ends on the world view and never starts again", () => {
    show();
    const end = regionCameras.global.center[0];
    // The turn starts a little to the west.
    expect(map().center.lng).toBe(end - 30);

    runFrames(11);
    expect(map().center.lng).toBeGreaterThan(end - 30);
    expect(map().center.lng).toBeLessThan(end - 28);

    runFrames(500);
    expect(map().center.lng).toBe(end);
    expect(frames).toHaveLength(0);
  });

  it("stops turning at the first touch, key or region button", () => {
    show();
    runFrames(5);
    const before = map().center.lng;

    fireEvent.pointerDown(map().container);
    runFrames(20);
    expect(map().center.lng).toBe(before);
    expect(frames).toHaveLength(0);

    cleanup();
    const view = show();
    runFrames(5);
    view.update({ target: "antarctic", key: 1 });
    expect(map().stops).toBe(1);
    runFrames(20);
    expect(map().center).toEqual({ lng: 44, lat: -76 });

    cleanup();
    show();
    fireEvent.keyDown(map().container, { key: "ArrowLeft" });
    expect(frames).toHaveLength(0);
  });

  it("does not turn or fly when reduced motion is preferred", () => {
    setReducedMotion(true);
    const view = show();

    // The globe opens on the final world view and stays still.
    expect(frames).toHaveLength(0);
    expect(map().center.lng).toBe(regionCameras.global.center[0]);

    view.update({ target: "arctic", key: 1 });
    expect(map().flights).toHaveLength(0);
    expect(map().jumps[map().jumps.length - 1]).toMatchObject({ center: [12, 78.5], bearing: 0, pitch: 0 });
  });

  it("tells the page when the globe is moved by hand", () => {
    show();

    map().fire("movestart", {});
    expect(onUserMove).not.toHaveBeenCalled();

    map().fire("movestart", { originalEvent: new Event("mousedown") });
    expect(onUserMove).toHaveBeenCalledTimes(1);
  });
});

describe("globe failures", () => {
  it("reports that it cannot start without WebGL, and does not crash", () => {
    fake.state.failToStart = true;

    expect(() => show()).not.toThrow();

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(fake.state.maps).toHaveLength(0);
  });

  it("reports a basemap that never arrives, but not a later single error", () => {
    show();

    map().fire("error", { error: new Error("Failed to fetch") });
    expect(onUnavailable).toHaveBeenCalledTimes(1);

    cleanup();
    onUnavailable.mockClear();
    show();
    map().fire("data", { dataType: "source", tile: {} });
    map().fire("error", { error: new Error("one tile failed") });
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("waits for the globe shape before it turns to a place near a pole", () => {
    styleLoads = false;
    const view = show({ target: { locationId: "himadri" }, key: 0 }, "himadri");

    // A flat map cannot be centred this far north, so nothing is asked of it yet.
    expect(map().jumps).toHaveLength(0);
    view.update({ target: "antarctic", key: 1 });
    expect(map().flights).toHaveLength(0);

    map().fire("style.load");

    // The latest request is carried out, once.
    expect(map().jumps).toEqual([{ center: [44, -76], zoom: zoomFor(regionCameras.antarctic.size, -76) }]);
    expect(frames).toHaveLength(0);
    view.update({ target: "antarctic", key: 1 });
    expect(map().flights).toHaveLength(0);
  });

  it("removes the map and its markers when the page is left", () => {
    const view = show();
    const instance = map();

    view.unmount();

    expect(instance.removed).toBe(true);
    expect(fake.state.markers.every((item) => item.removed)).toBe(true);
    expect(frames).toHaveLength(0);
  });
});
