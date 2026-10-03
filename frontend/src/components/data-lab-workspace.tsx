"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { DataLabResultView } from "@/components/data-lab-output";
import { DemoLabel } from "@/components/demo-label";
import { VerificationBadge } from "@/components/verification-badge";
import { deleteApi, getApi, postApi } from "@/lib/api";
import type {
  DataLabResult,
  DataLabSession,
  DatasetDetail,
  DatasetPreview,
} from "@/lib/types";

type Cell = {
  id: number;
  title: string | null;
  code: string;
  state: "idle" | "running" | "done";
  result: DataLabResult | null;
  message: string | null;
};

type Phase = "starting" | "ready" | "ended" | "failed";

const phaseLabels: Record<Phase, string> = {
  starting: "Starting session",
  ready: "Session ready",
  ended: "Session ended",
  failed: "Session could not start",
};

function sessionPath(sessionId: string): string {
  return `/api/data-lab/sessions/${encodeURIComponent(sessionId)}`;
}

export function DataLabWorkspace({ dataset }: { dataset: DatasetDetail }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [problem, setProblem] = useState<string | null>(null);
  const [session, setSession] = useState<DataLabSession | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const nextId = useRef(1);
  const sessionId = useRef<string | null>(null);

  const startSession = useCallback(async () => {
    setPhase("starting");
    setProblem(null);
    const result = await postApi<DataLabSession>("/api/data-lab/sessions", {
      dataset_id: dataset.id,
    });
    if (result.data === null) {
      setPhase("failed");
      setProblem(
        result.detail ??
          (result.status === null
            ? "We could not reach DhruvSetu right now."
            : "The analysis session could not be started."),
      );
      return null;
    }
    sessionId.current = result.data.session_id;
    setSession(result.data);
    setPhase("ready");
    return result.data;
  }, [dataset.id]);

  // Start one session when the page opens and end it when the page closes.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const created = await startSession();
      if (created === null) return;
      if (cancelled) {
        void deleteApi(sessionPath(created.session_id), true);
        return;
      }
      setCells(
        created.starter_cells.map((cell) => ({
          id: nextId.current++,
          title: cell.title,
          code: cell.code,
          state: "idle",
          result: null,
          message: null,
        })),
      );
    }, 50);

    const endOnLeave = () => {
      if (sessionId.current) {
        void deleteApi(sessionPath(sessionId.current), true);
        sessionId.current = null;
      }
    };
    window.addEventListener("pagehide", endOnLeave);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", endOnLeave);
      endOnLeave();
    };
  }, [startSession]);

  useEffect(() => {
    let cancelled = false;
    getApi<DatasetPreview>(`/api/datasets/${encodeURIComponent(dataset.id)}/preview`).then(
      (result) => {
        if (!cancelled && result.data !== null) setPreview(result.data);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dataset.id]);

  function updateCell(id: number, changes: Partial<Cell>) {
    setCells((current) => current.map((cell) => (cell.id === id ? { ...cell, ...changes } : cell)));
  }

  async function runCell(cell: Cell): Promise<boolean> {
    if (!session || phase !== "ready") return false;
    if (!cell.code.trim()) {
      updateCell(cell.id, { result: null, message: "Write some Python code first." });
      return false;
    }

    updateCell(cell.id, { state: "running", message: null });
    const result = await postApi<DataLabResult>(`${sessionPath(session.session_id)}/execute`, {
      code: cell.code,
    });
    if (result.data === null) {
      if (result.status === 404) {
        sessionId.current = null;
        setPhase("ended");
      }
      updateCell(cell.id, {
        state: "idle",
        result: null,
        message:
          result.detail ??
          (result.status === null
            ? "We could not reach DhruvSetu right now."
            : "The cell could not be run."),
      });
      return false;
    }
    updateCell(cell.id, { state: "done", result: result.data });
    return result.data.status === "ok";
  }

  async function run(cell: Cell) {
    if (busy) return;
    setBusy(true);
    await runCell(cell);
    setBusy(false);
  }

  async function runAll() {
    if (busy) return;
    setBusy(true);
    for (const cell of cells) {
      // Stop at the first cell that fails, like a notebook does.
      if (!(await runCell(cell))) break;
    }
    setBusy(false);
  }

  function addCell(code = "", title: string | null = null) {
    setCells((current) => [
      ...current,
      { id: nextId.current++, title, code, state: "idle", result: null, message: null },
    ]);
  }

  async function resetSession() {
    if (busy) return;
    const confirmed = window.confirm(
      "Reset the session? Variables and files created in this session will be lost. Your code stays on the page.",
    );
    if (!confirmed) return;

    setBusy(true);
    if (sessionId.current) {
      await deleteApi(sessionPath(sessionId.current));
      sessionId.current = null;
    }
    setSession(null);
    setCells((current) =>
      current.map((cell) => ({ ...cell, state: "idle", result: null, message: null })),
    );
    await startSession();
    setBusy(false);
  }

  const columns = preview?.columns ?? [];
  const firstColumn = columns[0]?.name;
  const numberColumn = columns.find((column) => column.type === "number" && column.name !== firstColumn)?.name;
  const textColumn = columns.find((column) => column.type === "text")?.name;
  const examples = [
    { title: "Show the first rows", code: "df.head()" },
    { title: "Summarize numeric columns", code: "df.describe()" },
    ...(textColumn
      ? [
          {
            title: "Count the values in a column",
            code: `df[${JSON.stringify(textColumn)}].value_counts()`,
          },
        ]
      : []),
    {
      title: "Create a chart",
      code:
        firstColumn && numberColumn
          ? `import matplotlib.pyplot as plt\n\ndf.plot(x=${JSON.stringify(firstColumn)}, y=${JSON.stringify(numberColumn)})\nplt.show()`
          : 'import matplotlib.pyplot as plt\n\ndf.select_dtypes("number").plot()\nplt.show()',
    },
  ];

  const canRun = phase === "ready" && !busy;
  const buttonClass =
    "rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800" role="status">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                phase === "ready"
                  ? "bg-emerald-500"
                  : phase === "starting"
                    ? "bg-amber-400"
                    : "bg-slate-400"
              }`}
            />
            {busy && phase === "ready" ? "Running" : phaseLabels[phase]}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={`${buttonClass} border-sky-800 bg-sky-800 text-white hover:bg-sky-900`}
              disabled={!canRun || cells.length === 0}
              onClick={runAll}
              type="button"
            >
              Run all cells
            </button>
            <button
              className={`${buttonClass} border-slate-300 bg-white text-slate-800 hover:border-sky-600 hover:text-sky-800`}
              disabled={busy || phase === "starting"}
              onClick={resetSession}
              type="button"
            >
              {phase === "ready" ? "Reset Session" : "Start New Session"}
            </button>
          </div>
        </div>

        {problem !== null && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="alert">
            {problem}
          </p>
        )}
        {phase === "ended" && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900" role="alert">
            This session has ended. Start a new session to keep working. Your code
            is still on the page.
          </p>
        )}
        {phase === "starting" && cells.length === 0 && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
            Starting an analysis session for this dataset...
          </p>
        )}

        <ol className="mt-5 space-y-5">
          {cells.map((cell, index) => {
            const label = `cell ${index + 1}`;
            const count = cell.result?.execution_count;
            return (
              <li key={cell.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">
                    Cell {index + 1}
                    {count ? <span className="text-slate-500"> · run {count}</span> : null}
                    {cell.title ? (
                      <span className="ml-2 normal-case tracking-normal text-slate-600">{cell.title}</span>
                    ) : null}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className={`${buttonClass} border-sky-800 bg-sky-800 px-4 py-1.5 text-white hover:bg-sky-900`}
                      disabled={!canRun}
                      onClick={() => run(cell)}
                      type="button"
                    >
                      {cell.state === "running" ? "Running..." : "Run"}
                      <span className="sr-only"> {label}</span>
                    </button>
                    <button
                      className={`${buttonClass} border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:border-red-400 hover:text-red-700`}
                      disabled={busy}
                      onClick={() => setCells((current) => current.filter((item) => item.id !== cell.id))}
                      type="button"
                    >
                      Delete
                      <span className="sr-only"> {label}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  aria-label={`Python code for ${label}`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-[13px] leading-6 text-slate-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50"
                  maxLength={20000}
                  onChange={(event) => updateCell(cell.id, { code: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.shiftKey || event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void run(cell);
                    }
                  }}
                  placeholder="Write Python here"
                  rows={Math.min(18, Math.max(2, cell.code.split("\n").length))}
                  spellCheck={false}
                  value={cell.code}
                />
                <div aria-live="polite" className="mt-3">
                  {cell.state === "running" && (
                    <p className="text-xs text-slate-500">Running...</p>
                  )}
                  {cell.message !== null && (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
                      {cell.message}
                    </p>
                  )}
                  {cell.state !== "running" && cell.result !== null && (
                    <DataLabResultView label={label} result={cell.result} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            className={`${buttonClass} border-sky-800 bg-white text-sky-800 hover:bg-sky-50`}
            disabled={phase === "starting" && cells.length === 0}
            onClick={() => addCell()}
            type="button"
          >
            Add Cell
          </button>
          <p className="text-xs text-slate-500">
            Press Shift and Enter in a cell to run it.
          </p>
        </div>
      </div>

      <aside className="h-fit space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-950">Dataset</h2>
          <p className="mt-2 break-words font-medium text-slate-950">
            <Link className="hover:text-sky-800 hover:underline" href={`/datasets/${dataset.id}`}>
              {dataset.title}
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dataset.is_demo_data && <DemoLabel />}
            <VerificationBadge status={dataset.verification_status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">File type:</dt>
              <dd className="uppercase">{dataset.file?.file_type ?? dataset.file_type}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">Path in session:</dt>
              <dd className="break-all font-mono text-[13px]">
                {session?.data_path ?? "Available when the session starts"}
              </dd>
            </div>
            {preview && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-slate-500">Size:</dt>
                <dd>
                  {preview.row_count} rows, {preview.column_count} columns
                </dd>
              </div>
            )}
          </dl>
          {columns.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Columns
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {columns.map((column) => (
                  <li key={column.name} className="flex justify-between gap-3">
                    <span className="break-all font-mono text-[13px] text-slate-900">{column.name}</span>
                    <span className="shrink-0 text-xs capitalize text-slate-500">{column.type}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Column types are detected from the file, not official metadata.
              </p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-950">Examples</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Each button adds a new cell. Run the loading cell first so that{" "}
            <span className="font-mono">df</span> exists.
          </p>
          <ul className="mt-3 space-y-2">
            {examples.map((example) => (
              <li key={example.title}>
                <button
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-800 transition hover:border-sky-600 hover:text-sky-800"
                  onClick={() => addCell(example.code, example.title)}
                  type="button"
                >
                  {example.title}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          <h2 className="text-sm font-semibold text-slate-950">About this session</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>The dataset file is read-only. Analysis cannot change it.</li>
            <li>The session has no internet access.</li>
            {session && (
              <>
                <li>A cell is stopped after {session.cell_timeout_seconds} seconds.</li>
                <li>The session ends after {session.idle_timeout_minutes} minutes without use.</li>
              </>
            )}
            <li>Files you create are removed when the session ends.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
