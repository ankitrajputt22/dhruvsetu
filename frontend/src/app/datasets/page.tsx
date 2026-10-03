import Image from "next/image";

import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { DataMessage } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { getApi } from "@/lib/api";
import type { Dataset } from "@/lib/types";

export default async function DatasetsPage() {
  const result = await getApi<Dataset[]>("/api/datasets");

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
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No datasets are available yet.</DataMessage>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {result.data.map((dataset, index) => (
              <li key={dataset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <article className="flex h-full flex-col">
                  <div className="relative aspect-[16/7] bg-slate-200">
                    <Image
                      alt="Polar glacier landscape"
                      className="object-cover"
                      fill
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      src="/images/datasets/glacier.jpg"
                      style={{ objectPosition: `${45 + index * 10}% center` }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                        <Icon name="dataset" className="h-4 w-4" />
                        {dataset.file_type ?? "Metadata only"}
                      </span>
                      {dataset.is_demo_data && <DemoLabel />}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-slate-950">
                      {dataset.title}
                    </h2>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                      {dataset.description ?? "No description is available."}
                    </p>
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <StatusBadge status={dataset.verification_status} />
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
