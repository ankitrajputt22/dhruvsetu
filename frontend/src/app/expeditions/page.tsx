import Image from "next/image";
import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { DataMessage } from "@/components/page-heading";
import { VerificationBadge } from "@/components/verification-badge";
import { getApi } from "@/lib/api";
import { expeditionCardImages, siteImages } from "@/lib/images";
import { isLiteMode } from "@/lib/lite-mode-server";
import { formatDateRange } from "@/lib/format";
import type { Expedition } from "@/lib/types";

export default async function ExpeditionsPage() {
  const result = await getApi<Expedition[]>("/api/expeditions");
  // In Lite Mode the card images are left out, so they are never requested.
  const lite = await isLiteMode();
  // A photograph of the region, when a licensed one is held.
  const cardImages = lite
    ? []
    : expeditionCardImages((result.data ?? []).map((item) => item.name));

  return (
    <>
      <PageHero
        eyebrow="Explore"
        title="Expeditions"
        description="Explore India's polar expeditions and the research records connected to them."
        image={siteImages.schirmacherHills.src}
        imageAlt={siteImages.schirmacherHills.alt}
      />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">All expeditions</h2>
            <p className="mt-2 text-sm text-slate-600">
              {result.data?.length ?? 0} records currently available
            </p>
          </div>
          <p className="text-sm text-slate-500">Connected research and source records</p>
        </div>

        <div className="mt-8">
          {result.data === null ? (
            <DataMessage>We could not load this information right now.</DataMessage>
          ) : result.data.length === 0 ? (
            <DataMessage>No expeditions are available yet.</DataMessage>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {result.data.map((expedition, index) => {
                const image = cardImages[index] ?? null;
                return (
                  <li
                    key={expedition.id}
                    className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <article className="flex w-full flex-col">
                      {image && (
                        <div className="relative aspect-[16/9] overflow-hidden bg-slate-200">
                          <Image
                            alt={image.alt}
                            className="object-cover"
                            fill
                            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                            src={image.src}
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                            {expedition.expedition_number ?? "Expedition"}
                          </p>
                          {expedition.is_demo_data && <DemoLabel />}
                        </div>
                        <h3 className="mt-3 text-xl font-semibold leading-7 text-slate-950">
                          {expedition.name}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                          {expedition.summary ?? "No summary is available."}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <VerificationBadge status={expedition.verification_status} />
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                            <Icon name="calendar" className="h-3.5 w-3.5" />
                            {formatDateRange(expedition.start_date, expedition.end_date)}
                          </span>
                        </div>
                        <Link
                          className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
                          href={`/expeditions/${expedition.id}`}
                        >
                          View details <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
