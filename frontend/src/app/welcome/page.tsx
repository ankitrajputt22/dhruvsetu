import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/auth-layout";
import { RequestStatusBadge } from "@/components/request-status";
import { accountTypeLabels, safeNextPath, userName } from "@/lib/auth";
import { getApiAsUser, getCurrentUser } from "@/lib/auth-server";
import type { ResearcherAccess } from "@/lib/types";

export const metadata: Metadata = {
  title: "Welcome",
};

// Where a person lands after creating an account.
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const value = (await searchParams).next;
  const next = safeNextPath(Array.isArray(value) ? value[0] : value);
  const user = await getCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  // What the account asked for comes from the saved request, not from the page.
  const access = (await getApiAsUser<ResearcherAccess>("/api/researcher-access")).data;
  const status = access?.access_status ?? "none";

  return (
    <AuthLayout
      subtitle={`You are signed in as ${userName(user)}.`}
      title="Your account is ready"
    >
      <div className="space-y-5">
        <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-slate-500">Email Address</dt>
            <dd className="break-all text-slate-900">{user.email}</dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-slate-500">Account type</dt>
            <dd className="text-slate-900">{accountTypeLabels[user.role]}</dd>
          </div>
          {status !== "none" && (
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
              <dt className="text-slate-500">Researcher access</dt>
              <dd>
                <RequestStatusBadge status={status} />
              </dd>
            </div>
          )}
        </dl>

        {status === "pending" && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-950">
            <p className="font-semibold">Your request for researcher access has been saved.</p>
            <p className="mt-1">
              Researcher access requires administrator approval. Until an administrator
              approves it, your account has normal user access.
            </p>
            <Link
              className="mt-2 inline-block font-semibold text-sky-900 underline"
              href="/account/researcher-access"
            >
              View your request
            </Link>
          </div>
        )}

        <p className="text-sm leading-6 text-slate-600">
          You can explore research, datasets, maps and public DhruvSetu resources.
        </p>
        <Link
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-900"
          href={next}
        >
          Continue <span aria-hidden="true">→</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
