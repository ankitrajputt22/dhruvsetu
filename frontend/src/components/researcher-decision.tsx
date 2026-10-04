"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { type ApiResult, postApi } from "@/lib/api";
import type { AdminResearcherRequestDetail } from "@/lib/types";

type Action = "approve" | "reject";

function decisionFailure(result: ApiResult<AdminResearcherRequestDetail>): string {
  if (result.status === null) {
    return "We could not reach DhruvSetu right now. Check your connection and try again.";
  }
  if (result.status === 401) {
    return "Please sign in again to decide this request.";
  }
  if ([403, 404, 409].includes(result.status)) {
    return result.detail ?? "This request cannot be decided.";
  }
  return "The decision could not be saved. Please try again.";
}

// The Approve and Reject controls for one waiting request. A decision is
// only sent after it has been confirmed.
export function ResearcherDecision({
  requestId,
  applicantName,
}: {
  requestId: string;
  applicantName: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  async function decide(action: Action) {
    if (sending.current) {
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    const result = await postApi<AdminResearcherRequestDetail>(
      `/api/admin/researcher-requests/${encodeURIComponent(requestId)}/${action}`,
      { note: note.trim() || null },
    );
    sending.current = false;
    setBusy(false);
    if (result.data === null) {
      setConfirming(null);
      setError(decisionFailure(result));
      return;
    }
    // The page is asked for again and now shows the decision.
    router.refresh();
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-800" htmlFor="decision-note">
        Note for the applicant <span className="font-normal text-slate-500">(optional)</span>
      </label>
      <textarea
        aria-describedby="decision-note-hint"
        className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-200"
        disabled={busy}
        id="decision-note"
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        value={note}
      />
      <p className="mt-1.5 text-xs leading-5 text-slate-500" id="decision-note-hint">
        The applicant sees this note together with the decision.
      </p>

      {confirming === null ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
            onClick={() => setConfirming("approve")}
            type="button"
          >
            Approve
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            onClick={() => setConfirming("reject")}
            type="button"
          >
            Reject
          </button>
        </div>
      ) : (
        <div
          aria-labelledby="decision-confirm"
          className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4"
          role="group"
        >
          <p className="text-sm leading-6 text-slate-800" id="decision-confirm">
            {confirming === "approve"
              ? `Approve this request? ${applicantName} becomes a Researcher, is signed out, and signs in again to use the new access.`
              : `Reject this request? ${applicantName} stays a General User and can send a new request later.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              aria-busy={busy}
              autoFocus
              className="rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => void decide(confirming)}
              type="button"
            >
              {busy
                ? "Saving the decision…"
                : confirming === "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
            </button>
            <button
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
              disabled={busy}
              onClick={() => setConfirming(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="sr-only" role="status">
        {busy ? "Saving the decision…" : ""}
      </p>
      {error !== null && (
        <p
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
