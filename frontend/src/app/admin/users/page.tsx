import type { Metadata } from "next";

import { AdminOnly, AdminShell } from "@/components/admin";
import { UserRoleControl } from "@/components/admin-controls";
import { DataMessage } from "@/components/page-heading";
import { getAdminOrRedirect, getApiAsUser } from "@/lib/auth-server";
import { formatDate } from "@/lib/format";
import type { AdminUser } from "@/lib/types";

export const metadata: Metadata = {
  title: "Users",
};

export default async function AdminUsersPage() {
  if ((await getAdminOrRedirect("/admin/users")) === null) {
    return <AdminOnly />;
  }
  const users = (await getApiAsUser<AdminUser[]>("/api/admin/users")).data;

  return (
    <AdminShell current="users">
      <h2 className="text-xl font-semibold text-slate-950">Accounts</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        An account can be a User or a Researcher. Researcher access is normally
        given by approving a request under Researcher requests. Giving the role
        here also marks a waiting request as approved. Removing it keeps the
        records the person submitted. Admin accounts are not changed here. An
        account signs in again after its role changes.
      </p>

      <div className="mt-5">
        {users === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3 font-semibold sm:px-4" scope="col">Account</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell" scope="col">Created</th>
                  <th className="px-3 py-3 font-semibold sm:px-4" scope="col">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-3 sm:px-4">
                      <p className="break-words font-medium text-slate-900">
                        {user.display_name ?? user.email}
                      </p>
                      {user.display_name && (
                        <p className="break-all text-slate-600">{user.email}</p>
                      )}
                      {!user.is_active && (
                        <p className="text-xs text-slate-500">Account disabled</p>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 sm:table-cell">
                      {formatDate(user.created_at.slice(0, 10))}
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <UserRoleControl user={user} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
