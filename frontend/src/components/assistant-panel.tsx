"use client";

import Link from "next/link";
import { useState } from "react";

import { DemoLabel } from "@/components/demo-label";
import { Icon } from "@/components/icons";
import { DataMessage } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { postApi } from "@/lib/api";
import { formatStatus } from "@/lib/format";
import type { AssistantAnswer } from "@/lib/types";

const MAX_QUESTION_LENGTH = 500;

const suggestedQuestions = [
  "What does the sea ice observation plan record?",
  "Why can one observation not describe Antarctic climate?",
  "What can affect which organisms are recorded in a field survey?",
];

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantAnswer | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setResult(null);
      setError("Please enter a question.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const response = await postApi<AssistantAnswer>("/api/assistant/ask", {
      question: trimmed,
    });

    if (response.data !== null) {
      setResult(response.data);
    } else if (response.status === null) {
      setError("We could not reach DhruvSetu right now. Please try again.");
    } else {
      setError(response.detail ?? "We could not answer this question right now.");
    }
    setIsLoading(false);
  }

  return (
    <div className="max-w-3xl">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label className="text-sm font-semibold text-slate-950" htmlFor="assistant-question">
          Your question
        </label>
        <textarea
          id="assistant-question"
          className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50"
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about the documents in the repository..."
          value={question}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Answers use only DhruvSetu source documents.
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg border border-sky-800 bg-sky-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Asking..." : "Ask"}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Try a question
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestedQuestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setQuestion(suggestion);
                  void ask(suggestion);
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:border-sky-500 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <section className="mt-8 border-t border-slate-200 pt-8" aria-live="polite">
        {isLoading ? (
          <DataMessage>Reading the DhruvSetu sources...</DataMessage>
        ) : error !== null ? (
          <p
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900"
          >
            {error}
          </p>
        ) : result === null ? (
          <DataMessage>Your answer and its sources will appear here.</DataMessage>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-slate-950">Answer</h2>
            <p className="mt-4 whitespace-pre-line rounded-xl border border-slate-200 bg-white p-5 leading-7 text-slate-800 shadow-sm">
              {result.answer}
            </p>

            {result.sources.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-semibold text-slate-950">Sources</h2>
                <ul className="mt-4 space-y-3">
                  {result.sources.map((source) => (
                    <li
                      key={source.number}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <article className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
                          <Icon name="document" className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800">
                            Source {source.number}
                          </p>
                          <h3 className="mt-1 font-semibold text-slate-950">{source.title}</h3>
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {source.source_type && (
                              <span className="capitalize">{formatStatus(source.source_type)}</span>
                            )}
                            {source.file_type && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span className="uppercase">{source.file_type}</span>
                              </>
                            )}
                            {source.page_number !== null && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span>Page {source.page_number}</span>
                              </>
                            )}
                          </p>
                          <Link
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-800 hover:underline"
                            href={source.href}
                          >
                            View Source <Icon name="arrow" className="h-4 w-4" />
                          </Link>
                        </div>
                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                          {source.is_demo_data && <DemoLabel />}
                          {source.verification_status && (
                            <StatusBadge status={source.verification_status} />
                          )}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
