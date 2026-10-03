import Link from "next/link";
import { notFound } from "next/navigation";

import { AboutSources } from "@/components/about-sources";
import { DemoLabel } from "@/components/demo-label";
import { Icon, type IconName } from "@/components/icons";
import { DataMessage } from "@/components/page-heading";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { VerificationSummary } from "@/components/verification-summary";
import { getApi } from "@/lib/api";
import { formatDate, formatPages, formatStatus, safeExternalUrl } from "@/lib/format";
import type { DocumentDetail } from "@/lib/types";

const NOT_AVAILABLE = "Not available";

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
  const sourceUrl = safeExternalUrl(document.source_url);

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
            <h1 className="mt-3 break-words text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-3 break-all text-sm text-slate-500">{document.file_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            {document.is_demo_data && <DemoLabel />}
            <VerificationBadge status={document.verification_status} />
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            <section>
              <h2 className="text-xl font-semibold text-slate-950">Source information</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <Detail icon="document" label="Source type" value={formatStatus(document.source_type)} />
                <Detail icon="publication" label="Document type" value={`${document.file_type.toUpperCase()} document`} plain />
                <Detail
                  icon="calendar"
                  label="Publication date"
                  value={document.publication_date ? formatDate(document.publication_date) : NOT_AVAILABLE}
                />
                <Detail
                  icon="publication"
                  label="Pages"
                  value={formatPages(document.first_page, document.last_page) ?? NOT_AVAILABLE}
                />
                <Detail icon="dataset" label="Source parts" value={String(document.chunk_count)} />
                <Detail
                  icon="calendar"
                  label="Added to DhruvSetu"
                  value={formatDate(document.created_at.slice(0, 10))}
                />
              </dl>
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-semibold text-slate-950">Original source</h2>
              {sourceUrl === null ? (
                <p className="mt-3 text-sm text-slate-600">{NOT_AVAILABLE}</p>
              ) : (
                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
                  <p className="break-all text-sm text-slate-600">{sourceUrl}</p>
                  <div className="mt-2">
                    <OriginalSourceLink title={document.title} url={sourceUrl} />
                  </div>
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-semibold text-slate-950">Related records</h2>
              {document.related_resources.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  This document is not linked to an expedition, publication, or report.
                </p>
              ) : (
                <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
                  <RelatedResources resources={document.related_resources} />
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit space-y-5">
            <VerificationSummary
              isDemoData={document.is_demo_data}
              status={document.verification_status}
            />
            <AboutSources />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  plain = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-4">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className={`mt-1 break-words text-slate-900 ${plain ? "" : "capitalize"}`}>{value}</dd>
      </div>
    </div>
  );
}
