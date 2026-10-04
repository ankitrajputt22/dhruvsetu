import type { Metadata } from "next";

import { DataMessage, PageHeading } from "@/components/page-heading";
import { ResearcherAccessPanel } from "@/components/researcher-access";
import { getApiAsUser, getUserOrRedirect } from "@/lib/auth-server";
import type { ResearcherAccess } from "@/lib/types";

export const metadata: Metadata = {
  title: "Researcher Access",
};

export default async function ResearcherAccessPage() {
  await getUserOrRedirect("/account/researcher-access");
  const access = (await getApiAsUser<ResearcherAccess>("/api/researcher-access")).data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <PageHeading
        description="Researchers can submit documents and datasets for review. An administrator approves each request."
        eyebrow="Account"
        title="Researcher Access"
      />
      <div className="mt-8">
        {access === null ? (
          <DataMessage>We could not load this information right now.</DataMessage>
        ) : (
          <ResearcherAccessPanel initial={access} />
        )}
      </div>
    </div>
  );
}
