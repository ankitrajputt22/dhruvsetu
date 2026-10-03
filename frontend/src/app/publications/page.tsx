import { DemoLabel } from "@/components/demo-label";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import { formatStatus } from "@/lib/format";
import type { Publication } from "@/lib/types";

export default async function PublicationsPage() {
  const result = await getApi<Publication[]>("/api/publications");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="Knowledge"
        title="Publications"
        description="Review publication records connected to polar research and expeditions."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No publications are available yet.</DataMessage>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {result.data.map((publication) => (
              <li key={publication.id} className="py-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-sm text-slate-500">
                      {publication.publication_year ?? "Year not listed"} · {" "}
                      <span className="capitalize">
                        {formatStatus(publication.verification_status)}
                      </span>
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      {publication.title}
                    </h2>
                    <p className="mt-3 leading-7 text-slate-600">
                      {publication.summary ?? "No summary is available."}
                    </p>
                  </div>
                  {publication.is_demo_data && <DemoLabel />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
