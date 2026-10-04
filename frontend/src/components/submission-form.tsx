"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  describedBy,
  FieldLabel,
  FieldMessage,
  FormError,
  inputClass,
  SubmitButton,
  TextField,
} from "@/components/form-fields";
import { VerificationBadge } from "@/components/verification-badge";
import { type ApiResult, postForm } from "@/lib/api";
import { isHttpUrl } from "@/lib/auth-validation";
import {
  DATASET_FILE_TYPES,
  DOCUMENT_FILE_TYPES,
  DOCUMENT_TYPES,
  fileProblem,
  MAX_DATASET_BYTES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/researcher";
import type { SubmissionItem } from "@/lib/types";

export type SubmissionOption = { id: string; name: string };

type Kind = "document" | "dataset";

type Values = {
  title: string;
  documentType: string;
  description: string;
  sourceUrl: string;
  publicationDate: string;
  expeditionId: string;
  topicId: string;
};

type Field = keyof Values | "file";
type Errors = Partial<Record<Field, string>>;

const empty: Values = {
  title: "",
  documentType: "",
  description: "",
  sourceUrl: "",
  publicationDate: "",
  expeditionId: "",
  topicId: "",
};

const fieldOrder: Field[] = ["title", "documentType", "file", "publicationDate", "sourceUrl"];

const settings = {
  document: {
    url: "/api/researcher/documents",
    types: DOCUMENT_FILE_TYPES,
    maxBytes: MAX_DOCUMENT_BYTES,
    fileHint: "A PDF or TXT file, up to 20 MB. The text must be readable, not a scan.",
    noun: "document",
  },
  dataset: {
    url: "/api/researcher/datasets",
    types: DATASET_FILE_TYPES,
    maxBytes: MAX_DATASET_BYTES,
    fileHint: "A CSV or JSON file, up to 5 MB, with column names and at least one row.",
    noun: "dataset",
  },
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function validate(kind: Kind, values: Values, file: File | null): Errors {
  const errors: Errors = {};
  if (values.title.trim().length < 3) {
    errors.title = "Enter a title of at least 3 characters.";
  }
  if (kind === "document" && !values.documentType) {
    errors.documentType = "Select the document type.";
  }
  const problem = fileProblem(file, settings[kind].types, settings[kind].maxBytes);
  if (problem !== null) {
    errors.file = problem;
  }
  if (kind === "document" && values.publicationDate && values.publicationDate > today()) {
    errors.publicationDate = "The publication date cannot be in the future.";
  }
  const sourceUrl = values.sourceUrl.trim();
  if (sourceUrl && !isHttpUrl(sourceUrl)) {
    errors.sourceUrl = "Enter a full web address that starts with http:// or https://.";
  }
  return errors;
}

// Only what the form collects is sent. The verification status and the
// submitter are set by the API and cannot be chosen here.
function formData(kind: Kind, values: Values, file: File): FormData {
  const form = new FormData();
  form.append("title", values.title.trim());
  const optional: [string, string][] = [
    ["source_url", values.sourceUrl.trim()],
    ["expedition_id", values.expeditionId],
  ];
  if (kind === "document") {
    form.append("document_type", values.documentType);
    optional.push(["publication_date", values.publicationDate]);
  } else {
    optional.push(["description", values.description.trim()], ["topic_id", values.topicId]);
  }
  for (const [name, value] of optional) {
    if (value) {
      form.append(name, value);
    }
  }
  form.append("file", file);
  return form;
}

function submissionFailure(result: ApiResult<SubmissionItem>, noun: string): string {
  if (result.status === null) {
    return "We could not reach DhruvSetu right now. Check your connection and try again.";
  }
  if (result.status === 401) {
    return "Please sign in again to submit.";
  }
  // These messages are written by DhruvSetu for the person submitting.
  if ([403, 409, 411, 413, 415, 422].includes(result.status)) {
    return (
      result.detail ?? "Some details were not accepted. Please check the form and try again."
    );
  }
  return `We could not submit this ${noun} right now. Please try again.`;
}

function OptionSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SubmissionOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel id={id} label={label} optional />
      <select
        className={`mt-1.5 ${inputClass(undefined)}`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// The form a researcher uses to submit one document or one dataset.
export function SubmissionForm({
  kind,
  expeditions,
  topics = [],
}: {
  kind: Kind;
  expeditions: SubmissionOption[];
  topics?: SubmissionOption[];
}) {
  const router = useRouter();
  const config = settings[kind];
  const [values, setValues] = useState<Values>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState<SubmissionItem | null>(null);
  const sending = useRef(false);

  function update(field: keyof Values, value: string) {
    const changed = { ...values, [field]: value };
    setValues(changed);
    if (attempted) {
      setErrors(validate(kind, changed, file));
    }
  }

  function chooseFile(chosen: File | null) {
    setFile(chosen);
    if (attempted) {
      setErrors(validate(kind, values, chosen));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const found = validate(kind, values, file);
    setAttempted(true);
    setErrors(found);
    setFormError(null);
    const firstProblem = fieldOrder.find((field) => found[field]);
    if (firstProblem || file === null) {
      document.getElementById(`submission-${firstProblem}`)?.focus();
      return;
    }

    sending.current = true;
    setBusy(true);
    const result = await postForm<SubmissionItem>(config.url, formData(kind, values, file));
    sending.current = false;
    setBusy(false);
    if (result.data === null) {
      setFormError(submissionFailure(result, config.noun));
      return;
    }
    setSubmitted(result.data);
    router.refresh();
  }

  if (submitted !== null) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6" role="status">
        <h2 className="text-lg font-semibold text-emerald-950">
          Your {config.noun} was submitted.
        </h2>
        <p className="mt-2 break-words font-medium text-slate-900">{submitted.title}</p>
        <div className="mt-2">
          <VerificationBadge status={submitted.verification_status} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          It is shown in the repository as Uploaded. An administrator reviews it
          before it can be marked Reviewed or Verified.
          {kind === "document" &&
            " It joins semantic search and Ask DhruvSetu when the search index is next rebuilt."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900"
            href={submitted.href}
          >
            View the record
          </Link>
          <Link
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            href="/researcher"
          >
            Back to Research Workspace
          </Link>
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            onClick={() => {
              setSubmitted(null);
              setValues(empty);
              setFile(null);
              setErrors({});
              setAttempted(false);
            }}
            type="button"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <TextField
        error={errors.title}
        id="submission-title"
        label="Title"
        maxLength={500}
        onChange={(value) => update("title", value)}
        value={values.title}
      />

      {kind === "document" ? (
        <div>
          <FieldLabel id="submission-documentType" label="Document Type" />
          <select
            className={`mt-1.5 ${inputClass(errors.documentType)}`}
            id="submission-documentType"
            onChange={(event) => update("documentType", event.target.value)}
            required
            value={values.documentType}
            {...describedBy("submission-documentType", undefined, errors.documentType)}
          >
            <option value="">Select a document type</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <FieldMessage error={errors.documentType} id="submission-documentType" />
        </div>
      ) : (
        <div>
          <FieldLabel id="submission-description" label="Description" optional />
          <textarea
            className={`mt-1.5 min-h-24 ${inputClass(undefined)}`}
            id="submission-description"
            maxLength={5000}
            onChange={(event) => update("description", event.target.value)}
            value={values.description}
            {...describedBy(
              "submission-description",
              "What the data shows, and how and where it was collected.",
              undefined,
            )}
          />
          <FieldMessage
            hint="What the data shows, and how and where it was collected."
            id="submission-description"
          />
        </div>
      )}

      <div>
        <FieldLabel id="submission-file" label="File" />
        <input
          accept={config.types.map((type) => `.${type}`).join(",")}
          className={`mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-sky-900 ${
            errors.file ? "border-red-600" : "border-slate-300"
          }`}
          id="submission-file"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          required
          type="file"
          {...describedBy("submission-file", config.fileHint, errors.file)}
        />
        <FieldMessage error={errors.file} hint={config.fileHint} id="submission-file" />
      </div>

      {kind === "document" && (
        <div>
          <FieldLabel id="submission-publicationDate" label="Publication Date" optional />
          <input
            className={`mt-1.5 ${inputClass(errors.publicationDate)}`}
            id="submission-publicationDate"
            max={today()}
            onChange={(event) => update("publicationDate", event.target.value)}
            type="date"
            value={values.publicationDate}
            {...describedBy("submission-publicationDate", undefined, errors.publicationDate)}
          />
          <FieldMessage error={errors.publicationDate} id="submission-publicationDate" />
        </div>
      )}

      {kind === "dataset" && topics.length > 0 && (
        <OptionSelect
          id="submission-topicId"
          label="Research Topic"
          onChange={(value) => update("topicId", value)}
          options={topics}
          placeholder="No topic"
          value={values.topicId}
        />
      )}

      {expeditions.length > 0 && (
        <OptionSelect
          id="submission-expeditionId"
          label="Related Expedition"
          onChange={(value) => update("expeditionId", value)}
          options={expeditions}
          placeholder="No expedition"
          value={values.expeditionId}
        />
      )}

      <TextField
        autoComplete="url"
        error={errors.sourceUrl}
        hint="Where the original is published, if it is online."
        id="submission-sourceUrl"
        label="Source URL"
        maxLength={2048}
        onChange={(value) => update("sourceUrl", value)}
        optional
        placeholder="https://"
        type="url"
        value={values.sourceUrl}
      />

      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-700">
        Your {config.noun} is saved as Uploaded, with your name as the submitter. Only
        an administrator can mark it Reviewed or Verified.
      </p>

      <FormError message={formError} />
      <SubmitButton
        busy={busy}
        busyLabel="Submitting…"
        label={kind === "document" ? "Submit Document" : "Submit Dataset"}
      />
    </form>
  );
}
