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
import { expeditionBanner, photoCredit } from "@/lib/images";
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
  const banner = lite ? null : expeditionBanner(expedition.name);

  const recordLists = [
    {
      title: "Publications",
      items: expedition.publications.map((item) => ({
        id: item.id,
        title: item.title,
        meta: [item.journal, item.publication_year].filter(Boolean).join(" · ") || "Year not listed",
        demo: item.is_demo_data,
        status: item.verification_status,
        sourceUrl: item.source_url,
        href: `/publications#publication-${item.id}`,
      })),
    },
    {
      title: "Reports",
      items: expedition.reports.map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.publication_date ? formatDate(item.publication_date) : "Report",
        demo: item.is_demo_data,
        status: item.verification_status,
        sourceUrl: item.source_url,
      })),
    },
    {
      title: "Datasets",
      items: expedition.datasets.map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.file_type ? `${item.file_type.toUpperCase()} file` : "Metadata only",
        demo: item.is_demo_data,
        status: item.verification_status,
        sourceUrl: item.source_url,
        href: `/datasets/${item.id}`,
      })),
    },
    {
      title: "Source documents",
      items: expedition.source_documents.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `${item.file_type.toUpperCase()} document`,
        demo: item.is_demo_data,
        status: item.verification_status,
        sourceUrl: item.source_url,
        href: `/documents/${item.id}`,
        related: item.related_resources.filter((resource) => resource.id !== expedition.id),
      })),
    },
  ].filter((list) => list.items.length > 0);

  // A section is shown only when the repository holds something for it.
  const sections = [
    ["overview", "Overview"],
    expedition.research_topics.length > 0 && [
      "topics",
      `Topics (${expedition.research_topics.length})`,
    ],
    expedition.scientists.length > 0 && [
      "scientists",
      `Scientists (${expedition.scientists.length})`,
    ],
    expedition.locations.length > 0 && ["locations", `Locations (${expedition.locations.length})`],
    recordLists.length > 0 && ["research", "Research records"],
    expedition.media_assets.length > 0 && ["media", `Media (${expedition.media_assets.length})`],
  ].filter((item) => item !== false) as [string, string][];

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

      {banner && (
        <figure className="mt-8">
          <div className="relative aspect-[16/6] min-h-64 w-full max-w-full overflow-hidden rounded-2xl bg-slate-200 shadow-sm">
            <Image
              alt={banner.alt}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1280px) 1216px, 100vw"
              src={banner.src}
            />
          </div>
          {/* The photograph shows the region, not this expedition. */}
          <figcaption className="mt-2 text-xs leading-5 text-slate-500">
            {banner.caption} {photoCredit(banner)}.
          </figcaption>
        </figure>
      )}

      <nav className="mt-6 max-w-full overflow-x-auto border-b border-slate-200" aria-label="Expedition sections">
        <ul className="flex min-w-max gap-6 text-sm font-medium text-slate-600">
          {sections.map(([href, label]) => (
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
            <p className="mt-4 max-w-3xl break-words leading-7 text-slate-600">
              {expedition.summary ?? "No summary is available."}
            </p>
          </section>

          {expedition.research_topics.length > 0 && (
            <section id="topics" className="scroll-mt-6">
              <SectionTitle title="Research topics" />
              <ul className="mt-4 flex flex-wrap gap-2">
                {expedition.research_topics.map((topic) => (
                  <li key={topic.id} className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900">
                    {topic.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {expedition.scientists.length > 0 && (
            <section id="scientists" className="scroll-mt-6">
              <SectionTitle title="Scientists" />
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                People the source names as taking part. Other members are not listed here.
              </p>
              <RecordGrid>
                {expedition.scientists.map((scientist) => (
                  <RecordItem
                    key={scientist.id}
                    icon="scientist"
                    title={scientist.name}
                    detail={
                      [scientist.designation, scientist.institution?.name]
                        .filter(Boolean)
                        .join(" · ") || "Details not listed"
                    }
                  >
                    <OriginalSourceLink
                      className="mt-2 text-sm"
                      label="Official profile"
                      title={scientist.name}
                      url={scientist.profile_url}
                    />
                  </RecordItem>
                ))}
              </RecordGrid>
            </section>
          )}

          {expedition.locations.length > 0 && (
            <section id="locations" className="scroll-mt-6">
              <SectionTitle title="Expedition locations" />
              <RecordGrid>
                {expedition.locations.map((location) => (
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
                ))}
              </RecordGrid>
              <Link
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
                href={`/map?expedition=${expedition.id}`}
              >
                Open the Polar Map with this expedition&apos;s locations
                <span aria-hidden="true">→</span>
              </Link>
            </section>
          )}

          {recordLists.length > 0 && (
            <section id="research" className="scroll-mt-6">
              <SectionTitle title="Connected research records" />
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                Records that a source links to this expedition, each with its
                verification status.
              </p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                {recordLists.map((list) => (
                  <KnowledgeList key={list.title} {...list} />
                ))}
              </div>
            </section>
          )}

          {expedition.media_assets.length > 0 && (
            <section id="media" className="scroll-mt-6">
              <SectionTitle title="Media" />
              <RecordGrid>
                {expedition.media_assets.map((media) => (
                  <RecordItem
                    key={media.id}
                    icon="document"
                    title={media.title}
                    detail={media.media_type}
                  />
                ))}
              </RecordGrid>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-950">Expedition overview</h2>
          <dl className="mt-5 space-y-5">
            <OverviewItem icon="calendar" label="Dates" value={formatDateRange(expedition.start_date, expedition.end_date)} />
            {expedition.locations.length > 0 && (
              <OverviewItem
                icon="location"
                label="Locations"
                value={expedition.locations.map((item) => item.name).join(", ")}
              />
            )}
            {expedition.research_topics.length > 0 && (
              <OverviewItem icon="topic" label="Research topics" value={String(expedition.research_topics.length)} />
            )}
          </dl>
          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verification</p>
            <div className="mt-2">
              <VerificationBadge status={expedition.verification_status} />
            </div>
          </div>
          {expedition.source_url && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Source</p>
              <div className="mt-2">
                <OriginalSourceLink title={expedition.name} url={expedition.source_url} />
              </div>
            </div>
          )}
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
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
        {children}
      </div>
    </li>
  );
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
    </div>
  );
}

function OverviewItem({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm text-slate-800">{value}</dd>
      </div>
    </div>
  );
}
