import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { getApi } from "@/lib/api";
import { formatDate, formatStatus } from "@/lib/format";
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

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No source documents are available yet.</DataMessage>
        ) : (
          <ul className="space-y-3">
            {result.data.map((document) => (
              <li key={document.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-800">
                    <Icon name="document" className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-[0.1em] text-sky-800">
                        {document.file_type}
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="capitalize">{formatStatus(document.source_type)}</span>
                      {document.publication_date && (
                        <>
                          <span aria-hidden="true">•</span>
                          <span>{formatDate(document.publication_date)}</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-slate-950">
                      <Link className="hover:text-sky-800 hover:underline" href={`/documents/${document.id}`}>
                        {document.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {document.chunk_count} source {document.chunk_count === 1 ? "part" : "parts"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    {document.is_demo_data && <DemoLabel />}
                    <StatusBadge status={document.verification_status} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
