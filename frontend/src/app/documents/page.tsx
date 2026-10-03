import Link from "next/link";

import { DemoLabel } from "@/components/demo-label";
import { DataMessage, PageHeading } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import { formatDate, formatStatus } from "@/lib/format";
import type { Document } from "@/lib/types";

export default async function DocumentsPage() {
  const result = await getApi<Document[]>("/api/documents");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <PageHeading
        eyebrow="Sources"
        title="Documents"
        description="Browse source documents prepared for search and retrieval."
      />

      <div className="mt-8">
        {result.data === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : result.data.length === 0 ? (
          <DataMessage>No source documents are available yet.</DataMessage>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {result.data.map((document) => (
              <li key={document.id} className="py-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      {document.file_type.toUpperCase()} · {" "}
                      <span className="capitalize">
                        {formatStatus(document.verification_status)}
                      </span>
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      <Link
                        className="hover:text-sky-800 hover:underline"
                        href={`/documents/${document.id}`}
                      >
                        {document.title}
                      </Link>
                    </h2>
                    <p className="mt-3 text-sm text-slate-600">
                      {document.publication_date
                        ? formatDate(document.publication_date)
                        : "Publication date not listed"}
                      {" · "}
                      {document.chunk_count} source{" "}
                      {document.chunk_count === 1 ? "part" : "parts"}
                    </p>
                  </div>
                  {document.is_demo_data && <DemoLabel />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
