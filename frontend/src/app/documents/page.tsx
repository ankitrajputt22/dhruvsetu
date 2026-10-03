import Link from "next/link";

import { AboutSources } from "@/components/about-sources";
import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import { SourceMetadata } from "@/components/source-metadata";
import { VerificationBadge } from "@/components/verification-badge";
import { getApi } from "@/lib/api";
import type { Document } from "@/lib/types";

export default async function DocumentsPage() {
  const result = await getApi<Document[]>("/api/documents");

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="Source repository"
        title="Documents"
        description="Research reports, field notes, and source documents prepared for retrieval."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {result.data === null ? (
            <DataMessage>We could not load this information right now.</DataMessage>
          ) : result.data.length === 0 ? (
            <DataMessage>No source documents are available yet.</DataMessage>
          ) : (
            <ul className="space-y-3">
              {result.data.map((document) => (
                <li key={document.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-800">
                      <Icon name="document" className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <SourceMetadata
                        fileType={document.file_type}
                        publicationDate={document.publication_date}
                        sourceType={document.source_type}
                      />
                      <h2 className="mt-2 break-words text-lg font-semibold text-slate-950">
                        <Link className="hover:text-sky-800 hover:underline" href={`/documents/${document.id}`}>
                          {document.title}
                        </Link>
                      </h2>
                      {document.related_resources.length > 0 && (
                        <div className="mt-2">
                          <RelatedResources resources={document.related_resources} />
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                        <span>
                          {document.chunk_count} source {document.chunk_count === 1 ? "part" : "parts"}
                        </span>
                        <OriginalSourceLink title={document.title} url={document.source_url} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      {document.is_demo_data && <DemoLabel />}
                      <VerificationBadge status={document.verification_status} />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="h-fit">
          <AboutSources />
        </aside>
      </div>
    </div>
  );
}
