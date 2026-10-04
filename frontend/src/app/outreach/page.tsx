import type { Metadata } from "next";

import { OutreachStudio } from "@/components/outreach-studio";

export const metadata: Metadata = {
  title: "Outreach Studio",
};

export default function OutreachPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            Science communication
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            Outreach Studio
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Create simple outreach material from information already available in
            DhruvSetu.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm text-sky-900">
            Review outreach drafts before publishing. Verification and source
            information are shown below.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        <OutreachStudio />
      </div>
    </>
  );
}
