import Image from "next/image";
import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { DataMessage } from "@/components/page-heading";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import {
  VerificationBadge,
  verificationStatuses,
} from "@/components/verification-badge";
import { getApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DatasetFilters, DatasetListItem } from "@/lib/types";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50";
const labelClass = "text-xs font-semibold text-slate-700";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function DatasetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const filters = (await getApi<DatasetFilters>("/api/datasets/filters")).data;

  // Only values the backend offers are passed on as filters.
  const query = firstValue(parameters.q).trim().slice(0, 100);
  const topic = filters?.research_topics.find(
    (item) => item.id === firstValue(parameters.topic),
  );
  const expedition = filters?.expeditions.find(
    (item) => item.id === firstValue(parameters.expedition),
  );
  const fileType = filters?.file_types.find(
    (item) => item === firstValue(parameters.file_type),
  );
  const status = filters?.verification_statuses.find(
    (item) => item === firstValue(parameters.verification_status),
  );

  const apiParameters = new URLSearchParams();
  if (query) apiParameters.set("q", query);
  if (topic) apiParameters.set("topic", topic.id);
  if (expedition) apiParameters.set("expedition", expedition.id);
  if (fileType) apiParameters.set("file_type", fileType);
  if (status) apiParameters.set("verification_status", status);
  const hasFilters = apiParameters.size > 0;

  const result = await getApi<DatasetListItem[]>(
    `/api/datasets${hasFilters ? `?${apiParameters.toString()}` : ""}`,
  );

  return (
    <>
      <PageHero
        eyebrow="Data repository"
        title="Datasets"
        description="Explore scientific dataset records connected to India's polar research."
        image="/images/datasets/glacier.jpg"
        imageAlt="Glacier meeting the polar sea"
      />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <form
          action="/datasets"
          aria-label="Filter datasets"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          method="get"
          role="search"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className={labelClass} htmlFor="dataset-search">
                Search datasets
              </label>
              <input
                className={fieldClass}
                defaultValue={query}
                id="dataset-search"
                maxLength={100}
                name="q"
                placeholder="Title or description"
                type="search"
              />
            </div>
            {filters && filters.research_topics.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="dataset-topic">
                  Research topic
                </label>
                <select className={fieldClass} defaultValue={topic?.id ?? ""} id="dataset-topic" name="topic">
                  <option value="">All topics</option>
                  {filters.research_topics.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filters && filters.expeditions.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="dataset-expedition">
                  Expedition
                </label>
                <select
                  className={fieldClass}
                  defaultValue={expedition?.id ?? ""}
                  id="dataset-expedition"
                  name="expedition"
                >
                  <option value="">All expeditions</option>
                  {filters.expeditions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filters && filters.file_types.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="dataset-file-type">
                  File type
                </label>
                <select
                  className={fieldClass}
                  defaultValue={fileType ?? ""}
                  id="dataset-file-type"
                  name="file_type"
                >
                  <option value="">All file types</option>
                  {filters.file_types.map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filters && filters.verification_statuses.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="dataset-status">
                  Verification status
                </label>
                <select
                  className={fieldClass}
                  defaultValue={status ?? ""}
                  id="dataset-status"
                  name="verification_status"
                >
                  <option value="">All statuses</option>
                  {filters.verification_statuses.map((item) => (
                    <option key={item} value={item}>
                      {verificationStatuses[item]?.label ?? item}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              className="rounded-lg border border-sky-800 bg-sky-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
              type="submit"
            >
              Apply filters
            </button>
            {hasFilters && (
              <Link className="text-sm font-semibold text-sky-800 hover:underline" href="/datasets">
                Clear filters
              </Link>
            )}
          </div>
        </form>

        <section aria-live="polite" className="mt-8">
          {result.data === null ? (
            <DataMessage>We could not load this information right now.</DataMessage>
          ) : result.data.length === 0 ? (
            <DataMessage>
              {hasFilters
                ? "No datasets match these filters."
                : "No datasets are available yet."}
            </DataMessage>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">
                {result.data.length} {result.data.length === 1 ? "dataset" : "datasets"}
                {hasFilters
                  ? result.data.length === 1
                    ? " matches these filters"
                    : " match these filters"
                  : ""}
              </p>
              <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {result.data.map((dataset, index) => (
                  <li key={dataset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <article className="flex h-full flex-col">
                      <div className="relative aspect-[16/7] bg-slate-200">
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                          src="/images/datasets/glacier.jpg"
                          style={{ objectPosition: `${45 + (index % 5) * 10}% center` }}
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                            <Icon name="dataset" className="h-4 w-4" />
                            {dataset.file_type ? `${dataset.file_type} file` : "Metadata only"}
                          </span>
                          {dataset.is_demo_data && <DemoLabel />}
                        </div>
                        <h2 className="mt-3 break-words text-xl font-semibold text-slate-950">
                          <Link className="hover:text-sky-800 hover:underline" href={`/datasets/${dataset.id}`}>
                            {dataset.title}
                          </Link>
                        </h2>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                          {dataset.description ?? "No description is available."}
                        </p>
                        {dataset.related_resources.length > 0 && (
                          <div className="mt-4">
                            <RelatedResources resources={dataset.related_resources} />
                          </div>
                        )}
                        {dataset.research_topics.length > 0 && (
                          <ul aria-label="Research topics" className="mt-3 flex flex-wrap gap-2">
                            {dataset.research_topics.map((item) => (
                              <li key={item.id} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
                                {item.name}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-auto pt-5">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
                            <VerificationBadge status={dataset.verification_status} />
                            <span className="text-xs text-slate-500">
                              Added {formatDate(dataset.created_at.slice(0, 10))}
                            </span>
                            <OriginalSourceLink
                              className="text-xs"
                              title={dataset.title}
                              url={dataset.source_url}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
