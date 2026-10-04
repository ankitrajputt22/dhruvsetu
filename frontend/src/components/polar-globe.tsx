"use client";

import {
  AttributionControl,
  Map as GlobeMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { globeStyle } from "@/lib/globe-style";
import {
  type GlobeCameraRequest,
  type GlobePoint,
  type GlobeTarget,
  LOCATION_SIZE,
  globeSize,
  globeZoom,
  prefersReducedMotion,
  regionCameras,
} from "@/lib/globe";
import { markerSvg } from "@/lib/map-markers";

// The map library runs part of its work in a web worker and loads that code
// by address. The two files are copies from the package (see the README).
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

// A narrow camera angle shows almost a full half of the Earth, so the world
// view has the Arctic and the Antarctic stations in it at the same time. With
// the library's default of about 37 degrees both would be behind the edge.
const FIELD_OF_VIEW = 12;

// The opening turn: a short, slow drift that ends on the Global view.
const DRIFT_DEGREES = 30;
const DRIFT_DEGREES_PER_SECOND = 1.5;

type Props = {
  points: GlobePoint[];
  selectedId: string | null;
  camera: GlobeCameraRequest;
  onSelect: (id: string) => void;
  // The person moved the globe by hand, so no region button describes the view.
  onUserMove: () => void;
  // The globe cannot be shown: no WebGL, or the map data did not arrive.
  onUnavailable: () => void;
};

function boxPixels(map: GlobeMap): number {
  const box = map.getContainer();
  return Math.min(box.clientWidth, box.clientHeight);
}

function cameraFor(target: GlobeTarget, points: GlobePoint[], map: GlobeMap) {
  if (typeof target === "string") {
    const view = regionCameras[target];
    return { center: view.center, zoom: globeZoom(view.size, view.center[1], boxPixels(map)) };
  }
  const point = points.find((item) => item.id === target.locationId);
  if (!point) {
    return null;
  }
  // Never zoom out to reach a location that is already shown closer.
  const current = globeSize(map.getZoom(), map.getCenter().lat, boxPixels(map));
  return {
    center: [point.longitude, point.latitude] as [number, number],
    zoom: globeZoom(Math.max(LOCATION_SIZE, Math.min(current, 40)), point.latitude, boxPixels(map)),
  };
}

function markerElement(point: GlobePoint, onSelect: (id: string) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "globe-marker";
  button.dataset.type = point.type;
  button.setAttribute("aria-label", point.label);
  button.title = point.label;

  const icon = document.createElement("span");
  icon.className = "globe-marker-icon";
  button.append(icon);

  // The name is set as text, never as markup.
  const name = document.createElement("span");
  name.className = "globe-marker-name";
  name.setAttribute("aria-hidden", "true");
  name.textContent = point.name;
  button.append(name);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(point.id);
  });
  return button;
}

function paintMarker(button: HTMLElement, point: GlobePoint, selected: boolean) {
  button.dataset.selected = selected ? "true" : "false";
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  const icon = button.querySelector(".globe-marker-icon");
  if (icon) {
    // Fixed marker markup from map-markers.ts.
    icon.innerHTML = markerSvg(point.type, selected);
  }
}

export default function PolarGlobe({
  points,
  selectedId,
  camera,
  onSelect,
  onUserMove,
  onUnavailable,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<GlobeMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; point: GlobePoint }>());
  const stopDrift = useRef<() => void>(() => {});
  // The globe can be turned once its style, and with it the globe shape, has
  // loaded. Before that the library still works as a flat map, and a flat map
  // cannot be centred near a pole.
  const ready = useRef(false);
  const lastCamera = useRef<number | null>(null);
  // The newest values, for code that runs outside React's render.
  const latest = useRef({ points, camera, onSelect, onUserMove, onUnavailable });

  useEffect(() => {
    latest.current = { points, camera, onSelect, onUserMove, onUnavailable };
  });

  useEffect(() => {
    const box = container.current;
    if (!box) return;

    let instance: GlobeMap;
    try {
      setWorkerUrl(WORKER_URL);
      instance = new GlobeMap({
        container: box,
        style: globeStyle,
        center: regionCameras.global.center,
        zoom: globeZoom(
          regionCameras.global.size,
          regionCameras.global.center[1],
          Math.min(box.clientWidth, box.clientHeight),
        ),
        minZoom: -2,
        maxZoom: 11,
        // North stays up: the globe turns and zooms, and is never tilted.
        dragRotate: false,
        touchPitch: false,
        maxPitch: 0,
        // The page scrolls normally over the globe. Zooming needs Ctrl or
        // two fingers, and the map says so when it is tried without.
        cooperativeGestures: true,
        attributionControl: false,
        maplibreLogo: false,
      });
    } catch {
      // Usually WebGL is switched off or not supported.
      latest.current.onUnavailable();
      return;
    }
    map.current = instance;
    instance.setVerticalFieldOfView(FIELD_OF_VIEW);
    instance.touchZoomRotate.disableRotation();
    instance.keyboard.disableRotation();
    instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
    instance.addControl(new AttributionControl({ compact: true }), "bottom-right");
    // On a narrow globe the open attribution would cover the Antarctic
    // stations. It is folded behind its button once the map has loaded, as
    // the library folds it at the first drag. The page repeats the credits
    // under the globe, where they are always in view.
    instance.once("load", () => {
      if (box.clientWidth < 640) {
        box.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      }
    });
    instance
      .getCanvas()
      .setAttribute(
        "aria-label",
        "Interactive globe of polar research locations. Use the arrow keys to turn it and plus or minus to zoom.",
      );

    // A slow turn towards the Global view. It ends by itself, stops at the
    // first touch or key, and never starts again.
    let frame = 0;
    stopDrift.current = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      stopDrift.current = () => {};
    };
    const drift = (end: { center: [number, number]; zoom: number }) => {
      const [longitude, latitude] = end.center;
      instance.jumpTo({ center: [longitude - DRIFT_DEGREES, latitude], zoom: end.zoom });
      let before: number | null = null;
      let turned = 0;
      const step = (now: number) => {
        if (before !== null) {
          // A long gap, such as a hidden tab, counts as one short step.
          turned += Math.min((now - before) / 1000, 0.5) * DRIFT_DEGREES_PER_SECOND;
        }
        before = now;
        const done = turned >= DRIFT_DEGREES;
        instance.jumpTo({
          center: [longitude - DRIFT_DEGREES + Math.min(turned, DRIFT_DEGREES), latitude],
        });
        if (done) {
          stopDrift.current();
        } else {
          frame = requestAnimationFrame(step);
        }
      };
      frame = requestAnimationFrame(step);
    };

    // The opening view, set as soon as the globe shape is there. It is the
    // latest view asked for: a link to one location opens straight on it, and
    // a region button pressed while the map was loading is not lost.
    const first = latest.current.camera;
    instance.once("style.load", () => {
      ready.current = true;
      const request = latest.current.camera;
      const opening =
        cameraFor(request.target, latest.current.points, instance) ??
        cameraFor("global", [], instance);
      lastCamera.current = request.key;
      if (!opening) return;
      if (request.target === "global" && request.key === first.key && !prefersReducedMotion()) {
        drift(opening);
      } else {
        instance.jumpTo(opening);
      }
    });
    const stopOnInput = () => stopDrift.current();
    for (const name of ["pointerdown", "wheel", "keydown", "touchstart"] as const) {
      box.addEventListener(name, stopOnInput, { passive: true });
    }

    // A move with an input event behind it was made by hand.
    instance.on("movestart", (event) => {
      if (event.originalEvent) {
        latest.current.onUserMove();
      }
    });

    // Names appear beside station markers once the view is close enough to
    // tell them apart, and beside every marker when it is closer still.
    const showNames = () => {
      const size = globeSize(instance.getZoom(), instance.getCenter().lat, boxPixels(instance));
      box.dataset.names = size >= 12 ? "all" : size >= 1.4 ? "stations" : "none";
    };
    instance.on("move", showNames);
    showNames();

    // Without map data the globe is an empty ball, so say that it failed.
    let tilesLoaded = 0;
    instance.on("data", (event) => {
      if (event.dataType === "source" && "tile" in event && event.tile) {
        tilesLoaded += 1;
      }
    });
    instance.on("error", () => {
      if (tilesLoaded === 0) {
        latest.current.onUnavailable();
      }
    });

    const shown = markers.current;
    return () => {
      ready.current = false;
      stopDrift.current();
      for (const name of ["pointerdown", "wheel", "keydown", "touchstart"] as const) {
        box.removeEventListener(name, stopOnInput);
      }
      for (const { marker } of shown.values()) {
        marker.remove();
      }
      shown.clear();
      instance.remove();
      map.current = null;
    };
  }, []);

  // One marker for each location. No lines are drawn between markers.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const shown = markers.current;
    const wanted = new Set(points.map((point) => point.id));
    for (const [id, { marker }] of shown) {
      if (!wanted.has(id)) {
        marker.remove();
        shown.delete(id);
      }
    }
    for (const point of points) {
      let entry = shown.get(point.id);
      if (!entry) {
        const marker = new Marker({
          element: markerElement(point, (id) => {
            stopDrift.current();
            latest.current.onSelect(id);
          }),
          // A marker on the far side of the globe is hidden, not faded.
          opacityWhenCovered: "0",
        })
          .setLngLat([point.longitude, point.latitude])
          .addTo(instance);
        entry = { marker, point };
        shown.set(point.id, entry);
      }
      paintMarker(entry.marker.getElement(), point, point.id === selectedId);
    }
  }, [points, selectedId]);

  // Turn to a region or a location when the page asks for it.
  useEffect(() => {
    const instance = map.current;
    // A request made before the globe is ready is carried out when it is.
    if (!instance || !ready.current || lastCamera.current === camera.key) return;
    lastCamera.current = camera.key;

    const next = cameraFor(camera.target, latest.current.points, instance);
    if (!next) return;
    stopDrift.current();
    instance.stop();
    if (prefersReducedMotion()) {
      instance.jumpTo({ ...next, bearing: 0, pitch: 0 });
    } else {
      instance.flyTo({ ...next, bearing: 0, pitch: 0, duration: 1800 });
    }
  }, [camera]);

  return (
    <div
      aria-label="Globe of repository locations"
      className="polar-globe h-[22rem] w-full sm:h-[30rem] lg:h-[36rem]"
      data-names="none"
      ref={container}
      role="region"
    />
  );
}
