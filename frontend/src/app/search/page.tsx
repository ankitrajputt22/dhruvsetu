import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { Icon, type IconName } from "@/components/icons";
import { DataMessage } from "@/components/page-heading";
import { SearchForm } from "@/components/search-form";
import { StatusBadge } from "@/components/status-badge";
import { getApi } from "@/lib/api";
import type {
  SearchMode,
  SearchResourceType,
  SearchResult,
} from "@/lib/types";

const filters: { label: string; value: SearchResourceType | null }[] = [
  { label: "All", value: null },
  { label: "Expeditions", value: "expedition" },
  { label: "Scientists", value: "scientist" },
  { label: "Publications", value: "publication" },
  { label: "Datasets", value: "dataset" },
  { label: "Topics", value: "topic" },
  { label: "Reports", value: "report" },
];

const allowedTypes = new Set(
  filters.flatMap((filter) => (filter.value === null ? [] : [filter.value])),
);

const modes: { label: string; value: SearchMode }[] = [
  { label: "Keyword", value: "keyword" },
  { label: "Semantic", value: "semantic" },
];

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function searchHref(
  query: string,
  type: SearchResourceType | null,
  mode: SearchMode,
): string {
  const parameters = new URLSearchParams({ mode });
  if (query) parameters.set("q", query);
  if (type !== null) parameters.set("type", type);
  return `/search?${parameters.toString()}`;
}

function iconForType(type: SearchResourceType): IconName {
  const icons: Record<SearchResourceType, IconName> = {
    expedition: "expedition",
    scientist: "scientist",
    publication: "publication",
    dataset: "dataset",
    topic: "topic",
    report: "document",
  };
  return icons[type];
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    mode?: string | string[];
  }>;
}) {
  const parameters = await searchParams;
  const query = firstValue(parameters.q).trim();
  const requestedType = firstValue(parameters.type);
  const activeType = allowedTypes.has(requestedType as SearchResourceType)
    ? (requestedType as SearchResourceType)
    : null;
  const requestedMode = firstValue(parameters.mode);
  const activeMode: SearchMode =
    requestedMode === "semantic" ? "semantic" : "keyword";

  const apiParameters = new URLSearchParams({ q: query, mode: activeMode });
  if (activeType !== null) apiParameters.set("type", activeType);

  const result = query
    ? await getApi<SearchResult[]>(`/api/search?${apiParameters.toString()}`)
    : null;
  const searchResults = result?.data;

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            Repository search
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            {query ? `Search results for “${query}”` : "Search DhruvSetu"}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Find expeditions, scientists, publications, datasets, topics, and reports.
          </p>
          <div className="mt-7">
            <SearchForm defaultQuery={query} mode={activeMode} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <nav aria-label="Search mode">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</p>
            <ul className="flex gap-2">
              {modes.map((mode) => {
                const isActive = mode.value === activeMode;
                return (
                  <li key={mode.value}>
                    <Link
                      href={searchHref(query, activeType, mode.value)}
                      aria-current={isActive ? "page" : undefined}
                      className={`inline-flex rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border-sky-800 bg-sky-800 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-sky-600 hover:text-sky-800"
                      }`}
                    >
                      {mode.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {query && (
            <nav aria-label="Search result filters">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Resource type</p>
              <ul className="flex flex-wrap gap-2">
                {filters.map((filter) => {
                  const isActive = filter.value === activeType;
                  return (
                    <li key={filter.label}>
                      <Link
                        href={searchHref(query, filter.value, activeMode)}
                        aria-current={isActive ? "page" : undefined}
                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? "border-sky-700 bg-sky-50 text-sky-900"
                            : "border-slate-300 bg-white text-slate-600 hover:border-sky-500"
                        }`}
                      >
                        {filter.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>

        {activeMode === "semantic" && query && (
          <p className="mt-5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Semantic search finds records with related meaning, even when the words differ.
          </p>
        )}

        <section className="mt-7" aria-live="polite">
          {!query ? (
            <DataMessage>Enter a search term to find information.</DataMessage>
          ) : activeMode === "semantic" && result?.status === 503 ? (
            <DataMessage>
              Semantic search is not ready right now. You can still use keyword search.
            </DataMessage>
          ) : searchResults == null ? (
            <DataMessage>We could not complete the search right now.</DataMessage>
          ) : searchResults.length === 0 ? (
            <DataMessage>No matching information found.</DataMessage>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">
                {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
              </p>
              <ul className="space-y-3">
                {searchResults.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <article className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
                        <Icon name={iconForType(item.type)} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                              {item.type}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold text-slate-950">
                              {item.href ? (
                                <Link className="hover:text-sky-800 hover:underline" href={item.href}>
                                  {item.title}
                                </Link>
                              ) : (
                                item.title
                              )}
                            </h2>
                          </div>
                          {item.is_demo_data && <DemoLabel />}
                        </div>
                        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                          {item.description ?? "No description is available."}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                            {item.match_reason}
                          </span>
                          {item.verification_status && (
                            <StatusBadge status={item.verification_status} />
                          )}
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
