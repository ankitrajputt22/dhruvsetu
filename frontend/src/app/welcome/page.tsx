import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/auth-layout";
import { ResearcherRequestNote } from "@/components/welcome-note";
import { roleLabels, safeNextPath, userName } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";

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

  return (
    <AuthLayout
      subtitle={`You are signed in as ${userName(user)}.`}
      title="Your account is ready"
    >
      <div className="space-y-5">
        <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-slate-500">Email Address</dt>
            <dd className="break-all text-slate-900">{user.email}</dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-slate-500">Account access</dt>
            <dd className="text-slate-900">{roleLabels[user.role]}</dd>
          </div>
        </dl>

        <ResearcherRequestNote />

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
