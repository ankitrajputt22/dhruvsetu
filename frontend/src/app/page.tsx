import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { DataMessage } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import type { Dataset, Expedition } from "@/lib/types";

export default async function Home() {
  const [expeditionResult, datasetResult] = await Promise.all([
    getApi<Expedition[]>("/api/expeditions"),
    getApi<Dataset[]>("/api/datasets"),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8 lg:py-20">
      <section className="max-w-3xl" aria-labelledby="page-title">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-800">
          India&apos;s Polar Science Platform
        </p>
        <h1
          id="page-title"
          className="mt-4 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl"
        >
          DhruvSetu
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700 sm:text-2xl">
          India&apos;s Polar Science Knowledge, Analysis and Outreach Platform
        </p>
        <p className="mt-7 max-w-xl border-l-4 border-sky-700 pl-5 text-base leading-7 text-slate-600 sm:text-lg">
          Explore connected information about polar expeditions, people,
          publications, and datasets.
        </p>
        <div className="mt-8">
          <DemoLabel />
        </div>
      </section>

      <section className="mt-16" aria-labelledby="expeditions-heading">
        <div className="flex items-end justify-between gap-4 border-b border-slate-300 pb-4">
          <div>
            <p className="text-sm font-medium text-sky-800">From MySQL</p>
            <h2 id="expeditions-heading" className="mt-1 text-2xl font-semibold">
              Expeditions
            </h2>
          </div>
          <Link className="text-sm font-semibold text-sky-800" href="/expeditions">
            View all
          </Link>
        </div>

        {expeditionResult.data === null ? (
          <div className="mt-6">
            <DataMessage>We could not load this information right now.</DataMessage>
          </div>
        ) : expeditionResult.data.length === 0 ? (
          <div className="mt-6">
            <DataMessage>No expeditions are available yet.</DataMessage>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {expeditionResult.data.slice(0, 3).map((expedition) => (
              <li key={expedition.id} className="py-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <Link
                      href={`/expeditions/${expedition.id}`}
                      className="text-lg font-semibold text-slate-950 hover:text-sky-800"
                    >
                      {expedition.name}
                    </Link>
                    <p className="mt-2 max-w-3xl leading-7 text-slate-600">
                      {expedition.summary ?? "No summary is available."}
                    </p>
                  </div>
                  {expedition.is_demo_data && <DemoLabel />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14" aria-labelledby="datasets-heading">
        <div className="flex items-end justify-between gap-4 border-b border-slate-300 pb-4">
          <h2 id="datasets-heading" className="text-2xl font-semibold">
            Datasets
          </h2>
          <Link className="text-sm font-semibold text-sky-800" href="/datasets">
            View all
          </Link>
        </div>

        {datasetResult.data === null ? (
          <div className="mt-6">
            <DataMessage>We could not load this information right now.</DataMessage>
          </div>
        ) : datasetResult.data.length === 0 ? (
          <div className="mt-6">
            <DataMessage>No datasets are available yet.</DataMessage>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {datasetResult.data.slice(0, 3).map((dataset) => (
              <li
                key={dataset.id}
                className="flex flex-col gap-3 py-6 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <h3 className="font-semibold text-slate-950">{dataset.title}</h3>
                  <p className="mt-2 text-slate-600">
                    {dataset.description ?? "No description is available."}
                  </p>
                </div>
                {dataset.is_demo_data && <DemoLabel />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
