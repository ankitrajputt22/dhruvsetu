import type { Metadata } from "next";
import Link from "next/link";

import { AdminOnly, AdminShell } from "@/components/admin";
import { DataMessage } from "@/components/page-heading";
import { RequestStatusBadge } from "@/components/request-status";
import { getAdminOrRedirect, getApiAsUser } from "@/lib/auth-server";
import { formatDate } from "@/lib/format";
import type { AdminResearcherRequest } from "@/lib/types";

export const metadata: Metadata = {
  title: "Researcher requests",
};

const filters = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

export default async function AdminResearcherRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  if ((await getAdminOrRedirect("/admin/researcher-requests")) === null) {
    return <AdminOnly />;
  }

  const value = (await searchParams).status;
  const requested = Array.isArray(value) ? value[0] : value;
  const current: FilterKey = filters.find((item) => item.key === requested)?.key ?? "pending";
  const all = (
    await getApiAsUser<AdminResearcherRequest[]>("/api/admin/researcher-requests?status=all")
  ).data;
  const shown = all?.filter((item) => current === "all" || item.status === current) ?? [];
  const count = (key: FilterKey) =>
    all?.filter((item) => key === "all" || item.status === key).length ?? 0;

  return (
    <AdminShell current="requests">
      <h2 className="text-xl font-semibold text-slate-950">Researcher requests</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        People ask for researcher access here. Open a request to read it, then approve
        or reject it. Approving makes the account a Researcher.
      </p>

      <nav aria-label="Filter requests by status" className="mt-5">
        <ul className="flex flex-wrap gap-2 text-sm font-semibold">
          {filters.map((item) => (
            <li key={item.key}>
              <Link
                aria-current={item.key === current ? "page" : undefined}
                className={`inline-block rounded-full border px-4 py-2 transition ${
                  item.key === current
                    ? "border-sky-800 bg-sky-800 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-sky-500"
                }`}
                href={`/admin/researcher-requests?status=${item.key}`}
              >
                {item.label}{" "}
                <span className="tabular-nums">({count(item.key)})</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5">
        {all === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : shown.length === 0 ? (
          <DataMessage>
            {current === "pending"
              ? "No requests are waiting for review."
              : "No requests have this status."}
          </DataMessage>
        ) : (
          <ul className="space-y-3">
            {shown.map((request) => {
              const name = request.applicant.display_name ?? request.applicant.email;
              return (
                <li
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <RequestStatusBadge status={request.status} />
                    <span className="text-sm text-slate-600">
                      Sent {formatDate(request.created_at.slice(0, 10))}
                    </span>
                  </div>
                  <h3 className="mt-2 break-words text-base font-semibold text-slate-950">
                    {name}
                  </h3>
                  <p className="break-all text-sm text-slate-600">{request.applicant.email}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Institution</dt>
                      <dd className="break-words text-slate-900">{request.institution}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Research area</dt>
                      <dd className="break-words text-slate-900">{request.research_area}</dd>
                    </div>
                    {request.designation && (
                      <div>
                        <dt className="text-slate-500">Designation</dt>
                        <dd className="break-words text-slate-900">{request.designation}</dd>
                      </div>
                    )}
                  </dl>
                  <Link
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-800 hover:underline"
                    href={`/admin/researcher-requests/${request.id}`}
                  >
                    {request.status === "pending" ? "Review request" : "Open request"}{" "}
                    <span aria-hidden="true">→</span>
                    <span className="sr-only"> from {name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
