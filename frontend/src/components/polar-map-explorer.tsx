"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { DemoLabel } from "@/components/demo-label";
import { useLiteMode } from "@/components/lite-mode";
import type { MapPoint } from "@/components/polar-map";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { formatCoordinates } from "@/lib/format";
import { mapTypeLabels, markerSvg } from "@/lib/map-markers";
import type { MapLocation, MapLocationType, MapRecord } from "@/lib/types";

// The map library needs the browser, so it loads only on the client.
const PolarMap = dynamic(() => import("@/components/polar-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center bg-slate-100 text-sm text-slate-600 sm:h-[26rem]">
      Loading map...
    </div>
  ),
});

type TypeFilter = MapLocationType | "all";
type RegionFilter = "all" | "antarctic" | "arctic";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50";
const labelClass = "text-xs font-semibold text-slate-700";

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

export function PolarMapExplorer({
  locations,
  initialLocationId,
  initialExpeditionId,
}: {
  locations: MapLocation[];
  initialLocationId: string | null;
  initialExpeditionId: string | null;
}) {
  const expeditions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const location of locations) {
      for (const expedition of location.expeditions) {
        byId.set(expedition.id, expedition.name);
      }
    }
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [locations]);
  const topics = useMemo(() => {
    const byId = new Map<string, string>();
    for (const location of locations) {
      for (const topic of location.research_topics) {
        byId.set(topic.id, topic.name);
      }
    }
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [locations]);

  const types = (["station", "expedition_location", "other"] as const).filter((type) =>
    locations.some((location) => location.location_type === type),
  );
  // Region buttons appear only when coordinates place a location in a polar region.
  const regions = (["antarctic", "arctic"] as const).filter((region) =>
    locations.some((location) => location.polar_region === region),
  );

  // Links from other pages can open the map on one location or one expedition.
  const startExpedition = expeditions.some(([id]) => id === initialExpeditionId)
    ? (initialExpeditionId ?? "")
    : "";
  const startLocation = locations.some((item) => item.id === initialLocationId)
    ? initialLocationId
    : null;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [expeditionId, setExpeditionId] = useState(startExpedition);
  const [topicId, setTopicId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(startLocation);
  // In Lite Mode the map, its code and its tiles load only when asked for.
  // The request lasts until the page is left or reloaded.
  const { lite } = useLiteMode();
  const [mapRequested, setMapRequested] = useState(false);
  const showMap = !lite || mapRequested;
  const [focus, setFocus] = useState<{ id: string } | null>(
    startLocation ? { id: startLocation } : null,
  );
  const details = useRef<HTMLElement>(null);

  const search = query.trim().toLowerCase();
  const filtered = locations.filter(
    (location) =>
      (typeFilter === "all" || location.location_type === typeFilter) &&
      (regionFilter === "all" || location.polar_region === regionFilter) &&
      (expeditionId === "" || location.expeditions.some((item) => item.id === expeditionId)) &&
      (topicId === "" || location.research_topics.some((item) => item.id === topicId)) &&
      (search === "" ||
        [location.name, location.region ?? "", ...location.stations.map((item) => item.name)].some(
          (text) => text.toLowerCase().includes(search),
        )),
  );

  const points: MapPoint[] = [];
  for (const location of filtered) {
    if (location.mappable && location.latitude !== null && location.longitude !== null) {
      points.push({
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        type: location.location_type,
      });
    }
  }

  const selected = filtered.find((location) => location.id === selectedId) ?? null;
  const hasFilters =
    search !== "" ||
    typeFilter !== "all" ||
    regionFilter !== "all" ||
    expeditionId !== "" ||
    topicId !== "";
  const anyMappable = locations.some((location) => location.mappable);

  // A marker click only opens the details. Choosing from the list also
  // centres the map on that location.
  function choose(id: string, fromList: boolean) {
    setSelectedId(id);
    if (fromList) {
      setFocus({ id });
      details.current?.scrollIntoView({ block: "nearest" });
    }
  }

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setRegionFilter("all");
    setExpeditionId("");
    setTopicId("");
  }

  return (
    <div className="space-y-8">
      <section aria-label="Map filters" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-end">
          <div>
            <label className={labelClass} htmlFor="map-search">
              Find a station or location
            </label>
            <input
              className={fieldClass}
              id="map-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or region"
              type="search"
              value={query}
            />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div aria-label="Location type" className="flex flex-wrap gap-2" role="group">
              <button
                aria-pressed={typeFilter === "all"}
                className={toggleClass(typeFilter === "all")}
                onClick={() => setTypeFilter("all")}
                type="button"
              >
                All types
              </button>
              {types.map((type) => (
                <button
                  key={type}
                  aria-pressed={typeFilter === type}
                  className={toggleClass(typeFilter === type)}
                  onClick={() => setTypeFilter(type)}
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
            {regions.length > 0 && (
              <div aria-label="Polar region" className="flex flex-wrap gap-2" role="group">
                <button
                  aria-pressed={regionFilter === "all"}
                  className={toggleClass(regionFilter === "all")}
                  onClick={() => setRegionFilter("all")}
                  type="button"
                >
                  Show all
                </button>
                {regions.map((region) => (
                  <button
                    key={region}
                    aria-pressed={regionFilter === region}
                    className={toggleClass(regionFilter === region)}
                    onClick={() => setRegionFilter(region)}
                    type="button"
                  >
                    {region === "antarctic" ? "Antarctica" : "Arctic"}
                  </button>
                ))}
              </div>
            )}
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
                    onChange={(event) => setExpeditionId(event.target.value)}
                    value={expeditionId}
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
                    onChange={(event) => setTopicId(event.target.value)}
                    value={topicId}
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
            {hasFilters ? (filtered.length === 1 ? " matches" : " match") : ""},{" "}
            {points.length} on the map
          </p>
          {hasFilters && (
            <button
              className="font-semibold text-sky-800 hover:underline"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Map" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {!anyMappable && (
            <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              No repository location has coordinates stored yet, so the map has no
              markers. Every location is still listed below.
            </p>
          )}
          {showMap ? (
            <>
              <PolarMap
                focus={focus}
                onSelect={(id) => choose(id, false)}
                points={points}
                selectedId={selected?.id ?? null}
              />
              <div className="space-y-3 px-5 py-4">
                <ul aria-label="Marker types" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                  {(["station", "expedition_location", "other"] as const).map((type) => (
                    <li key={type} className="flex items-center gap-1.5">
                      <TypeIcon type={type} />
                      {mapTypeLabels[type]}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-5 text-slate-500">
                  Map positions are for exploration and repository navigation, not
                  scientific distance or area measurement.
                </p>
                {lite && (
                  <p className="text-xs leading-5 text-slate-500">
                    Lite Mode is still on. The map was loaded for this page only.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="px-5 py-6">
              <h2 className="text-xl font-semibold text-slate-950">Polar locations</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Lite Mode is on, so the interactive map is not loaded. Every
                location is listed below with its region, coordinates and
                related expeditions.
              </p>
              <button
                className="mt-4 rounded-lg border border-sky-800 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                onClick={() => setMapRequested(true)}
                type="button"
              >
                Load Interactive Map
              </button>
              <p className="mt-2 text-xs text-slate-500">
                This loads the map for this page only. Lite Mode stays on.
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
              <h2 className="font-semibold text-slate-950">Location details</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Select a marker on the map or a location in the list to see its
                station, expeditions and related research.
              </p>
            </>
          ) : (
            <LocationDetails location={selected} />
          )}
        </section>
      </div>

      <section aria-labelledby="map-list-heading">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950" id="map-list-heading">
          Locations and stations
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The same locations as text. Locations without coordinates appear here
          but not on the map.
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
                      <dd>{coordinates ?? "Not stored (not on the map)"}</dd>
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

function LocationDetails({ location }: { location: MapLocation }) {
  const coordinates = formatCoordinates(location.latitude, location.longitude);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">
          <TypeIcon type={location.location_type} />
          {mapTypeLabels[location.location_type]}
        </p>
        {location.is_demo_data && <DemoLabel />}
      </div>
      <h2 className="mt-3 break-words text-xl font-semibold text-slate-950">{location.name}</h2>
      <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">Region:</dt>
          <dd className="break-words">{location.region ?? "Not available"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-500">Coordinates:</dt>
          <dd>
            {coordinates ?? "Not stored"}
            {coordinates !== null && !location.mappable && " (too close to the pole to draw on this map)"}
          </dd>
        </div>
      </dl>
      {location.description && (
        <p className="mt-3 text-sm leading-6 text-slate-600">{location.description}</p>
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
        </div>
      ))}

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
