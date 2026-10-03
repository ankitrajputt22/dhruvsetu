import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { DataMessage } from "@/components/page-heading";
import { SearchForm } from "@/components/search-form";
import { getApi } from "@/lib/api";
import { formatStatus } from "@/lib/format";
import type { SearchResourceType, SearchResult } from "@/lib/types";

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

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function filterHref(query: string, type: SearchResourceType | null): string {
  const parameters = new URLSearchParams({ q: query });
  if (type !== null) {
    parameters.set("type", type);
  }
  return `/search?${parameters.toString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
  }>;
}) {
  const parameters = await searchParams;
  const query = firstValue(parameters.q).trim();
  const requestedType = firstValue(parameters.type);
  const activeType = allowedTypes.has(requestedType as SearchResourceType)
    ? (requestedType as SearchResourceType)
    : null;

  const apiParameters = new URLSearchParams({ q: query });
  if (activeType !== null) {
    apiParameters.set("type", activeType);
  }

  const result = query
    ? await getApi<SearchResult[]>(`/api/search?${apiParameters.toString()}`)
    : null;
  const searchResults = result?.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-800">
          Search
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {query ? `Search results for “${query}”` : "Search DhruvSetu"}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Find expeditions, scientists, publications, datasets, topics, and
          reports.
        </p>
        <div className="mt-7">
          <SearchForm defaultQuery={query} />
        </div>
      </header>

      {query && (
        <nav className="mt-7" aria-label="Search result filters">
          <ul className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const isActive = filter.value === activeType;
              return (
                <li key={filter.label}>
                  <Link
                    href={filterHref(query, filter.value)}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex rounded-sm border px-3 py-2 text-sm font-medium ${
                      isActive
                        ? "border-sky-800 bg-sky-800 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-sky-700 hover:text-sky-800"
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

      <section className="mt-8" aria-live="polite">
        {!query ? (
          <DataMessage>Enter a search term to find information.</DataMessage>
        ) : searchResults == null ? (
          <DataMessage>We could not complete the search right now.</DataMessage>
        ) : searchResults.length === 0 ? (
          <DataMessage>No matching information found.</DataMessage>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {searchResults.map((item) => (
              <li key={`${item.type}-${item.id}`} className="py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                      {item.type}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      {item.href ? (
                        <Link className="hover:text-sky-800" href={item.href}>
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h2>
                    <p className="mt-3 leading-7 text-slate-600">
                      {item.description ?? "No description is available."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>{item.match_reason}</span>
                      {item.verification_status && (
                        <span className="capitalize">
                          Status: {formatStatus(item.verification_status)}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.is_demo_data && <DemoLabel />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
