import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoLabel } from "@/components/demo-label";
import { Icon, type IconName } from "@/components/icons";
import { DataMessage } from "@/components/page-heading";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { getApi } from "@/lib/api";
import { isLiteMode } from "@/lib/lite-mode-server";
import { formatCoordinates, formatDate, formatDateRange } from "@/lib/format";
import type { ExpeditionDetail, RelatedDocumentResource } from "@/lib/types";

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
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <DataMessage>We could not load this information right now.</DataMessage>
      </div>
    );
  }

  const expedition = result.data;
  // In Lite Mode the photo is left out, so it is never requested.
  const lite = await isLiteMode();
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl overflow-hidden px-6 py-10 lg:px-8 lg:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
        href="/expeditions"
      >
        <span aria-hidden="true">←</span> Back to expeditions
      </Link>

      <header className="mt-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
              {expedition.expedition_number ?? "Expedition record"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
              {expedition.name}
            </h1>
            <p className="mt-4 text-sm text-slate-600">
              {formatDateRange(expedition.start_date, expedition.end_date)}
            </p>
          </div>
          {expedition.is_demo_data && (
            <div className="self-start">
              <DemoLabel />
            </div>
          )}
        </div>
      </header>

      {!lite && (
        <div className="relative mt-8 aspect-[16/6] min-h-64 w-full max-w-full overflow-hidden rounded-2xl bg-slate-200 shadow-sm">
          <Image
            alt="Antarctic ice sheet viewed during a polar expedition"
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1280px) 1216px, 100vw"
            src="/images/expeditions/antarctica-expedition.jpg"
          />
        </div>
      )}

      <nav className="mt-6 max-w-full overflow-x-auto border-b border-slate-200" aria-label="Expedition sections">
        <ul className="flex min-w-max gap-6 text-sm font-medium text-slate-600">
          {[
            ["overview", "Overview"],
            ["scientists", `Scientists (${expedition.scientists.length})`],
            ["topics", `Topics (${expedition.research_topics.length})`],
            ["locations", `Locations (${expedition.locations.length})`],
            ["research", "Research records"],
            ["media", `Media (${expedition.media_assets.length})`],
          ].map(([href, label]) => (
            <li key={href}>
              <a className="block border-b-2 border-transparent px-1 py-3 hover:border-sky-700 hover:text-sky-800" href={`#${href}`}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-10">
          <section id="overview" className="scroll-mt-6">
            <SectionTitle title="About this expedition" />
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              {expedition.summary ?? "No summary is available."}
            </p>
          </section>

          <section id="topics" className="scroll-mt-6">
            <SectionTitle title="Research topics" />
            {expedition.research_topics.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No research topics are listed.</p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2">
                {expedition.research_topics.map((topic) => (
                  <li key={topic.id} className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900">
                    {topic.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="scientists" className="scroll-mt-6">
            <SectionTitle title="Scientists" />
            <RecordGrid>
              {expedition.scientists.length === 0 ? (
                <EmptyItem>No scientists are listed.</EmptyItem>
              ) : (
                expedition.scientists.map((scientist) => (
                  <RecordItem
                    key={scientist.id}
                    icon="scientist"
                    title={scientist.name}
                    detail={
                      [scientist.research_area, scientist.institution?.name]
                        .filter(Boolean)
                        .join(" · ") || "Details not listed"
                    }
                  />
                ))
              )}
            </RecordGrid>
          </section>

          <section id="locations" className="scroll-mt-6">
            <SectionTitle title="Expedition locations" />
            <RecordGrid>
              {expedition.locations.length === 0 ? (
                <EmptyItem>No locations are listed.</EmptyItem>
              ) : (
                expedition.locations.map((location) => (
                  <RecordItem
                    key={location.id}
                    icon="location"
                    title={location.name}
                    detail={location.region ?? "Region not listed"}
                  >
                    <p className="mt-1 text-sm text-slate-600">
                      {formatCoordinates(location.latitude, location.longitude) ??
                        "Coordinates not stored"}
                    </p>
                    <Link
                      className="mt-2 inline-flex text-sm font-semibold text-sky-800 hover:underline"
                      href={`/map?location=${location.id}`}
                    >
                      View on Polar Map
                      <span className="sr-only">: {location.name}</span>
                    </Link>
                  </RecordItem>
                ))
              )}
            </RecordGrid>
            {expedition.locations.length > 0 && (
              <Link
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
                href={`/map?expedition=${expedition.id}`}
              >
                Open the Polar Map with this expedition&apos;s locations
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </section>

          <section id="research" className="scroll-mt-6">
            <SectionTitle title="Connected research records" />
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
              Publications, reports, datasets, and source documents linked to this
              expedition, each with its verification status.
            </p>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <KnowledgeList
                title="Publications"
                items={expedition.publications.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: item.publication_year?.toString() ?? "Year not listed",
                  demo: item.is_demo_data,
                  status: item.verification_status,
                  sourceUrl: item.source_url,
                }))}
              />
              <KnowledgeList
                title="Reports"
                items={expedition.reports.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: formatDate(item.publication_date),
                  demo: item.is_demo_data,
                  status: item.verification_status,
                  sourceUrl: item.source_url,
                }))}
              />
              <KnowledgeList
                title="Datasets"
                items={expedition.datasets.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: item.file_type ? `${item.file_type.toUpperCase()} file` : "Metadata only",
                  demo: item.is_demo_data,
                  status: item.verification_status,
                  sourceUrl: item.source_url,
                  href: `/datasets/${item.id}`,
                }))}
              />
              <KnowledgeList
                title="Source documents"
                items={expedition.source_documents.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${item.file_type.toUpperCase()} document`,
                  demo: item.is_demo_data,
                  status: item.verification_status,
                  sourceUrl: item.source_url,
                  href: `/documents/${item.id}`,
                  related: item.related_resources.filter(
                    (resource) => resource.id !== expedition.id,
                  ),
                }))}
              />
            </div>
          </section>

          <section id="media" className="scroll-mt-6">
            <SectionTitle title="Media" />
            <RecordGrid>
              {expedition.media_assets.length === 0 ? (
                <EmptyItem>No media are listed.</EmptyItem>
              ) : (
                expedition.media_assets.map((media) => (
                  <RecordItem
                    key={media.id}
                    icon="document"
                    title={media.title}
                    detail={media.media_type}
                  />
                ))
              )}
            </RecordGrid>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-950">Expedition overview</h2>
          <dl className="mt-5 space-y-5">
            <OverviewItem icon="calendar" label="Dates" value={formatDateRange(expedition.start_date, expedition.end_date)} />
            <OverviewItem icon="scientist" label="Scientists" value={String(expedition.scientists.length)} />
            <OverviewItem icon="topic" label="Research topics" value={String(expedition.research_topics.length)} />
          </dl>
          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verification</p>
            <div className="mt-2">
              <VerificationBadge status={expedition.verification_status} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="border-b border-slate-200 pb-3 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>;
}

function RecordGrid({ children }: { children: React.ReactNode }) {
  return <ul className="mt-4 grid gap-3 sm:grid-cols-2">{children}</ul>;
}

function RecordItem({
  icon,
  title,
  detail,
  children,
}: {
  icon: IconName;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="break-words font-medium text-slate-950">{title}</p>
        <p className="mt-1 text-sm capitalize text-slate-600">{detail}</p>
        {children}
      </div>
    </li>
  );
}

function EmptyItem({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-slate-500">{children}</li>;
}

function KnowledgeList({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    title: string;
    meta: string;
    demo: boolean;
    status: string;
    sourceUrl: string | null;
    href?: string;
    related?: RelatedDocumentResource[];
  }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-800">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No records are listed.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-medium text-slate-950">
                  {item.href ? (
                    <Link className="hover:text-sky-800 hover:underline" href={item.href}>
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </p>
                {item.demo && <DemoLabel />}
              </div>
              <p className="mt-2 text-xs text-slate-500">{item.meta}</p>
              {item.related && item.related.length > 0 && (
                <div className="mt-2">
                  <RelatedResources resources={item.related} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <VerificationBadge status={item.status} />
                <OriginalSourceLink className="text-xs" title={item.title} url={item.sourceUrl} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OverviewItem({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm capitalize text-slate-800">{value}</dd>
      </div>
    </div>
  );
}
