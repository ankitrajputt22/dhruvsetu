import type { Metadata } from "next";

import { AssistantPanel } from "@/components/assistant-panel";

export const metadata: Metadata = {
  title: "Ask DhruvSetu",
};

export default function AssistantPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            Repository assistant
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
            Ask DhruvSetu
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Ask a question using information available in the DhruvSetu repository.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        <AssistantPanel />
      </div>
    </>
  );
}
