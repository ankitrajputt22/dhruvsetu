import type { Metadata } from "next";

import { ResearcherOnly, WorkspaceFrame } from "@/components/researcher";
import { SubmissionForm } from "@/components/submission-form";
import { getApi } from "@/lib/api";
import { getResearcherOrRedirect } from "@/lib/auth-server";
import type { Expedition, ResearchTopic } from "@/lib/types";

export const metadata: Metadata = {
  title: "Submit a Document",
};

export default async function SubmitDocumentPage() {
  if ((await getResearcherOrRedirect("/researcher/submit/document")) === null) {
    return <ResearcherOnly />;
  }
  const [expeditions, topics] = await Promise.all([
    getApi<Expedition[]>("/api/expeditions"),
    getApi<ResearchTopic[]>("/api/topics"),
  ]);

  return (
    <WorkspaceFrame back description="Add a document to the DhruvSetu repository. It is read into text so it can be searched and cited." title="Submit a Document">
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SubmissionForm
          expeditions={(expeditions.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
          kind="document"
          topics={(topics.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
        />
      </div>
    </WorkspaceFrame>
  );
}
