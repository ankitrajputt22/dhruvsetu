import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import { formatDateRange, formatStatus } from "@/lib/format";
import type { Expedition } from "@/lib/types";

export default async function ExpeditionsPage() {
  const result = await getApi<Expedition[]>("/api/expeditions");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="Explore"
        title="Expeditions"
        description="Browse polar expedition records and follow their connected research information."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No expeditions are available yet.</DataMessage>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {result.data.map((expedition) => (
              <li key={expedition.id} className="py-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-sm text-slate-500">
                      {expedition.expedition_number ?? "Number not listed"} · {" "}
                      {formatDateRange(expedition.start_date, expedition.end_date)}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      <Link
                        className="hover:text-sky-800"
                        href={`/expeditions/${expedition.id}`}
                      >
                        {expedition.name}
                      </Link>
                    </h2>
                    <p className="mt-3 leading-7 text-slate-600">
                      {expedition.summary ?? "No summary is available."}
                    </p>
                    <p className="mt-3 text-sm capitalize text-slate-500">
                      Status: {formatStatus(expedition.verification_status)}
                    </p>
                  </div>
                  {expedition.is_demo_data && <DemoLabel />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
