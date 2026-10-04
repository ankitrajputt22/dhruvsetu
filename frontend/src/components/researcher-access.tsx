"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { FormError, SubmitButton } from "@/components/form-fields";
import { RequestStatusBadge } from "@/components/request-status";
import { ResearcherFields } from "@/components/researcher-fields";
import { type ApiResult, postApi } from "@/lib/api";
import { accountTypeLabels } from "@/lib/auth";
import {
  emptyResearcher,
  type FieldErrors,
  RESEARCHER_FIELDS,
  type ResearcherValues,
  researcherPayload,
  validateResearcher,
} from "@/lib/auth-validation";
import { formatDate } from "@/lib/format";
import { accessStatusMeanings } from "@/lib/researcher";
import type { ResearcherAccess } from "@/lib/types";

function requestFailure(result: ApiResult<ResearcherAccess>): string {
  if (result.status === null) {
    return "We could not reach DhruvSetu right now. Check your connection and try again.";
  }
  if (result.status === 401) {
    return "Please sign in again to send your request.";
  }
  if (result.status === 409 || result.status === 403) {
    return result.detail ?? "A new request cannot be sent right now.";
  }
  if (result.status === 422) {
    return "Some details were not accepted. Please check the form and try again.";
  }
  return "We could not send your request right now. Please try again.";
}

function RequestForm({ onSent }: { onSent: (access: ResearcherAccess) => void }) {
  const [values, setValues] = useState<ResearcherValues>(emptyResearcher);
  const [errors, setErrors] = useState<FieldErrors<ResearcherValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const sending = useRef(false);

  function change(part: Partial<ResearcherValues>) {
    const changed = { ...values, ...part };
    setValues(changed);
    if (attempted) {
      setErrors(validateResearcher(changed));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const found = validateResearcher(values);
    setAttempted(true);
    setErrors(found);
    setFormError(null);
    const firstProblem = RESEARCHER_FIELDS.find((field) => found[field]);
    if (firstProblem) {
      document.getElementById(`access-${firstProblem}`)?.focus();
      return;
    }

    sending.current = true;
    setBusy(true);
    const result = await postApi<ResearcherAccess>(
      "/api/researcher-access",
      researcherPayload(values),
    );
    sending.current = false;
    setBusy(false);
    if (result.data === null) {
      setFormError(requestFailure(result));
      return;
    }
    onSent(result.data);
  }

  return (
    <section
      aria-labelledby="request-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <h2 className="text-xl font-semibold text-slate-950" id="request-heading">
        Request Researcher Access
      </h2>
      <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm leading-6 text-sky-950">
        Researcher access requires administrator approval. Your account keeps normal
        user access until an administrator approves the request.
      </p>
      <form className="mt-5 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <ResearcherFields
          errors={errors}
          idPrefix="access"
          onChange={(field, value) => change({ [field]: value } as Partial<ResearcherValues>)}
          values={values}
        />
        <FormError message={formError} />
        <SubmitButton busy={busy} busyLabel="Sending your request…" label="Send Request" />
      </form>
    </section>
  );
}

// What a signed-in person sees about researcher access: where the account
// stands, the form when a request can be sent, and the requests made so far.
export function ResearcherAccessPanel({ initial }: { initial: ResearcherAccess }) {
  const [access, setAccess] = useState(initial);
  const [justSent, setJustSent] = useState(false);
  const latest = access.requests[0];
  const note = access.access_status === "rejected" ? latest?.decision_note : null;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="account-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <h2 className="text-xl font-semibold text-slate-950" id="account-heading">
          Your account
        </h2>
        <dl className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className="text-slate-500">Account type</dt>
            <dd className="text-slate-900">{accountTypeLabels[access.role]}</dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:items-center">
            <dt className="text-slate-500">Researcher access</dt>
            <dd>
              <RequestStatusBadge status={access.access_status} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {accessStatusMeanings[access.access_status]}
          {access.can_request && access.access_status !== "none" && " You can send a new request."}
        </p>
        {note && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <span className="font-semibold text-slate-900">Note from the administrator: </span>
            {note}
          </p>
        )}
        {justSent && (
          <p className="mt-3 text-sm font-medium text-emerald-800" role="status">
            Your request was sent.
          </p>
        )}
        {access.access_status === "approved" && (
          <Link
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
            href="/researcher"
          >
            Open Research Workspace <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>

      {access.can_request && (
        <RequestForm
          onSent={(updated) => {
            setAccess(updated);
            setJustSent(true);
          }}
        />
      )}

      {access.requests.length > 0 && (
        <section
          aria-labelledby="history-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <h2 className="text-xl font-semibold text-slate-950" id="history-heading">
            Your requests
          </h2>
          <ul className="mt-4 space-y-3">
            {access.requests.map((request) => (
              <li className="rounded-lg border border-slate-200 p-4 text-sm" key={request.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <RequestStatusBadge status={request.status} />
                  <span className="text-slate-600">
                    Sent {formatDate(request.created_at.slice(0, 10))}
                  </span>
                </div>
                <p className="mt-2 break-words font-medium text-slate-900">
                  {request.institution}
                </p>
                <p className="break-words text-slate-600">{request.research_area}</p>
                {request.decided_at && (
                  <p className="mt-1 text-slate-600">
                    Decided {formatDate(request.decided_at.slice(0, 10))}
                  </p>
                )}
                {request.decision_note && (
                  <p className="mt-1 break-words text-slate-700">
                    Note: {request.decision_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
