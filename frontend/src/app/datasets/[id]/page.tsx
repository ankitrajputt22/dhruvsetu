import Link from "next/link";
import { notFound } from "next/navigation";

import { AboutSources } from "@/components/about-sources";
import { DatasetPreviewPanel } from "@/components/dataset-preview";
import { DemoLabel } from "@/components/demo-label";
import { Icon, type IconName } from "@/components/icons";
import { DataMessage } from "@/components/page-heading";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { VerificationSummary } from "@/components/verification-summary";
import { apiUrl, getApi } from "@/lib/api";
import { formatDate, formatFileSize, safeExternalUrl } from "@/lib/format";
import type { DataLabStatus, DatasetDetail } from "@/lib/types";

const NOT_AVAILABLE = "Not available";

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getApi<DatasetDetail>(
    `/api/datasets/${encodeURIComponent(id)}`,
  );

  if (result.status === 404) {
    notFound();
  }
  if (result.data === null) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <DataMessage>We could not load this information right now.</DataMessage>
      </div>
    );
  }

  const dataset = result.data;
  const file = dataset.file;
  const dataLab = (await getApi<DataLabStatus>("/api/data-lab/status")).data;
  const opensInDataLab =
    dataLab?.enabled === true &&
    file?.available === true &&
    file.file_type !== null &&
    dataLab.supported_file_types.includes(file.file_type);
  const sourceUrl = safeExternalUrl(dataset.source_url);
  const fileType = file?.file_type ?? dataset.file_type;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline" href="/datasets">
        <span aria-hidden="true">←</span> Back to datasets
      </Link>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-start">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
            <Icon name="dataset" className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
              {fileType ? `${fileType} dataset` : "Metadata-only dataset"}
            </p>
            <h1 className="mt-3 break-words text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
              {dataset.title}
            </h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              {dataset.description ?? "No description is available."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            {dataset.is_demo_data && <DemoLabel />}
            <VerificationBadge status={dataset.verification_status} />
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            <section>
              <h2 className="text-xl font-semibold text-slate-950">Dataset information</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <Detail
                  icon="dataset"
                  label="File type"
                  value={fileType ? `${fileType.toUpperCase()} file` : "Metadata only"}
                />
                <Detail
                  icon="calendar"
                  label="Added to DhruvSetu"
                  value={formatDate(dataset.created_at.slice(0, 10))}
                />
                {file && <Detail icon="document" label="File name" value={file.file_name} />}
                {file && (
                  <Detail
                    icon="status"
                    label="File size"
                    value={file.size_bytes === null ? NOT_AVAILABLE : formatFileSize(file.size_bytes)}
                  />
                )}
              </dl>
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-semibold text-slate-950">Data preview</h2>
              <div className="mt-4">
                {file === null ? (
                  <DataMessage>
                    This record has metadata only. No data file is attached, so
                    there is nothing to preview.
                  </DataMessage>
                ) : !file.previewable ? (
                  <DataMessage>
                    {file.preview_message ?? "Preview is not available for this file."}
                  </DataMessage>
                ) : (
                  <DatasetPreviewPanel datasetId={dataset.id} />
                )}
              </div>
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-semibold text-slate-950">Related records</h2>
              {dataset.related_resources.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  This dataset is not linked to an expedition.
                </p>
              ) : (
                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
                  <RelatedResources resources={dataset.related_resources} />
                </div>
              )}

              <h3 className="mt-6 text-sm font-semibold text-slate-950">Research topics</h3>
              {dataset.research_topics.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No research topics are listed.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {dataset.research_topics.map((topic) => (
                    <li key={topic.id} className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900">
                      {topic.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="h-fit space-y-5">
            <VerificationSummary
              isDemoData={dataset.is_demo_data}
              status={dataset.verification_status}
            />

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-950">Source and file</h2>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Original source
              </p>
              {sourceUrl === null ? (
                <p className="mt-1 text-sm text-slate-600">{NOT_AVAILABLE}</p>
              ) : (
                <div className="mt-1">
                  <p className="break-all text-sm text-slate-600">{sourceUrl}</p>
                  <div className="mt-2">
                    <OriginalSourceLink title={dataset.title} url={sourceUrl} />
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Data file
              </p>
              {file?.available ? (
                <a
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-sky-800 bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
                  href={apiUrl(`/api/datasets/${encodeURIComponent(dataset.id)}/download`)}
                >
                  Download Dataset
                  {file.size_bytes !== null && (
                    <span className="font-normal text-sky-100">
                      ({formatFileSize(file.size_bytes)})
                    </span>
                  )}
                </a>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  {file === null ? "No file is attached." : "The file could not be found."}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-950">Polar Data Lab</h2>
              {opensInDataLab ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Analyse this dataset with Python in a temporary session.
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-800 bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
                    href={`/data-lab?dataset=${dataset.id}`}
                  >
                    Open in Polar Data Lab <span aria-hidden="true">→</span>
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {dataLab?.enabled === true
                    ? "This dataset cannot currently be opened in Polar Data Lab. A CSV or JSON data file is needed."
                    : "Polar Data Lab is not enabled on this server."}
                </p>
              )}
            </section>

            <AboutSources />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-4">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-1 break-all text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
