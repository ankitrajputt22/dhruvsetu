import { DemoLabel } from "@/components/demo-label";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import type { Dataset } from "@/lib/types";

export default async function DatasetsPage() {
  const result = await getApi<Dataset[]>("/api/datasets");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="Data"
        title="Datasets"
        description="Browse dataset metadata connected to the platform's expedition records."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No datasets are available yet.</DataMessage>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {result.data.map((dataset) => (
              <li key={dataset.id} className="py-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-sm text-slate-500">
                      {dataset.file_type ?? "Metadata only"}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      {dataset.title}
                    </h2>
                    <p className="mt-3 leading-7 text-slate-600">
                      {dataset.description ?? "No description is available."}
                    </p>
                  </div>
                  {dataset.is_demo_data && <DemoLabel />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
