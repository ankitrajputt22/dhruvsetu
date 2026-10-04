import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminOnly, AdminShell } from "@/components/admin";
import { VerificationControls } from "@/components/admin-controls";
import { DemoLabel } from "@/components/demo-label";
import { DataMessage } from "@/components/page-heading";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import {
  VerificationBadge,
  verificationMeaning,
  verificationStatuses,
} from "@/components/verification-badge";
import { getAdminOrRedirect, getApiAsUser } from "@/lib/auth-server";
import { formatDate, safeExternalUrl } from "@/lib/format";
import type { AdminRecordDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Review record",
};

function statusLabel(status: string): string {
  return verificationStatuses[status]?.label ?? status;
}

export default async function AdminRecordPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const path = `/admin/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
  if ((await getAdminOrRedirect(path)) === null) {
    return <AdminOnly />;
  }

  const result = await getApiAsUser<AdminRecordDetail>(`/api${path}`);
  // An unknown record type or ID.
  if (result.status === 404 || result.status === 422) {
    notFound();
  }
  const record = result.data;
  if (record === null) {
    return (
      <AdminShell current="verification">
        <DataMessage>We could not load this information right now.</DataMessage>
      </AdminShell>
    );
  }
  const sourceUrl = safeExternalUrl(record.source_url);

  return (
    <AdminShell current="verification">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
        href={`/admin?status=${record.verification_status}`}
      >
        <span aria-hidden="true">←</span> Back to the verification queue
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {record.type_label}
            </span>
            {record.is_demo_data && <DemoLabel />}
          </div>
          <h2 className="mt-2 break-words text-2xl font-semibold text-slate-950">
            {record.title}
          </h2>
          {record.description && (
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">
              {record.description}
            </p>
          )}

          <h3 className="mt-6 text-sm font-semibold text-slate-950">Record details</h3>
          <dl className="mt-3 divide-y divide-slate-100 border-y border-slate-100 text-sm">
            {record.facts.map((fact) => (
              <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]" key={fact.label}>
                <dt className="text-slate-500">{fact.label}</dt>
                <dd className="break-words text-slate-900">{fact.value}</dd>
              </div>
            ))}
            <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
              <dt className="text-slate-500">Demo Data</dt>
              <dd className="text-slate-900">{record.is_demo_data ? "Yes" : "No"}</dd>
            </div>
            <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
              <dt className="text-slate-500">Date added</dt>
              <dd className="text-slate-900">{formatDate(record.created_at.slice(0, 10))}</dd>
            </div>
            <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
              <dt className="text-slate-500">Source URL</dt>
              <dd className="break-all text-slate-900">
                {sourceUrl ?? "Not available"}
                {sourceUrl && (
                  <div className="mt-1">
                    <OriginalSourceLink title={record.title} url={sourceUrl} />
                  </div>
                )}
              </dd>
            </div>
          </dl>

          {record.related_resources.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-slate-950">Related records</h3>
              <div className="mt-2">
                <RelatedResources resources={record.related_resources} />
              </div>
            </>
          )}

          {record.href && (
            <Link
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-800 hover:underline"
              href={record.href}
            >
              Open the public page <span aria-hidden="true">→</span>
            </Link>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">Verification status</h3>
            <div className="mt-3">
              <VerificationBadge status={record.verification_status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {verificationMeaning(record.verification_status)}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Check the details and the source before changing the status. A record
              is Reviewed first and Verified after that.
            </p>
            <div className="mt-4">
              <VerificationControls
                recordId={record.id}
                recordType={record.record_type}
                status={record.verification_status}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">Status history</h3>
            {record.changes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No status changes are recorded.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {record.changes.map((change, index) => (
                  <li key={`${change.changed_at}-${index}`}>
                    <p className="font-medium text-slate-900">
                      {statusLabel(change.from_status)} → {statusLabel(change.to_status)}
                    </p>
                    <p className="break-words text-slate-600">
                      {formatDate(change.changed_at.slice(0, 10))} ·{" "}
                      {change.changed_by ?? "Account removed"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
