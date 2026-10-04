"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AboutSources } from "@/components/about-sources";
import { DemoLabel } from "@/components/demo-label";
import { RelatedResources } from "@/components/related-resources";
import { OriginalSourceLink } from "@/components/source-link";
import { VerificationBadge } from "@/components/verification-badge";
import { getApi, postApi } from "@/lib/api";
import type {
  OutreachAudience,
  OutreachFormat,
  OutreachResourceType,
  OutreachResult,
  OutreachSourceDetail,
  OutreachSourceOption,
} from "@/lib/types";

const resourceTypes: { value: OutreachResourceType; label: string; plural: string }[] = [
  { value: "expedition", label: "Expedition", plural: "expeditions" },
  { value: "publication", label: "Publication", plural: "publications" },
  { value: "dataset", label: "Dataset", plural: "datasets" },
  { value: "document", label: "Document", plural: "documents" },
  { value: "report", label: "Report", plural: "reports" },
];

const audiences: { value: OutreachAudience; label: string; hint: string }[] = [
  { value: "student", label: "Student", hint: "Simple wording with terms explained" },
  { value: "teacher", label: "Teacher", hint: "Teaching structure with a discussion prompt" },
  { value: "journalist", label: "Journalist", hint: "Short context with the source status" },
  { value: "public", label: "Public", hint: "Plain-language overview" },
];

const formats: { value: OutreachFormat; label: string }[] = [
  { value: "short_explanation", label: "Short Explanation" },
  { value: "social_post", label: "Social Media Post" },
  { value: "classroom_note", label: "Classroom Note" },
  { value: "news_brief", label: "News Brief" },
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50";
const labelClass = "text-xs font-semibold text-slate-700";
const buttonClass =
  "rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function fileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `outreach-${slug || "draft"}.txt`;
}

export function OutreachStudio() {
  const [resourceType, setResourceType] = useState<OutreachResourceType>("expedition");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<OutreachSourceOption[] | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [source, setSource] = useState<OutreachSourceDetail | null>(null);
  const [audience, setAudience] = useState<OutreachAudience>("student");
  const [format, setFormat] = useState<OutreachFormat>("short_explanation");
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [generated, setGenerated] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);

  // Load the records that can be chosen for this type and search text.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const parameters = new URLSearchParams({ type: resourceType });
      if (query.trim()) parameters.set("q", query.trim());
      const response = await getApi<OutreachSourceOption[]>(
        `/api/outreach/sources?${parameters.toString()}`,
      );
      if (cancelled) return;
      setOptions(response.data);
      setOptionsFailed(response.data === null);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resourceType, query]);

  async function chooseSource(option: OutreachSourceOption) {
    setProblem(null);
    const response = await getApi<OutreachSourceDetail>(
      `/api/outreach/sources/${option.resource_type}/${encodeURIComponent(option.id)}`,
    );
    if (response.data === null) {
      setProblem(response.detail ?? "We could not load this repository item right now.");
      return;
    }
    setSource(response.data);
    setResult(null);
    setGenerated("");
    setText("");
  }

  async function createDraft() {
    if (source === null || busy) return;
    if (
      result !== null &&
      text !== generated &&
      !window.confirm("Update the draft? Your edits to the current draft will be replaced.")
    ) {
      return;
    }

    setBusy(true);
    setProblem(null);
    const response = await postApi<OutreachResult>("/api/outreach/generate", {
      resource_type: source.resource_type,
      resource_id: source.id,
      audience,
      format,
    });
    setBusy(false);
    if (response.data === null) {
      setProblem(
        response.detail ??
          (response.status === null
            ? "We could not reach DhruvSetu right now."
            : "The draft could not be created."),
      );
      return;
    }

    // The draft names the DhruvSetu page. Make that a full link for readers.
    const href = response.data.source.href;
    const draft = href
      ? response.data.draft.text.replace(
          `DhruvSetu page: ${href}`,
          `DhruvSetu page: ${window.location.origin}${href}`,
        )
      : response.data.draft.text;
    setResult(response.data);
    setSource(response.data.source);
    setGenerated(draft);
    setText(draft);
    setCopyState(null);
  }

  async function copyDraft() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Older browsers: select the text and use the built-in copy command.
      editor.current?.select();
      copied = document.execCommand("copy");
    }
    setCopyState(copied ? "Copied" : "Copy did not work. Select the text and copy it yourself.");
    window.setTimeout(() => setCopyState(null), 3000);
  }

  function downloadDraft() {
    if (result === null) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(result.source.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const typeInfo = resourceTypes.find((item) => item.value === resourceType) ?? resourceTypes[0];
  const settingsChanged =
    result !== null &&
    (result.draft.audience !== audience ||
      result.draft.format !== format ||
      result.source.id !== source?.id);
  const warnings = source?.warnings ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_21rem]">
      <section aria-labelledby="outreach-settings" className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950" id="outreach-settings">
          Source and settings
        </h2>

        <div className="mt-4">
          <label className={labelClass} htmlFor="outreach-type">
            Resource type
          </label>
          <select
            className={fieldClass}
            id="outreach-type"
            onChange={(event) => {
              setResourceType(event.target.value as OutreachResourceType);
              setQuery("");
              setOptions(null);
            }}
            value={resourceType}
          >
            {resourceTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className={labelClass} htmlFor="outreach-search">
            Search {typeInfo.plural}
          </label>
          <input
            className={fieldClass}
            id="outreach-search"
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title or description"
            type="search"
            value={query}
          />
        </div>

        <div className="mt-3" aria-live="polite">
          {optionsFailed ? (
            <p className="text-sm text-amber-900">We could not load this list right now.</p>
          ) : options === null ? (
            <p className="text-sm text-slate-500">Loading {typeInfo.plural}...</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-500">No {typeInfo.plural} match this search.</p>
          ) : (
            <ul aria-label={`${typeInfo.label} records`} className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {options.map((option) => {
                const isSelected = source?.id === option.id;
                return (
                  <li key={option.id}>
                    <button
                      aria-pressed={isSelected}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-sky-600 bg-sky-50 text-sky-950"
                          : "border-slate-300 bg-white text-slate-800 hover:border-sky-500"
                      }`}
                      onClick={() => chooseSource(option)}
                      type="button"
                    >
                      <span className="block break-words font-medium">{option.title}</span>
                      {option.is_demo_data && (
                        <span className="mt-1 block text-xs text-amber-800">Demo Data</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <fieldset className="mt-5 border-t border-slate-200 pt-4">
          <legend className={`${labelClass} float-left mb-2 w-full`}>Audience</legend>
          <div className="clear-both space-y-2">
            {audiences.map((item) => (
              <label key={item.value} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                <input
                  checked={audience === item.value}
                  className="mt-1 accent-sky-800"
                  name="outreach-audience"
                  onChange={() => setAudience(item.value)}
                  type="radio"
                  value={item.value}
                />
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5 border-t border-slate-200 pt-4">
          <legend className={`${labelClass} float-left mb-2 w-full`}>Content format</legend>
          <div className="clear-both space-y-2">
            {formats.map((item) => (
              <label key={item.value} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  checked={format === item.value}
                  className="accent-sky-800"
                  name="outreach-format"
                  onChange={() => setFormat(item.value)}
                  type="radio"
                  value={item.value}
                />
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          className={`${buttonClass} mt-5 w-full border-sky-800 bg-sky-800 text-white hover:bg-sky-900`}
          disabled={source === null || busy}
          onClick={createDraft}
          type="button"
        >
          {busy ? "Creating..." : result === null ? "Create Draft" : "Update Draft"}
        </button>
        {source === null && (
          <p className="mt-2 text-xs text-slate-500">Choose a repository item first.</p>
        )}
      </section>

      <section aria-labelledby="outreach-draft" className="min-w-0">
        <h2 className="sr-only" id="outreach-draft">
          Draft
        </h2>
        {problem !== null && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="alert">
            {problem}
          </p>
        )}

        {source === null ? (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-slate-600 shadow-sm">
            Choose a repository item to create an outreach draft.
          </p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
              Draft based on
            </p>
            <p className="mt-1 break-words text-lg font-semibold text-slate-950">{source.title}</p>

            {warnings.length > 0 && (
              <ul aria-label="Source notices" className="mt-4 space-y-2">
                {warnings.map((warning) => (
                  <li
                    key={warning.code}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900"
                  >
                    {warning.message}
                  </li>
                ))}
              </ul>
            )}

            {result === null ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Check the source information, choose an audience and a format,
                then select Create Draft. The draft is built only from this
                repository record.
              </p>
            ) : (
              <>
                {settingsChanged && (
                  <p className="mt-4 rounded-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-900" role="status">
                    The source or settings have changed. Select Update Draft to apply them.
                  </p>
                )}
                <label className={`${labelClass} mt-5 block`} htmlFor="outreach-editor">
                  Outreach draft (you can edit it)
                </label>
                <textarea
                  className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-base leading-6 text-slate-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50 sm:text-sm"
                  id="outreach-editor"
                  onChange={(event) => setText(event.target.value)}
                  ref={editor}
                  rows={Math.min(28, Math.max(10, text.split("\n").length + 2))}
                  value={text}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    className={`${buttonClass} border-sky-800 bg-sky-800 text-white hover:bg-sky-900`}
                    onClick={copyDraft}
                    type="button"
                  >
                    Copy
                  </button>
                  <button
                    className={`${buttonClass} border-slate-300 bg-white text-slate-800 hover:border-sky-600 hover:text-sky-800`}
                    onClick={downloadDraft}
                    type="button"
                  >
                    Download .txt
                  </button>
                  <p aria-live="polite" className="text-sm font-medium text-emerald-800">
                    {copyState}
                  </p>
                </div>
                <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                  Review outreach drafts before publishing. Verification and
                  source information are shown with the source evidence. This
                  draft was made by fixed templates, not by an AI model.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <aside aria-labelledby="outreach-evidence" className="h-fit space-y-5 lg:col-span-2 xl:col-span-1">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950" id="outreach-evidence">
            Source evidence
          </h2>
          {source === null ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The repository record behind the draft will be shown here.
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                {source.type_label}
              </p>
              <p className="mt-1 break-words font-semibold text-slate-950">{source.title}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {source.is_demo_data && <DemoLabel />}
                <VerificationBadge status={source.verification_status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {source.summary ?? "The repository has no description for this record."}
              </p>

              {source.facts.length > 0 && (
                <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                  {source.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {fact.label}
                      </dt>
                      <dd className="break-words text-slate-800">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {source.related_resources.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <RelatedResources resources={source.related_resources} />
                </div>
              )}

              {source.media.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Related media records
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-sm text-slate-800">
                    {source.media.map((item) => (
                      <li key={item.title} className="break-words">
                        {item.title} <span className="capitalize text-slate-500">({item.media_type})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-slate-500">Listed for reference only.</p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
                {source.href && (
                  <Link className="text-sm font-semibold text-sky-800 hover:underline" href={source.href}>
                    View in DhruvSetu
                    <span className="sr-only">: {source.title}</span>
                  </Link>
                )}
                <OriginalSourceLink title={source.title} url={source.source_url} />
                {source.source_url === null && (
                  <p className="text-xs text-slate-500">Original source: Not available</p>
                )}
              </div>
            </>
          )}
        </section>
        <AboutSources />
      </aside>
    </div>
  );
}
