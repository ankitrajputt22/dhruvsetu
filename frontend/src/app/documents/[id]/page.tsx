import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoLabel } from "@/components/demo-label";
import { DataMessage } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import { formatDate, formatStatus } from "@/lib/format";
import type { DocumentDetail } from "@/lib/types";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getApi<DocumentDetail>(
    `/api/documents/${encodeURIComponent(id)}`,
  );

  if (result.status === 404) {
    notFound();
  }
  if (result.data === null) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
        <DataMessage>We could not load this information right now.</DataMessage>
      </div>
    );
  }

  const document = result.data;
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
      <Link className="text-sm text-sky-800 hover:underline" href="/documents">
        Back to documents
      </Link>

      <header className="mt-6 border-b border-slate-200 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">
              {document.file_type.toUpperCase()} source
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {document.title}
            </h1>
          </div>
          {document.is_demo_data && <DemoLabel />}
        </div>
      </header>

      <dl className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2">
        <Detail label="File name" value={document.file_name} />
        <Detail label="Source type" value={formatStatus(document.source_type)} />
        <Detail
          label="Publication date"
          value={
            document.publication_date
              ? formatDate(document.publication_date)
              : "Not listed"
          }
        />
        <Detail
          label="Verification"
          value={formatStatus(document.verification_status)}
        />
        <Detail label="Source parts" value={String(document.chunk_count)} />
      </dl>

      {document.related_resources.length > 0 && (
        <section className="mt-10 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-semibold text-slate-950">Related records</h2>
          <ul className="mt-4 space-y-3">
            {document.related_resources.map((resource) => (
              <li key={`${resource.type}-${resource.id}`}>
                <span className="capitalize text-slate-500">
                  {resource.type}:
                </span>{" "}
                <span className="font-medium text-slate-950">
                  {resource.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {document.source_url && (
        <p className="mt-10 border-t border-slate-200 pt-8">
          <a
            className="font-medium text-sky-800 hover:underline"
            href={document.source_url}
            rel="noreferrer"
            target="_blank"
          >
            Open source website
          </a>
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 capitalize text-slate-950">{value}</dd>
    </div>
  );
}
