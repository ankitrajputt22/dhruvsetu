import Image from "next/image";

import { DataMessage } from "@/components/page-heading";
import { RepositoryItem } from "@/components/repository-item";
import { ResourceLinkCard } from "@/components/resource-link-card";
import { SearchForm } from "@/components/search-form";
import { SectionHeading } from "@/components/section-heading";
import { getApi } from "@/lib/api";
import type {
  Dataset,
  Document,
  Expedition,
  Publication,
  ResearchTopic,
} from "@/lib/types";

const resources = [
  {
    href: "/expeditions",
    icon: "expedition" as const,
    title: "Expeditions",
    description: "Follow polar missions and connected research.",
  },
  {
    href: "/scientists",
    icon: "scientist" as const,
    title: "Scientists",
    description: "Meet the people behind the science.",
  },
  {
    href: "/publications",
    icon: "publication" as const,
    title: "Publications",
    description: "Read research records and findings.",
  },
  {
    href: "/datasets",
    icon: "dataset" as const,
    title: "Datasets",
    description: "Browse scientific data and observations.",
  },
  {
    href: "/documents",
    icon: "document" as const,
    title: "Documents",
    description: "Find reports, notes, and source material.",
  },
];

export default async function Home() {
  const [expeditions, publications, datasets, documents, topics] =
    await Promise.all([
      getApi<Expedition[]>("/api/expeditions"),
      getApi<Publication[]>("/api/publications"),
      getApi<Dataset[]>("/api/datasets"),
      getApi<Document[]>("/api/documents"),
      getApi<ResearchTopic[]>("/api/topics"),
    ]);

  const latest = [
    expeditions.data?.[0]
      ? {
          type: "Expedition",
          title: expeditions.data[0].name,
          href: `/expeditions/${expeditions.data[0].id}`,
          icon: "expedition" as const,
          metadata: expeditions.data[0].expedition_number ?? "Expedition record",
          isDemoData: expeditions.data[0].is_demo_data,
        }
      : null,
    publications.data?.[0]
      ? {
          type: "Publication",
          title: publications.data[0].title,
          href: "/publications",
          icon: "publication" as const,
          metadata:
            publications.data[0].publication_year?.toString() ?? "Year not listed",
          isDemoData: publications.data[0].is_demo_data,
        }
      : null,
    datasets.data?.[0]
      ? {
          type: "Dataset",
          title: datasets.data[0].title,
          href: `/datasets/${datasets.data[0].id}`,
          icon: "dataset" as const,
          metadata: datasets.data[0].file_type ?? "Metadata only",
          isDemoData: datasets.data[0].is_demo_data,
        }
      : null,
    documents.data?.[0]
      ? {
          type: "Document",
          title: documents.data[0].title,
          href: `/documents/${documents.data[0].id}`,
          icon: "document" as const,
          metadata: documents.data[0].file_type.toUpperCase(),
          isDemoData: documents.data[0].is_demo_data,
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <>
      <section className="relative isolate min-h-[31rem] overflow-hidden bg-[#073554] text-white">
        <Image
          alt="Polar research vessel in an Antarctic coastal landscape"
          className="object-cover object-center"
          fill
          priority
          sizes="100vw"
          src="/images/home/antarctica-hero.jpg"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#031e34]/90 via-[#052f4f]/70 to-[#052f4f]/20" />
        <div className="relative mx-auto flex min-h-[31rem] max-w-7xl items-center px-6 py-16 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-100">
              India&apos;s Polar Science Platform
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              DhruvSetu
            </h1>
            <p className="mt-4 text-xl font-medium text-white sm:text-2xl">
              India&apos;s Polar Science Platform
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sky-50 sm:text-lg">
              Explore expeditions, research, datasets, scientists, and stories
              from the polar regions.
            </p>
            <div className="mt-8">
              <SearchForm tone="hero" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <section className="relative z-10 -mt-8" aria-labelledby="explore-heading">
          <h2 id="explore-heading" className="sr-only">
            Explore DhruvSetu
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {resources.map((resource) => (
              <ResourceLinkCard key={resource.href} {...resource} />
            ))}
          </div>
        </section>

        <section className="mt-16 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
                Polar regions
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                India in the Polar Regions
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">
                Explore connected records from polar expeditions, research
                stations, field observations, and scientific work.
              </p>
              <p className="mt-6 inline-flex w-fit rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900">
                Interactive map coming in the map phase
              </p>
            </div>
            <div className="relative min-h-72 bg-slate-200">
              <Image
                alt="Bharati research station building in Antarctica"
                className="object-cover"
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                src="/images/stations/bharati.jpg"
              />
            </div>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="topics-heading">
          <SectionHeading
            id="topics-heading"
            title="Featured research topics"
            description="Themes connected across the current research records."
          />
          {topics.data === null ? (
            <div className="mt-6">
              <DataMessage>We could not load research topics right now.</DataMessage>
            </div>
          ) : topics.data.length === 0 ? (
            <div className="mt-6">
              <DataMessage>No research topics are available yet.</DataMessage>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topics.data.slice(0, 4).map((topic) => (
                <li
                  key={topic.id}
                  className="rounded-xl border border-sky-100 bg-sky-50/70 p-5"
                >
                  <h3 className="font-semibold text-slate-950">{topic.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {topic.description ??
                      "Research topic details are not listed."}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-16" aria-labelledby="latest-heading">
          <SectionHeading
            id="latest-heading"
            title="Latest from the repository"
            description="A quick view of records already available in DhruvSetu."
            href="/search"
            linkLabel="Search all"
          />
          {latest.length === 0 ? (
            <div className="mt-6">
              <DataMessage>No repository records are available yet.</DataMessage>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {latest.map((item) => (
                <RepositoryItem key={`${item.type}-${item.title}`} {...item} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
