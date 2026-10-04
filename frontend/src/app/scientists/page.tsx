import { Icon } from "@/components/icons";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { OriginalSourceLink } from "@/components/source-link";
import { getApi } from "@/lib/api";
import type { Scientist } from "@/lib/types";

export default async function ScientistsPage() {
  const result = await getApi<Scientist[]>("/api/scientists");

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="People"
        title="Scientists"
        description="Researchers whose publications and expedition records are in DhruvSetu. Each profile links to the official page its details come from."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No scientists are available yet.</DataMessage>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.map((scientist) => (
              <li
                key={scientist.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Initials, not a portrait: no photograph is used without a clear licence. */}
                  <span
                    aria-hidden="true"
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0b527b] text-sm font-semibold text-white"
                  >
                    {initials(scientist.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold text-slate-950">
                      {scientist.name}
                    </h2>
                    {scientist.designation && (
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {scientist.designation}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      {scientist.institution?.name ?? "Institution not listed"}
                    </p>
                  </div>
                </div>
                {scientist.research_area && (
                  <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
                    <Icon name="topic" className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                    <span>{scientist.research_area}</span>
                  </div>
                )}
                <div className="mt-auto pt-4">
                  <OriginalSourceLink
                    label="Official profile"
                    title={scientist.name}
                    url={scientist.profile_url}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
