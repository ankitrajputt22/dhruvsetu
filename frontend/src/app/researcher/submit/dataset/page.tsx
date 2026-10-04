import type { Metadata } from "next";

import { ResearcherOnly, WorkspaceFrame } from "@/components/researcher";
import { SubmissionForm } from "@/components/submission-form";
import { getApi } from "@/lib/api";
import { getResearcherOrRedirect } from "@/lib/auth-server";
import type { Expedition, ResearchTopic } from "@/lib/types";

export const metadata: Metadata = {
  title: "Submit a Dataset",
};

export default async function SubmitDatasetPage() {
  if ((await getResearcherOrRedirect("/researcher/submit/dataset")) === null) {
    return <ResearcherOnly />;
  }
  const [expeditions, topics] = await Promise.all([
    getApi<Expedition[]>("/api/expeditions"),
    getApi<ResearchTopic[]>("/api/topics"),
  ]);

  return (
    <WorkspaceFrame back description="Add a data file to the DhruvSetu repository. It opens in the Dataset Explorer for review." title="Submit a Dataset">
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SubmissionForm
          expeditions={(expeditions.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
          kind="dataset"
          topics={(topics.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
        />
      </div>
    </WorkspaceFrame>
  );
}
