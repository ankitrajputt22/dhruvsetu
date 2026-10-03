import { DataMessage, PageHeading } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import type { Scientist } from "@/lib/types";

export default async function ScientistsPage() {
  const result = await getApi<Scientist[]>("/api/scientists");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="People"
        title="Scientists"
        description="Meet the people connected to the expedition records in DhruvSetu."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No scientists are available yet.</DataMessage>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {result.data.map((scientist) => (
              <li key={scientist.id} className="py-6">
                <h2 className="text-lg font-semibold text-slate-950">
                  {scientist.name}
                </h2>
                <p className="mt-2 text-slate-600">
                  {scientist.institution?.name ?? "Institution not listed"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {scientist.research_area ?? "Research area not listed"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
