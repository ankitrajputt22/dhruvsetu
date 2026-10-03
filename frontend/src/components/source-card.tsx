import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import { SourceMetadata } from "@/components/source-metadata";
import { VerificationBadge } from "@/components/verification-badge";
import type { AssistantSource } from "@/lib/types";

// A citation card. Every detail comes from the backend source record.
export function SourceCard({ source }: { source: AssistantSource }) {
  return (
    <li
      id={`source-${source.number}`}
      className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm target:border-sky-400 target:ring-2 target:ring-sky-200"
    >
      <article className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
          <Icon name="document" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
            Source {source.number}
          </p>
          <h3 className="mt-1 break-words font-semibold text-slate-950">
            {source.title}
            {source.page_number !== null && (
              <span className="font-normal text-slate-600">
                {" "}
                — <span aria-hidden="true">p. {source.page_number}</span>
                <span className="sr-only">page {source.page_number}</span>
              </span>
            )}
          </h3>
          <div className="mt-2">
            <SourceMetadata
              fileType={source.file_type}
              publicationDate={source.publication_date}
              sectionName={source.section_name}
              sourceType={source.source_type}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Why this source: </span>
            {source.match_reason}
          </p>
          {source.related_resources.length > 0 && (
            <div className="mt-3">
              <RelatedResources resources={source.related_resources} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-800 hover:underline"
              href={source.href}
            >
              View Source
              <span className="sr-only"> document: {source.title}</span>
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <OriginalSourceLink title={source.title} url={source.source_url} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {source.is_demo_data && <DemoLabel />}
          {source.verification_status && (
            <VerificationBadge status={source.verification_status} />
          )}
        </div>
      </article>
    </li>
  );
}
