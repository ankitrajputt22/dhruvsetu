"use client";

import { useSyncExternalStore } from "react";

import { useAuth } from "@/components/auth";
import { signedUpAsResearcher } from "@/lib/auth";

const subscribe = () => () => {};

// Shown on the welcome page to the person who has just asked for researcher
// access while signing up in this browser tab.
export function ResearcherRequestNote() {
  const user = useAuth();
  const requested = useSyncExternalStore(
    subscribe,
    () => user !== null && signedUpAsResearcher(user.id),
    () => false,
  );

  if (!requested) {
    return null;
  }
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-950">
      <p className="font-semibold">Your request for researcher access has been saved.</p>
      <p className="mt-1">
        Researcher access requires administrator approval. Until an administrator
        approves it, your account has normal user access.
      </p>
    </div>
  );
}
