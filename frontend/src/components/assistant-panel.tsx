"use client";

import { useState } from "react";

import { AboutSources } from "@/components/about-sources";
import { DataMessage } from "@/components/page-heading";
import { SourceCard } from "@/components/source-card";
import { postApi } from "@/lib/api";
import type { AssistantAnswer } from "@/lib/types";

const MAX_QUESTION_LENGTH = 500;

const suggestedQuestions = [
  "What does the ice core record show about the Maud Rise Polynya?",
  "What did India's first winter Arctic expedition set out to study?",
  "Where was iodine monoxide observed in Antarctica?",
];

// Turns "Source 1" in the answer into a link to that source card. Only
// numbers that match a returned source become links.
function AnswerText({ answer, sourceCount }: { answer: string; sourceCount: number }) {
  return answer.split(/(Source \d+)/g).map((part, index) => {
    const match = /^Source (\d+)$/.exec(part);
    const number = match ? Number(match[1]) : 0;
    if (number >= 1 && number <= sourceCount) {
      return (
        <a
          key={index}
          className="font-medium text-sky-800 underline decoration-sky-300 hover:decoration-sky-800"
          href={`#source-${number}`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

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
            <p className="mt-4 whitespace-pre-line break-words rounded-xl border border-slate-200 bg-white p-5 leading-7 text-slate-800 shadow-sm">
              <AnswerText answer={result.answer} sourceCount={result.sources.length} />
            </p>

            {result.sources.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-semibold text-slate-950">Sources</h2>
                <ul className="mt-4 space-y-3">
                  {result.sources.map((source) => (
                    <SourceCard key={source.number} source={source} />
                  ))}
                </ul>
                <div className="mt-6">
                  <AboutSources />
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
