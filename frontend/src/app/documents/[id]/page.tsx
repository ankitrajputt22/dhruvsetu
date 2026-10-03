import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoLabel } from "@/components/demo-label";
import { Icon, type IconName } from "@/components/icons";
import { DataMessage } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
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
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <DataMessage>We could not load this information right now.</DataMessage>
      </div>
    );
  }

  const document = result.data;
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline" href="/documents">
        <span aria-hidden="true">←</span> Back to documents
      </Link>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-start">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
            <Icon name="document" className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">
              {document.file_type} source document
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-3 break-all text-sm text-slate-500">{document.file_name}</p>
          </div>
          {document.is_demo_data && <DemoLabel />}
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Source information</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <Detail icon="document" label="Source type" value={formatStatus(document.source_type)} />
              <Detail
                icon="calendar"
                label="Publication date"
                value={document.publication_date ? formatDate(document.publication_date) : "Not listed"}
              />
              <Detail icon="status" label="Verification" value={formatStatus(document.verification_status)} />
              <Detail icon="publication" label="Source parts" value={String(document.chunk_count)} />
            </dl>

            {document.related_resources.length > 0 && (
              <section className="mt-10 border-t border-slate-200 pt-8">
                <h2 className="text-xl font-semibold text-slate-950">Related records</h2>
                <ul className="mt-4 space-y-3">
                  {document.related_resources.map((resource) => (
                    <li key={`${resource.type}-${resource.id}`} className="rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                        {resource.type}
                      </span>
                      <p className="mt-1 font-medium text-slate-950">{resource.title}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="h-fit rounded-xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">Document status</p>
            <div className="mt-4">
              <StatusBadge status={document.verification_status} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Text is split into source-linked parts for search and retrieval.
            </p>
            {document.source_url && (
              <a
                className="mt-5 inline-flex text-sm font-semibold text-sky-800 hover:underline"
                href={document.source_url}
                rel="noreferrer"
                target="_blank"
              >
                Open source website <span aria-hidden="true">↗</span>
              </a>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-4">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="mt-1 capitalize text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
