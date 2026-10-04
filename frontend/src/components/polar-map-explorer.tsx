"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { DemoLabel } from "@/components/demo-label";
import { useLiteMode } from "@/components/lite-mode";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { formatCoordinates } from "@/lib/format";
import {
  BASEMAP_CREDITS,
  type GlobeCameraRequest,
  type GlobeRegion,
  type GlobeTarget,
  type MapFilters,
  filterLocations,
  globePoints,
  hasFilters,
  nearbyLocations,
  noFilters,
  regionLabels,
  sameTarget,
  targetFor,
} from "@/lib/globe";
import { locationPhoto, photoCredit } from "@/lib/images";
import { mapTypeLabels, markerSvg } from "@/lib/map-markers";
import type { MapLocation, MapLocationType, MapRecord } from "@/lib/types";

// The globe needs the browser and WebGL, and its code is large. It is loaded
// only on the client, and only when the globe is actually shown.
const PolarGlobe = dynamic(() => import("@/components/polar-globe"), {
  ssr: false,
  loading: () => (
    <div className="polar-globe flex h-[22rem] items-center justify-center text-sm text-sky-100 sm:h-[30rem] lg:h-[36rem]">
      Loading globe...
    </div>
  ),
});

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50";
const labelClass = "text-xs font-semibold text-slate-700";
const markerTypes = ["station", "expedition_location", "other"] as const;
const regions = ["global", "antarctic", "arctic"] as const;

function toggleClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-sky-800 bg-sky-800 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:border-sky-600 hover:text-sky-800"
  }`;
}

function TypeIcon({ type, className = "h-5 w-5" }: { type: MapLocationType; className?: string }) {
  // Fixed marker markup from map-markers.ts, never repository text.
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: markerSvg(type) }}
    />
  );
}

function expeditionCount(count: number): string {
  return `${count} related ${count === 1 ? "expedition" : "expeditions"}`;
}

function sortedNames(items: Iterable<{ id: string; name: string }>): [string, string][] {
  const byId = new Map<string, string>();
  for (const item of items) {
    byId.set(item.id, item.name);
  }
  return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
}

export function PolarMapExplorer({
  locations,
  initialLocationId,
  initialExpeditionId,
}: {
  locations: MapLocation[];
  initialLocationId: string | null;
  initialExpeditionId: string | null;
}) {
  const expeditions = useMemo(
    () => sortedNames(locations.flatMap((location) => location.expeditions)),
    [locations],
  );
  const topics = useMemo(
    () => sortedNames(locations.flatMap((location) => location.research_topics)),
    [locations],
  );
  const types = markerTypes.filter((type) =>
    locations.some((location) => location.location_type === type),
  );

  // Links from other pages can open the map on one location or one expedition.
  const startExpedition = expeditions.some(([id]) => id === initialExpeditionId)
    ? (initialExpeditionId ?? "")
    : "";
  const startLocation = locations.some((item) => item.id === initialLocationId)
    ? initialLocationId
    : null;

  const [filters, setFilters] = useState<MapFilters>({
    ...noFilters,
    expeditionId: startExpedition,
  });
  const [selectedId, setSelectedId] = useState<string | null>(startLocation);
  const [camera, setCamera] = useState<GlobeCameraRequest>(() => ({
    target: startLocation
      ? { locationId: startLocation }
      : targetFor(filterLocations(locations, { ...noFilters, expeditionId: startExpedition })),
    key: 0,
  }));
  // Which region button describes the view. None once the globe is on one
  // location or has been moved by hand.
  const [region, setRegion] = useState<GlobeRegion | null>(
    typeof camera.target === "string" ? camera.target : null,
  );
  // In Lite Mode the globe, its code and its map data load only when asked
  // for. The request lasts until the page is left or reloaded.
  const { lite } = useLiteMode();
  const [globeRequested, setGlobeRequested] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const showGlobe = (!lite || globeRequested) && !unavailable;
  const details = useRef<HTMLElement>(null);

  const filtered = useMemo(() => filterLocations(locations, filters), [locations, filters]);
  const points = useMemo(() => globePoints(filtered), [filtered]);
  const selected = filtered.find((location) => location.id === selectedId) ?? null;
  const filtering = hasFilters(filters);
  const anyMappable = locations.some((location) => location.mappable);
  const stations = locations.filter((location) => location.location_type === "station");

  function turnTo(target: GlobeTarget) {
    setCamera((current) => ({ target, key: current.key + 1 }));
    setRegion(typeof target === "string" ? target : null);
  }

  // The globe follows the filters: to the one match, to the polar region the
  // matches share, or back to the whole world.
  function applyFilters(next: MapFilters) {
    setFilters(next);
    const matches = filterLocations(locations, next);
    if (next.query.trim() !== "" && matches.length === 1) {
      setSelectedId(matches[0].id);
    }
    const target = targetFor(matches);
    if (!sameTarget(target, camera.target)) {
      turnTo(target);
    }
  }

  // A marker only opens the details. Choosing from a list also turns the
  // globe to that location.
  function choose(id: string, turnGlobe: boolean) {
    setSelectedId(id);
    if (turnGlobe) {
      turnTo({ locationId: id });
    }
    details.current?.scrollIntoView?.({ block: "nearest" });
  }

  return (
    <div className="space-y-6">
      <section aria-label="Map filters" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-end">
          <div>
            <label className={labelClass} htmlFor="map-search">
              Find a station or location
            </label>
            <input
              className={fieldClass}
              id="map-search"
              onChange={(event) => applyFilters({ ...filters, query: event.target.value })}
              placeholder="Name or region"
              type="search"
              value={filters.query}
            />
          </div>
          <div aria-label="Location type" className="flex flex-wrap gap-2" role="group">
            <button
              aria-pressed={filters.type === "all"}
              className={toggleClass(filters.type === "all")}
              onClick={() => applyFilters({ ...filters, type: "all" })}
              type="button"
            >
              All types
            </button>
            {types.map((type) => (
              <button
                key={type}
                aria-pressed={filters.type === type}
                className={toggleClass(filters.type === type)}
                onClick={() => applyFilters({ ...filters, type })}
                type="button"
              >
                {type === "station"
                  ? "Stations"
                  : type === "expedition_location"
                    ? "Expedition locations"
                    : "Other locations"}
              </button>
            ))}
          </div>
        </div>

        {(expeditions.length > 0 || topics.length > 0) && (
          <details className="mt-4 border-t border-slate-200 pt-4" open={startExpedition !== ""}>
            <summary className="cursor-pointer text-sm font-semibold text-sky-800">
              More filters
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {expeditions.length > 0 && (
                <div>
                  <label className={labelClass} htmlFor="map-expedition">
                    Expedition
                  </label>
                  <select
                    className={fieldClass}
                    id="map-expedition"
                    onChange={(event) =>
                      applyFilters({ ...filters, expeditionId: event.target.value })
                    }
                    value={filters.expeditionId}
                  >
                    <option value="">All expeditions</option>
                    {expeditions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {topics.length > 0 && (
                <div>
                  <label className={labelClass} htmlFor="map-topic">
                    Research topic
                  </label>
                  <select
                    className={fieldClass}
                    id="map-topic"
                    onChange={(event) => applyFilters({ ...filters, topicId: event.target.value })}
                    value={filters.topicId}
                  >
                    <option value="">All topics</option>
                    {topics.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600" role="status">
          <p>
            {filtered.length} {filtered.length === 1 ? "location" : "locations"}
            {filtering ? (filtered.length === 1 ? " matches" : " match") : ""}, {points.length} on
            the globe
          </p>
          {filtering && (
            <button
              className="font-semibold text-sky-800 hover:underline"
              onClick={() => applyFilters(noFilters)}
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section
          aria-label="Globe"
          className="h-fit min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {!anyMappable && (
            <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              No repository location has coordinates stored yet, so the globe has
              no markers. Every location is still listed below.
            </p>
          )}
          {showGlobe ? (
            <>
              <div className="relative isolate">
                {/* A row of its own on a phone, where it would cover the Arctic. */}
                <div
                  aria-label="Globe view"
                  className="flex gap-1 border-b border-slate-200 bg-white p-2 sm:absolute sm:left-3 sm:top-3 sm:z-10 sm:rounded-full sm:border-0 sm:bg-white/95 sm:p-1 sm:shadow-md"
                  role="group"
                >
                  {regions.map((item) => (
                    <button
                      key={item}
                      aria-pressed={region === item}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        region === item
                          ? "bg-sky-800 text-white"
                          : "text-slate-700 hover:bg-sky-50 hover:text-sky-900"
                      }`}
                      onClick={() => turnTo(item)}
                      type="button"
                    >
                      {regionLabels[item]}
                    </button>
                  ))}
                </div>
                <PolarGlobe
                  camera={camera}
                  key={attempt}
                  onSelect={(id) => choose(id, false)}
                  onUnavailable={() => setUnavailable(true)}
                  onUserMove={() => setRegion(null)}
                  points={points}
                  selectedId={selected?.id ?? null}
                />
              </div>
              <div className="space-y-2 px-5 py-3">
                <ul
                  aria-label="Marker types"
                  className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600"
                >
                  {markerTypes.map((type) => (
                    <li key={type} className="flex items-center gap-1.5">
                      <TypeIcon className="h-4 w-4" type={type} />
                      {mapTypeLabels[type]}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-5 text-slate-500">
                  Map is for repository exploration. Coordinates are source-backed;
                  do not use this view for scientific measurement.
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  Map data:{" "}
                  {BASEMAP_CREDITS.map((credit, index) => (
                    <span key={credit.url}>
                      {index > 0 && ", "}
                      <a
                        className="underline hover:text-sky-800"
                        href={credit.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {credit.name}
                      </a>
                    </span>
                  ))}
                  . Drawn with{" "}
                  <a
                    className="underline hover:text-sky-800"
                    href="https://maplibre.org/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    MapLibre
                  </a>
                  .
                </p>
                {lite && (
                  <p className="text-xs leading-5 text-slate-500">
                    Lite Mode is still on. The globe was loaded for this page only.
                  </p>
                )}
              </div>
            </>
          ) : unavailable ? (
            <div className="px-5 py-6" role="status">
              <h2 className="text-xl font-semibold text-slate-950">
                Interactive map could not be loaded.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The globe needs WebGL and a connection to the map data. Every
                location is still listed below with its region, coordinates and
                source, and the rest of DhruvSetu works as usual.
              </p>
              <button
                className="mt-4 rounded-lg border border-sky-800 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                onClick={() => {
                  setUnavailable(false);
                  setAttempt((current) => current + 1);
                }}
                type="button"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="px-5 py-6">
              <h2 className="text-xl font-semibold text-slate-950">
                Interactive globe is paused in Lite Mode.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Every location is listed below with its region, coordinates,
                source and related expeditions.
              </p>
              <button
                className="mt-4 rounded-lg border border-sky-800 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                onClick={() => setGlobeRequested(true)}
                type="button"
              >
                Load Interactive Globe
              </button>
              <p className="mt-2 text-xs text-slate-500">
                This loads the globe for this page only. Lite Mode stays on.
              </p>
            </div>
          )}
        </section>

        <section
          aria-label="Selected location"
          aria-live="polite"
          className="h-fit scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          ref={details}
        >
          {selected === null ? (
            <>
              <h2 className="text-lg font-semibold text-slate-950">
                Explore India&apos;s Polar Research
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {showGlobe
                  ? "Select a station or research location on the globe."
                  : "Select a station or research location in the list below."}
              </p>
              {locations.length > 0 && (
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
                  {[
                    ["Research stations", stations.length],
                    ["Locations", locations.length],
                    ["Expeditions", expeditions.length],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-1 text-2xl font-semibold text-slate-950">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {stations.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Go to a station
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {stations.map((location) => (
                      <li key={location.id}>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:border-sky-600 hover:text-sky-800"
                          onClick={() => {
                            // A filter may be hiding the station.
                            if (!filtered.some((item) => item.id === location.id)) {
                              setFilters(noFilters);
                            }
                            choose(location.id, true);
                          }}
                          type="button"
                        >
                          <TypeIcon className="h-4 w-4" type="station" />
                          {location.stations[0]?.name ?? location.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <LocationDetails
              lite={lite}
              location={selected}
              nearby={nearbyLocations(selected, filtered)}
              onChoose={(id) => choose(id, true)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </section>
      </div>

      <section aria-labelledby="map-list-heading">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950" id="map-list-heading">
          Locations and stations
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The same locations as text. Locations without coordinates appear here
          but not on the globe.
        </p>
        {filtered.length === 0 ? (
          <p className="mt-5 rounded-lg border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm">
            {locations.length === 0
              ? "No locations are available yet."
              : "No locations match these filters."}
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((location) => {
              const coordinates = formatCoordinates(location.latitude, location.longitude);
              const isSelected = location.id === selected?.id;
              return (
                <li
                  key={location.id}
                  className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${
                    isSelected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">
                      <TypeIcon type={location.location_type} />
                      {mapTypeLabels[location.location_type]}
                    </p>
                    {location.is_demo_data && <DemoLabel />}
                  </div>
                  <h3 className="mt-3 break-words text-lg font-semibold text-slate-950">
                    {location.name}
                  </h3>
                  <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-slate-500">Region:</dt>
                      <dd className="break-words">{location.region ?? "Not available"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-slate-500">Coordinates:</dt>
                      <dd>{coordinates ?? "Not stored (not on the globe)"}</dd>
                    </div>
                    {location.stations.map((station) => (
                      <div key={station.id} className="flex flex-wrap items-center gap-2">
                        <dt className="shrink-0 text-slate-500">Station:</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                          <span className="break-words">{station.name}</span>
                          <VerificationBadge status={station.verification_status} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {location.stations
                    .filter((station) => station.source_url)
                    .map((station) => (
                      <div key={station.id} className="mt-3">
                        <OriginalSourceLink
                          className="text-xs"
                          title={station.name}
                          url={station.source_url}
                        />
                      </div>
                    ))}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="text-xs text-slate-500">
                      {expeditionCount(location.expedition_count)}
                    </span>
                    <button
                      aria-pressed={isSelected}
                      className="rounded-lg border border-sky-800 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                      onClick={() => choose(location.id, true)}
                      type="button"
                    >
                      Show details
                      <span className="sr-only"> for {location.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function RecordLinks({
  title,
  records,
  href,
}: {
  title: string;
  records: MapRecord[];
  href: (id: string) => string;
}) {
  if (records.length === 0) {
    return null;
  }
  const shown = records.slice(0, 5);
  return (
    <div className="mt-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-1.5 space-y-1 text-sm">
        {shown.map((record) => (
          <li key={record.id} className="break-words">
            <Link className="font-medium text-sky-800 hover:underline" href={href(record.id)}>
              {record.title}
            </Link>
          </li>
        ))}
        {records.length > shown.length && (
          <li className="text-slate-500">and {records.length - shown.length} more</li>
        )}
      </ul>
    </div>
  );
}

function LocationDetails({
  location,
  nearby,
  lite,
  onChoose,
  onClose,
}: {
  location: MapLocation;
  nearby: MapLocation[];
  lite: boolean;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const coordinates = formatCoordinates(location.latitude, location.longitude);
  // Requested only now, for the location that is open, and never in Lite Mode.
  const photo = lite ? null : locationPhoto(location);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">
          <TypeIcon type={location.location_type} />
          {mapTypeLabels[location.location_type]}
        </p>
        <div className="flex items-center gap-2">
          {location.is_demo_data && <DemoLabel />}
          <button
            className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            Close
            <span className="sr-only"> details for {location.name}</span>
          </button>
        </div>
      </div>
      <h2 className="mt-3 break-words text-xl font-semibold text-slate-950">{location.name}</h2>

      {photo && (
        <figure className="mt-3">
          <div className="relative h-44 overflow-hidden rounded-lg bg-slate-200 sm:h-60 lg:h-44">
            <Image
              alt={photo.image.alt}
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 23rem, 100vw"
              src={photo.image.src}
            />
          </div>
          <figcaption className="mt-1.5 text-xs leading-5 text-slate-500">
            {photo.caption} {photoCredit(photo.image)}.
          </figcaption>
        </figure>
      )}

      <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">Region:</dt>
          <dd className="break-words">{location.region ?? "Not available"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">Coordinates:</dt>
          <dd>
            {coordinates ?? "Not stored"}
            {coordinates !== null && !location.mappable && " (not drawn on the globe)"}
          </dd>
        </div>
      </dl>
      {location.description && (
        <p className="mt-3 break-words text-sm leading-6 text-slate-600">{location.description}</p>
      )}

      {location.stations.map((station) => (
        <div key={station.id} className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Research station
          </p>
          <p className="mt-1 break-words font-semibold text-slate-950">{station.name}</p>
          {station.description && (
            <p className="mt-1 text-sm leading-6 text-slate-600">{station.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <VerificationBadge status={station.verification_status} />
            {station.is_demo_data && <DemoLabel />}
            <OriginalSourceLink
              className="text-xs"
              title={station.name}
              url={station.source_url}
            />
          </div>
          {!lite && photo === null && (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              No photograph is shown: DhruvSetu holds no licensed photograph of
              this station.
            </p>
          )}
        </div>
      ))}

      {nearby.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-950">Close to this location</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            On the globe these markers overlap until it is zoomed far in.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {nearby.map((other) => (
              <li key={other.id}>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-sm font-medium text-slate-800 transition hover:border-sky-600 hover:text-sky-800"
                  onClick={() => onChoose(other.id)}
                  type="button"
                >
                  <TypeIcon className="h-4 w-4" type={other.location_type} />
                  {other.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-950">
          Related expeditions ({location.expedition_count})
        </h3>
        {location.expeditions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No expeditions are linked to this location.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {location.expeditions.map((expedition) => (
              <li key={expedition.id} className="break-words">
                <Link
                  className="font-medium text-sky-800 hover:underline"
                  href={`/expeditions/${expedition.id}`}
                >
                  {expedition.name}
                </Link>
                {expedition.expedition_number && (
                  <span className="text-slate-500"> · {expedition.expedition_number}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {location.expeditions.length > 0 &&
        (location.research_topics.length > 0 ||
          location.datasets.length > 0 ||
          location.documents.length > 0) && (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">
              Related through these expeditions
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              These records are linked to the expeditions above, not directly to
              this location.
            </p>
            {location.research_topics.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Research topics
                </h4>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {location.research_topics.map((topic) => (
                    <li
                      key={topic.id}
                      className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900"
                    >
                      {topic.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <RecordLinks
              href={(id) => `/datasets/${id}`}
              records={location.datasets}
              title="Datasets"
            />
            <RecordLinks
              href={(id) => `/documents/${id}`}
              records={location.documents}
              title="Documents"
            />
          </div>
        )}
    </>
  );
}
