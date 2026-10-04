"use client";

import { useEffect, useId, useState } from "react";

import { type ChartPoint, DatasetChart } from "@/components/dataset-chart";
import { DataMessage } from "@/components/page-heading";
import { getApi } from "@/lib/api";
import { formatDataValue, formatNumber, formatPlainNumber } from "@/lib/format";
import type { DatasetCell, DatasetPreview } from "@/lib/types";

const typeLabels = { number: "Number", text: "Text", empty: "Empty" };

// The table scroll boxes are "relative" so screen-reader-only labels inside
// wide tables stay clipped and cannot make the whole page scroll sideways.

// "exact" is for values taken from the file, "rounded" for calculated ones,
// and "count" for how many there are.
function Cell({
  value,
  as = "exact",
}: {
  value: DatasetCell;
  as?: "exact" | "rounded" | "count";
}) {
  if (value === null) {
    return (
      <>
        <span aria-hidden="true" className="text-slate-400">—</span>
        <span className="sr-only">empty</span>
      </>
    );
  }
  if (typeof value !== "number") {
    return <>{value}</>;
  }
  if (as === "count") {
    return <>{formatNumber(value)}</>;
  }
  return <>{as === "exact" ? formatDataValue(value) : formatPlainNumber(value)}</>;
}

export function DatasetPreviewPanel({ datasetId }: { datasetId: string }) {
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getApi<DatasetPreview>(`/api/datasets/${encodeURIComponent(datasetId)}/preview`).then(
      (result) => {
        if (cancelled) return;
        if (result.data !== null) {
          setPreview(result.data);
        } else {
          setError(result.detail ?? "The preview could not be loaded right now.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  if (error !== null) {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        {error}
      </p>
    );
  }
  if (preview === null) {
    return <DataMessage>Loading preview...</DataMessage>;
  }

  const shownRows = preview.rows.length;
  const shownColumns = preview.columns.length;
  const scope =
    preview.statistics_row_count < preview.row_count
      ? `the first ${formatNumber(preview.statistics_row_count)} rows`
      : "all rows";

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-slate-600">
          Showing {shownRows === preview.row_count ? "all" : "the first"}{" "}
          {formatNumber(shownRows)} of {formatNumber(preview.row_count)} rows
          {shownColumns < preview.column_count
            ? ` and the first ${shownColumns} of ${preview.column_count} columns`
            : ` and ${shownColumns} ${shownColumns === 1 ? "column" : "columns"}`}
          .
        </p>
        <div
          aria-label="Data preview table"
          className="relative mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400"
          role="region"
          tabIndex={0}
        >
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Preview of the first {shownRows} rows of this dataset file
            </caption>
            <thead className="sticky top-0 bg-slate-100 text-xs text-slate-700">
              <tr>
                {preview.columns.map((column) => (
                  <th
                    key={column.name}
                    className={`whitespace-nowrap px-3 py-2 font-semibold ${column.type === "number" ? "text-right" : ""}`}
                    scope="col"
                  >
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
              {preview.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((value, columnIndex) => (
                    <td
                      key={columnIndex}
                      className={`max-w-xs truncate whitespace-nowrap px-3 py-2 ${
                        preview.columns[columnIndex].type === "number"
                          ? "text-right tabular-nums"
                          : ""
                      }`}
                    >
                      <Cell value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-slate-950">Columns</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Types and statistics are calculated by DhruvSetu from {scope} of this
          file. They are not official dataset metadata.
        </p>
        <div
          aria-label="Column summary table"
          className="relative mt-3 overflow-x-auto rounded-lg border border-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400"
          role="region"
          tabIndex={0}
        >
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">Columns in this dataset file</caption>
            <thead className="bg-slate-100 text-xs text-slate-700">
              <tr>
                <th className="px-3 py-2 font-semibold" scope="col">Column</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold" scope="col">Detected type</th>
                <th className="px-3 py-2 text-right font-semibold" scope="col">Count</th>
                <th className="px-3 py-2 text-right font-semibold" scope="col">Minimum</th>
                <th className="px-3 py-2 text-right font-semibold" scope="col">Maximum</th>
                <th className="px-3 py-2 text-right font-semibold" scope="col">Mean</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
              {preview.columns.map((column) => (
                <tr key={column.name}>
                  <th className="whitespace-nowrap px-3 py-2 font-medium" scope="row">
                    {column.name}
                  </th>
                  <td className="px-3 py-2">{typeLabels[column.type] ?? column.type}</td>
                  {(["count", "minimum", "maximum", "mean"] as const).map((key) => (
                    <td key={key} className="px-3 py-2 text-right tabular-nums">
                      <Cell
                        as={key === "count" ? "count" : key === "mean" ? "rounded" : "exact"}
                        value={column.statistics ? column.statistics[key] : null}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ChartSection preview={preview} />
    </div>
  );
}

function ChartSection({ preview }: { preview: DatasetPreview }) {
  const names = preview.columns.map((column) => column.name);
  const numeric = preview.columns
    .filter((column) => column.type === "number")
    .map((column) => column.name);
  const usable = preview.columns
    .filter((column) => column.type !== "empty")
    .map((column) => column.name);

  const [kind, setKind] = useState<"line" | "bar">("line");
  const [xName, setXName] = useState(usable[0] ?? "");
  const [yName, setYName] = useState(
    numeric.find((name) => name !== usable[0]) ?? numeric[0] ?? "",
  );
  const controlId = useId();

  if (numeric.length === 0 || usable.length < 2) {
    return (
      <section>
        <h3 className="text-lg font-semibold text-slate-950">Chart</h3>
        <p className="mt-2 text-sm text-slate-600">
          A chart needs at least two columns, one of them with numbers. This
          file does not have that.
        </p>
      </section>
    );
  }

  const xIndex = names.indexOf(xName);
  const yIndex = names.indexOf(yName);
  const numericX = numeric.includes(xName);
  let points: ChartPoint[] = [];
  for (const row of preview.rows) {
    const x = row[xIndex];
    const y = row[yIndex];
    if (x !== null && typeof y === "number") {
      points.push({ x, y });
    }
  }
  const sorted = kind === "line" && numericX;
  if (sorted) {
    points = [...points].sort((a, b) => (a.x as number) - (b.x as number));
  }

  const selectClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50 focus:outline-none";

  return (
    <section>
      <h3 className="text-lg font-semibold text-slate-950">Chart</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor={`${controlId}-kind`}>
            Chart type
          </label>
          <select
            className={selectClass}
            id={`${controlId}-kind`}
            onChange={(event) => setKind(event.target.value as "line" | "bar")}
            value={kind}
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor={`${controlId}-x`}>
            X column
          </label>
          <select
            className={selectClass}
            id={`${controlId}-x`}
            onChange={(event) => setXName(event.target.value)}
            value={xName}
          >
            {usable.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor={`${controlId}-y`}>
            Y column
          </label>
          <select
            className={selectClass}
            id={`${controlId}-y`}
            onChange={(event) => setYName(event.target.value)}
            value={yName}
          >
            {numeric.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <figure className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <figcaption>
          <p className="break-words font-semibold text-slate-950">
            {yName} vs {xName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatNumber(points.length)} {points.length === 1 ? "value" : "values"} from{" "}
            {preview.rows.length === preview.row_count ? "all" : "the first"}{" "}
            {formatNumber(preview.rows.length)} rows of the file
            {sorted ? `, ordered by ${xName}` : ", in file order"}.
          </p>
        </figcaption>
        <div className="mt-4">
          {points.length === 0 ? (
            <p className="text-sm text-slate-600">
              These columns have no rows with values in both.
            </p>
          ) : (
            <DatasetChart
              key={`${kind}-${xName}-${yName}`}
              kind={kind}
              numericX={numericX}
              points={points}
              xName={xName}
              yName={yName}
            />
          )}
        </div>
      </figure>
    </section>
  );
}
