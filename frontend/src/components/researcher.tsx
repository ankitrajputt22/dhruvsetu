import Link from "next/link";

import { DataMessage } from "@/components/page-heading";

// Shown to a signed-in account that is not a researcher or an admin.
export function ResearcherOnly() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
      <DataMessage>
        Research Workspace is available to approved researchers. Your account does
        not have researcher access.{" "}
        <Link
          className="font-semibold text-sky-800 hover:underline"
          href="/account/researcher-access"
        >
          See your researcher access
        </Link>
      </DataMessage>
    </div>
  );
}

export function WorkspaceFrame({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description: string;
  back?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            Research Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">{description}</p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {back && (
          <Link
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
            href="/researcher"
          >
            <span aria-hidden="true">←</span> Back to Research Workspace
          </Link>
        )}
        {children}
      </div>
    </>
  );
}
