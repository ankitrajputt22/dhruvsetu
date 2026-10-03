import { formatNumber } from "@/lib/format";
import type { DataLabOutput, DataLabResult, DatasetCell } from "@/lib/types";

function Value({ value }: { value: DatasetCell }) {
  if (value === null) {
    return (
      <>
        <span aria-hidden="true" className="text-slate-400">—</span>
        <span className="sr-only">empty</span>
      </>
    );
  }
  return <>{typeof value === "number" ? formatNumber(value) : value}</>;
}

function OutputItem({ output, label }: { output: DataLabOutput; label: string }) {
  if (output.type === "text") {
    const isWarning = output.stream === "stderr";
    return (
      <pre
        className={`max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg px-4 py-3 font-mono text-[13px] leading-6 ${
          isWarning ? "bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-900"
        }`}
      >
        {isWarning && <span className="sr-only">Warning output: </span>}
        {output.text}
      </pre>
    );
  }

  if (output.type === "table") {
    const shownRows = output.rows.length;
    const shownColumns = output.columns.length;
    const isCut = shownRows < output.total_rows || shownColumns < output.total_columns;
    return (
      <div>
        {/* "relative" keeps screen-reader-only labels inside the scroll box. */}
        <div
          aria-label={`Table output from ${label}`}
          className="relative max-h-96 overflow-auto rounded-lg border border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400"
          role="region"
          tabIndex={0}
        >
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">Table output from {label}</caption>
            <thead className="sticky top-0 bg-slate-100 text-xs text-slate-700">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-semibold" scope="col">
                  {output.index_name ?? <span className="sr-only">Row label</span>}
                </th>
                {output.columns.map((column, index) => (
                  <th key={index} className="whitespace-nowrap px-3 py-2 font-semibold" scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
              {output.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600" scope="row">
                    {output.index[rowIndex] ?? ""}
                  </th>
                  {row.map((value, columnIndex) => (
                    <td
                      key={columnIndex}
                      className={`max-w-xs truncate whitespace-nowrap px-3 py-2 ${
                        typeof value === "number" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      <Value value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {isCut
            ? `Showing ${shownRows} of ${formatNumber(output.total_rows)} rows and ${shownColumns} of ${output.total_columns} columns.`
            : `${shownRows} ${shownRows === 1 ? "row" : "rows"}, ${shownColumns} ${shownColumns === 1 ? "column" : "columns"}.`}
        </p>
      </div>
    );
  }

  if (output.type === "image") {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
        {/* The image is a PNG checked by the backend, shown from its data only. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Chart output from ${label}`}
          className="h-auto max-w-full"
          src={`data:image/png;base64,${output.data}`}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
      <p className="break-words font-semibold">
        {output.name}
        {output.message ? `: ${output.message}` : ""}
      </p>
      {output.traceback && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold">Show error details</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5">
            {output.traceback}
          </pre>
        </details>
      )}
    </div>
  );
}

export function DataLabResultView({ result, label }: { result: DataLabResult; label: string }) {
  return (
    <div className="space-y-3">
      {result.outputs.length === 0 && result.status === "ok" && (
        <p className="text-xs text-slate-500">The cell ran and produced no output.</p>
      )}
      {result.outputs.map((output, index) => (
        <OutputItem key={index} label={label} output={output} />
      ))}
      {result.truncated && (
        <p className="text-xs text-amber-800">
          Some output was left out because it was too long.
        </p>
      )}
      {result.state_lost && (
        <p className="text-xs text-amber-800">
          The session was restarted. Run the earlier cells again to restore your variables.
        </p>
      )}
    </div>
  );
}
