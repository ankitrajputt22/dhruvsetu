import { notFound } from "next/navigation";

import { DemoLabel } from "@/components/demo-label";
import { DataMessage } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import { formatDate, formatDateRange, formatStatus } from "@/lib/format";
import type { ExpeditionDetail } from "@/lib/types";

export default async function ExpeditionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getApi<ExpeditionDetail>(
    `/api/expeditions/${encodeURIComponent(id)}`,
  );

  if (result.status === 404) {
    notFound();
  }

  if (result.data === null) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
        <DataMessage>We could not load this information right now.</DataMessage>
      </div>
    );
  }

  const expedition = result.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="border-b border-slate-200 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">
              {expedition.expedition_number ?? "Expedition"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {expedition.name}
            </h1>
          </div>
          {expedition.is_demo_data && <DemoLabel />}
        </div>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          {expedition.summary ?? "No summary is available."}
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-950">Dates</dt>
            <dd className="mt-1 text-slate-600">
              {formatDateRange(expedition.start_date, expedition.end_date)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-950">Status</dt>
            <dd className="mt-1 capitalize text-slate-600">
              {formatStatus(expedition.verification_status)}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <DetailSection title="Scientists">
          {expedition.scientists.length === 0 ? (
            <EmptyItem>No scientists are listed.</EmptyItem>
          ) : (
            expedition.scientists.map((scientist) => (
              <li key={scientist.id}>
                <p className="font-medium text-slate-950">{scientist.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {[scientist.research_area, scientist.institution?.name]
                    .filter(Boolean)
                    .join(" · ") || "Details not listed"}
                </p>
              </li>
            ))
          )}
        </DetailSection>

        <DetailSection title="Research topics">
          {expedition.research_topics.length === 0 ? (
            <EmptyItem>No research topics are listed.</EmptyItem>
          ) : (
            expedition.research_topics.map((topic) => (
              <li key={topic.id}>
                <p className="font-medium text-slate-950">{topic.name}</p>
                {topic.description && (
                  <p className="mt-1 text-sm text-slate-600">{topic.description}</p>
                )}
              </li>
            ))
          )}
        </DetailSection>

        <DetailSection title="Locations">
          {expedition.locations.length === 0 ? (
            <EmptyItem>No locations are listed.</EmptyItem>
          ) : (
            expedition.locations.map((location) => (
              <li key={location.id}>
                <p className="font-medium text-slate-950">{location.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {location.region ?? "Region not listed"}
                </p>
              </li>
            ))
          )}
        </DetailSection>

        <DetailSection title="Publications">
          {expedition.publications.length === 0 ? (
            <EmptyItem>No publications are listed.</EmptyItem>
          ) : (
            expedition.publications.map((publication) => (
              <li key={publication.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-950">{publication.title}</p>
                  {publication.is_demo_data && <DemoLabel />}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {publication.publication_year ?? "Year not listed"}
                </p>
              </li>
            ))
          )}
        </DetailSection>

        <DetailSection title="Reports">
          {expedition.reports.length === 0 ? (
            <EmptyItem>No reports are listed.</EmptyItem>
          ) : (
            expedition.reports.map((report) => (
              <li key={report.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-950">{report.title}</p>
                  {report.is_demo_data && <DemoLabel />}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDate(report.publication_date)}
                </p>
              </li>
            ))
          )}
        </DetailSection>

        <DetailSection title="Datasets">
          {expedition.datasets.length === 0 ? (
            <EmptyItem>No datasets are listed.</EmptyItem>
          ) : (
            expedition.datasets.map((dataset) => (
              <li key={dataset.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-950">{dataset.title}</p>
                  {dataset.is_demo_data && <DemoLabel />}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {dataset.file_type ?? "Metadata only"}
                </p>
              </li>
            ))
          )}
        </DetailSection>

        <DetailSection title="Media">
          {expedition.media_assets.length === 0 ? (
            <EmptyItem>No media are listed.</EmptyItem>
          ) : (
            expedition.media_assets.map((media) => (
              <li key={media.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-950">{media.title}</p>
                  {media.is_demo_data && <DemoLabel />}
                </div>
                <p className="mt-1 text-sm capitalize text-slate-600">
                  {media.media_type}
                </p>
              </li>
            ))
          )}
        </DetailSection>
      </div>
    </div>
  );
}

function EmptyItem({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-slate-500">{children}</li>;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="border-b border-slate-300 pb-3 text-xl font-semibold text-slate-950">
        {title}
      </h2>
      <ul className="mt-4 space-y-4">{children}</ul>
    </section>
  );
}
