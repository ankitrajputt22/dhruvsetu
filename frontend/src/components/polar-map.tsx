"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

import { mapTypeLabels, markerSvg } from "@/lib/map-markers";
import type { MapLocationType } from "@/lib/types";

export type MapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: MapLocationType;
};

// OpenStreetMap standard tiles: free to use, no API key, attribution required.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function PolarMap({
  points,
  selectedId,
  focus,
  onSelect,
}: {
  points: MapPoint[];
  selectedId: string | null;
  // Centre the map on this location. A new object asks for it again.
  focus: { id: string } | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;

    const instance = L.map(container.current, {
      center: [0, 0],
      zoom: 1,
      minZoom: 1,
      maxZoom: 10,
      // The page keeps scrolling normally when the pointer is over the map.
      scrollWheelZoom: false,
      worldCopyJump: true,
    });

    let loadedTiles = 0;
    const tiles = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 10 });
    tiles.on("tileload", () => {
      loadedTiles += 1;
      setTilesFailed(false);
    });
    tiles.on("tileerror", () => {
      if (loadedTiles === 0) setTilesFailed(true);
    });
    tiles.addTo(instance);
    instance.attributionControl.setPrefix(
      '<a href="https://leafletjs.com">Leaflet</a>',
    );

    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  // Draw one marker for each location. No lines are drawn between markers.
  useEffect(() => {
    const group = markers.current;
    if (!group) return;

    group.clearLayers();
    for (const point of points) {
      const selected = point.id === selectedId;
      const size = selected ? 42 : 32;
      L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: "",
          html: markerSvg(point.type, selected),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        keyboard: true,
        title: `${mapTypeLabels[point.type]}: ${point.name}`,
        zIndexOffset: selected ? 1000 : 0,
      })
        .on("click", () => select.current(point.id))
        .addTo(group);
    }
  }, [points, selectedId]);

  // Show every marker when the set of markers changes.
  const pointKey = points.map((point) => point.id).join(",");
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    if (points.length === 0) {
      instance.setView([0, 0], 1, { animate: false });
    } else if (points.length === 1) {
      instance.setView([points[0].latitude, points[0].longitude], 4, { animate: false });
    } else {
      instance.fitBounds(
        L.latLngBounds(points.map((point) => [point.latitude, point.longitude])),
        { padding: [48, 48], maxZoom: 5, animate: false },
      );
    }
    // Only the marker set matters here, not each new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);

  // Centre the map on a location chosen from the list or from a page link.
  useEffect(() => {
    const instance = map.current;
    const point = points.find((item) => item.id === focus?.id);
    if (!instance || !point) return;

    instance.setView(
      [point.latitude, point.longitude],
      Math.max(instance.getZoom(), 3),
      { animate: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div className="isolate">
      {tilesFailed && (
        <p
          className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"
          role="status"
        >
          The map background could not be loaded. Markers and the location list
          below still work.
        </p>
      )}
      <div
        aria-label="Map of repository locations"
        className="h-80 w-full bg-slate-100 sm:h-[26rem]"
        ref={container}
        role="region"
      />
    </div>
  );
}
