import type { Metadata } from "next";
import Link from "next/link";

import { AdminOnly, AdminShell } from "@/components/admin";
import { DemoLabel } from "@/components/demo-label";
import { DataMessage } from "@/components/page-heading";
import {
  VerificationBadge,
  verificationOrder,
  verificationStatuses,
} from "@/components/verification-badge";
import { getAdminOrRedirect, getApiAsUser } from "@/lib/auth-server";
import { formatDate, safeExternalUrl } from "@/lib/format";
import type { AdminRecord, AdminStatusCount } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin",
};

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function queueHref(status: string, type: string | null): string {
  return `/admin?status=${status}${type ? `&type=${type}` : ""}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; type?: string | string[] }>;
}) {
  if ((await getAdminOrRedirect("/admin")) === null) {
    return <AdminOnly />;
  }

  const query = await searchParams;
  const summary = (await getApiAsUser<AdminStatusCount[]>("/api/admin/summary")).data;
  const requestedStatus = firstValue(query.status);
  const status = verificationOrder.find((item) => item === requestedStatus) ?? "uploaded";
  const requestedType = firstValue(query.type);
  const type = summary?.find((row) => row.record_type === requestedType)?.record_type ?? null;
  const records = (
    await getApiAsUser<AdminRecord[]>(
      `/api/admin/records?status=${status}${type ? `&type=${type}` : ""}`,
    )
  ).data;

  return (
    <AdminShell current="verification">
      <section aria-labelledby="summary-heading">
        <h2 className="text-xl font-semibold text-slate-950" id="summary-heading">
          Records by verification status
        </h2>
        {summary === null ? (
          <div className="mt-4">
            <DataMessage>We could not load this information right now.</DataMessage>
          </div>
        ) : (
          <div className="relative mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 sm:uppercase sm:tracking-wide">
                <tr>
                  <th className="px-3 py-3 font-semibold sm:px-4" scope="col">Record type</th>
                  {verificationOrder.map((item) => (
                    <th className="px-3 py-3 text-right font-semibold sm:px-4" key={item} scope="col">
                      {verificationStatuses[item].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.map((row) => (
                  <tr key={row.record_type}>
                    <th className="px-3 py-3 font-medium text-slate-900 sm:px-4" scope="row">
                      {row.type_label}
                    </th>
                    {verificationOrder.map((item) => (
                      <td className="px-3 py-3 text-right tabular-nums sm:px-4" key={item}>
                        {row[item] > 0 ? (
                          <Link
                            className="font-semibold text-sky-800 hover:underline"
                            href={queueHref(item, row.record_type)}
                          >
                            {row[item]}
                          </Link>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="queue-heading" className="mt-10">
        <h2 className="text-xl font-semibold text-slate-950" id="queue-heading">
          Verification queue
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Open a record to check its details before changing its status.
        </p>

        <form action="/admin" className="mt-4 flex flex-wrap items-end gap-3" method="get">
          <label className="text-sm font-medium text-slate-800">
            Status
            <select
              className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              defaultValue={status}
              name="status"
            >
              {verificationOrder.map((item) => (
                <option key={item} value={item}>
                  {verificationStatuses[item].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-800">
            Record type
            <select
              className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              defaultValue={type ?? ""}
              name="type"
            >
              <option value="">All types</option>
              {(summary ?? []).map((row) => (
                <option key={row.record_type} value={row.record_type}>
                  {row.type_label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-900"
            type="submit"
          >
            Show
          </button>
        </form>

        <div className="mt-5">
          {records === null ? (
            <DataMessage>We could not load this information right now.</DataMessage>
          ) : records.length === 0 ? (
            <DataMessage>No records have this status.</DataMessage>
          ) : (
            <ul className="space-y-3">
              {records.map((record) => {
                const sourceUrl = safeExternalUrl(record.source_url);
                return (
                  <li
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                    key={`${record.record_type}-${record.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {record.type_label}
                      </span>
                      <VerificationBadge status={record.verification_status} />
                      {record.is_demo_data && <DemoLabel />}
                    </div>
                    <h3 className="mt-2 break-words text-base font-semibold text-slate-950">
                      {record.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Added {formatDate(record.created_at.slice(0, 10))}
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-600">
                      Source URL: {sourceUrl ?? "Not available"}
                    </p>
                    <Link
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-800 hover:underline"
                      href={`/admin/records/${record.record_type}/${record.id}`}
                    >
                      Review record <span aria-hidden="true">→</span>
                      <span className="sr-only">: {record.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
