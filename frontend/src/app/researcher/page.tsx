import type { Metadata } from "next";
import Link from "next/link";

import { DataMessage } from "@/components/page-heading";
import { RequestStatusBadge } from "@/components/request-status";
import { ResearcherOnly, WorkspaceFrame } from "@/components/researcher";
import { VerificationBadge } from "@/components/verification-badge";
import { accountTypeLabels, userName } from "@/lib/auth";
import { getApiAsUser, getResearcherOrRedirect } from "@/lib/auth-server";
import { formatDate } from "@/lib/format";
import type { SubmissionItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "Research Workspace",
};

const actions = [
  {
    href: "/researcher/submit/document",
    title: "Submit a Document",
    description: "A PDF or TXT document, up to 20 MB.",
  },
  {
    href: "/researcher/submit/dataset",
    title: "Submit a Dataset",
    description: "A CSV or JSON data file, up to 5 MB.",
  },
];

export default async function ResearchWorkspacePage() {
  const user = await getResearcherOrRedirect("/researcher");
  if (user === null) {
    return <ResearcherOnly />;
  }
  const submissions = (await getApiAsUser<SubmissionItem[]>("/api/researcher/submissions"))
    .data;

  return (
    <WorkspaceFrame
      description="Submit documents and datasets for review, and follow their verification status."
      title="Research Workspace"
    >
      <section
        aria-labelledby="status-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-950" id="status-heading">
          Your access
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
          <span className="break-words">{userName(user)}</span>
          <span>Account type: {accountTypeLabels[user.role]}</span>
          <span className="inline-flex items-center gap-2">
            Researcher access: <RequestStatusBadge status="approved" />
          </span>
        </div>
      </section>

      <section aria-labelledby="submit-heading" className="mt-8">
        <h2 className="text-xl font-semibold text-slate-950" id="submit-heading">
          Submit research material
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Every submission starts as Uploaded. Only an administrator can mark it
          Reviewed or Verified.
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {actions.map((action) => (
            <li key={action.href}>
              <Link
                className="block h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-500"
                href={action.href}
              >
                <span className="flex items-center justify-between gap-3 text-base font-semibold text-slate-950">
                  {action.title} <span aria-hidden="true">→</span>
                </span>
                <span className="mt-1 block text-sm text-slate-600">{action.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="submissions-heading" className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950" id="submissions-heading">
          Your submissions
        </h2>
        <div className="mt-4">
          {submissions === null ? (
            <DataMessage>We could not load this information right now.</DataMessage>
          ) : submissions.length === 0 ? (
            <DataMessage>You have not submitted anything yet.</DataMessage>
          ) : (
            <ul className="space-y-3">
              {submissions.map((item) => (
                <li
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  key={`${item.type}-${item.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {item.type === "document" ? "Document" : "Dataset"}
                      {item.file_type ? ` · ${item.file_type.toUpperCase()}` : ""}
                    </span>
                    <VerificationBadge status={item.verification_status} />
                  </div>
                  <h3 className="mt-2 break-words text-base font-semibold text-slate-950">
                    <Link className="hover:underline" href={item.href}>
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Submitted {formatDate(item.created_at.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </WorkspaceFrame>
  );
}
