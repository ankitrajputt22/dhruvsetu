import type { Metadata } from "next";

import { DataMessage } from "@/components/page-heading";
import { PolarMapExplorer } from "@/components/polar-map-explorer";
import { getApi } from "@/lib/api";
import type { MapLocation } from "@/lib/types";

export const metadata: Metadata = {
  title: "Polar Map",
};

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string | string[]; expedition?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const result = await getApi<MapLocation[]>("/api/map");

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            Location explorer
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            Polar Map
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Explore research stations, expedition locations and connected polar
            science.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : (
          <PolarMapExplorer
            initialExpeditionId={firstValue(parameters.expedition)}
            initialLocationId={firstValue(parameters.location)}
            locations={result.data}
          />
        )}
      </div>
    </>
  );
}
