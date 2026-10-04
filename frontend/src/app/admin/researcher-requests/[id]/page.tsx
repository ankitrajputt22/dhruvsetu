import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminOnly, AdminShell } from "@/components/admin";
import { DataMessage } from "@/components/page-heading";
import { RequestStatusBadge } from "@/components/request-status";
import { ResearcherDecision } from "@/components/researcher-decision";
import { OriginalSourceLink } from "@/components/source-link";
import { accountTypeLabels } from "@/lib/auth";
import { getAdminOrRedirect, getApiAsUser } from "@/lib/auth-server";
import { formatDate, safeExternalUrl } from "@/lib/format";
import type { AdminResearcherRequestDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Researcher request",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-900">{children}</dd>
    </div>
  );
}

export default async function AdminResearcherRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = `/admin/researcher-requests/${encodeURIComponent(id)}`;
  if ((await getAdminOrRedirect(path)) === null) {
    return <AdminOnly />;
  }

  const result = await getApiAsUser<AdminResearcherRequestDetail>(`/api${path}`);
  if (result.status === 404) {
    notFound();
  }
  const request = result.data;
  if (request === null) {
    return (
      <AdminShell current="requests">
        <DataMessage>We could not load this information right now.</DataMessage>
      </AdminShell>
    );
  }
  const name = request.applicant.display_name ?? request.applicant.email;
  const profileUrl = safeExternalUrl(request.profile_url);

  return (
    <AdminShell current="requests">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
        href={`/admin/researcher-requests?status=${request.status}`}
      >
        <span aria-hidden="true">←</span> Back to researcher requests
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="break-words text-2xl font-semibold text-slate-950">{name}</h2>

          <h3 className="mt-5 text-sm font-semibold text-slate-950">Applicant</h3>
          <dl className="mt-2 divide-y divide-slate-100 border-y border-slate-100 text-sm">
            <Row label="Display name">{request.applicant.display_name ?? "Not given"}</Row>
            <Row label="Email">
              <span className="break-all">{request.applicant.email}</span>
            </Row>
            <Row label="Current account role">
              {accountTypeLabels[request.applicant.role]}
            </Row>
          </dl>

          <h3 className="mt-6 text-sm font-semibold text-slate-950">Request</h3>
          <dl className="mt-2 divide-y divide-slate-100 border-y border-slate-100 text-sm">
            <Row label="Institution">{request.institution}</Row>
            <Row label="Research area">{request.research_area}</Row>
            <Row label="Designation">{request.designation ?? "Not given"}</Row>
            <Row label="Reason">
              <span className="whitespace-pre-line">{request.reason}</span>
            </Row>
            <Row label="Profile URL">
              {profileUrl === null ? (
                "Not given"
              ) : (
                <>
                  <span className="break-all">{profileUrl}</span>
                  <span className="mt-1 block">
                    <OriginalSourceLink title={`${name}'s profile`} url={profileUrl} />
                  </span>
                </>
              )}
            </Row>
            <Row label="Request date">{formatDate(request.created_at.slice(0, 10))}</Row>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">Request status</h3>
            <div className="mt-3">
              <RequestStatusBadge status={request.status} />
            </div>
            {request.status === "pending" ? (
              <div className="mt-4">
                <p className="mb-4 text-sm leading-6 text-slate-600">
                  Read the request before deciding. A decision cannot be changed
                  afterwards.
                </p>
                <ResearcherDecision applicantName={name} requestId={request.id} />
              </div>
            ) : (
              <dl className="mt-3 text-sm">
                <Row label="Decided by">{request.decided_by ?? "Account removed"}</Row>
                <Row label="Decided on">
                  {request.decided_at ? formatDate(request.decided_at.slice(0, 10)) : "Not recorded"}
                </Row>
                <Row label="Note">{request.decision_note ?? "No note"}</Row>
              </dl>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">
              Other requests from this person
            </h3>
            {request.other_requests.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">There are no other requests.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {request.other_requests.map((other) => (
                  <li key={other.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <RequestStatusBadge status={other.status} />
                      <Link
                        className="font-medium text-sky-800 hover:underline"
                        href={`/admin/researcher-requests/${other.id}`}
                      >
                        Sent {formatDate(other.created_at.slice(0, 10))}
                      </Link>
                    </div>
                    {other.decided_at && (
                      <p className="mt-1 break-words text-slate-600">
                        {formatDate(other.decided_at.slice(0, 10))} ·{" "}
                        {other.decided_by ?? "Account removed"}
                        {other.decision_note ? ` · ${other.decision_note}` : ""}
                      </p>
                    )}
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
