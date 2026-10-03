import type { Metadata } from "next";
import Link from "next/link";

import { DataLabWorkspace } from "@/components/data-lab-workspace";
import { DataMessage } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import type { DataLabStatus, DatasetDetail, DatasetListItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "Polar Data Lab",
};

const UNSUPPORTED = "This dataset cannot currently be opened in Polar Data Lab.";

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function unsupportedReason(dataset: DatasetDetail, status: DataLabStatus): string | null {
  const file = dataset.file;
  if (file === null) return "It has no data file.";
  if (!file.available) return "Its data file could not be found.";
  if (!file.file_type || !status.supported_file_types.includes(file.file_type)) {
    return "Only CSV and JSON files are supported.";
  }
  return null;
}

export default async function DataLabPage({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string | string[] }>;
}) {
  const datasetId = firstValue((await searchParams).dataset);
  const status = (await getApi<DataLabStatus>("/api/data-lab/status")).data;

  let body: React.ReactNode;
  if (status === null) {
    body = <DataMessage>We could not load this information right now.</DataMessage>;
  } else if (!status.enabled) {
    body = (
      <DataMessage>
        Polar Data Lab is not enabled on this server, so analysis sessions are
        not available.
      </DataMessage>
    );
  } else if (datasetId === null) {
    const datasets = (await getApi<DatasetListItem[]>("/api/datasets")).data ?? [];
    const ready = datasets.filter(
      (dataset) =>
        dataset.has_file &&
        dataset.file_type !== null &&
        status.supported_file_types.includes(dataset.file_type),
    );
    body = (
      <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">
          Choose a dataset to start an analysis session.
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A session opens one dataset with a CSV or JSON file. Open it from the
          dataset page, or pick one below.
        </p>
        {ready.length > 0 && (
          <ul className="mt-4 space-y-2">
            {ready.map((dataset) => (
              <li key={dataset.id}>
                <Link
                  className="font-medium text-sky-800 hover:underline"
                  href={`/data-lab?dataset=${dataset.id}`}
                >
                  {dataset.title}
                </Link>
                <span className="text-sm uppercase text-slate-500"> · {dataset.file_type}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
          href="/datasets"
        >
          Browse datasets <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  } else {
    const result = await getApi<DatasetDetail>(`/api/datasets/${encodeURIComponent(datasetId)}`);
    const reason = result.data ? unsupportedReason(result.data, status) : null;
    if (result.data === null) {
      body = (
        <DataMessage>
          {result.status === 404
            ? "This dataset was not found."
            : "We could not load this information right now."}{" "}
          <Link className="font-semibold text-sky-800 hover:underline" href="/datasets">
            Browse datasets
          </Link>
        </DataMessage>
      );
    } else if (reason !== null) {
      body = (
        <DataMessage>
          {UNSUPPORTED} {reason}{" "}
          <Link
            className="font-semibold text-sky-800 hover:underline"
            href={`/datasets/${result.data.id}`}
          >
            Back to the dataset
          </Link>
        </DataMessage>
      );
    } else {
      body = <DataLabWorkspace dataset={result.data} key={result.data.id} />;
    }
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            Analysis workspace
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            Polar Data Lab
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Run Python on a DhruvSetu dataset in a temporary, isolated session.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm text-sky-900">
            Polar Data Lab is a prototype analysis workspace. Sessions are temporary.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">{body}</div>
    </>
  );
}
