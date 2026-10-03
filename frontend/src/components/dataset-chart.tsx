"use client";

import { useEffect, useId, useRef, useState } from "react";

import { formatNumber } from "@/lib/format";

export type ChartPoint = { x: number | string; y: number };

const TOP = 28;
const RIGHT = 16;
const BOTTOM = 46;
// Space kept inside the plot so the first and last marks are not cut off.
const INSET = 10;
const MARK_COLOR = "#0369a1";

function niceTicks(minimum: number, maximum: number): number[] {
  let low = minimum;
  let high = maximum;
  if (low === high) {
    const pad = Math.abs(low) || 1;
    low -= pad;
    high += pad;
  }
  const rawStep = (high - low) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const ratio = rawStep / magnitude;
  const step = (ratio > 5 ? 10 : ratio > 2 ? 5 : ratio > 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (
    let value = Math.floor(low / step) * step;
    value <= Math.ceil(high / step) * step + step / 2;
    value += step
  ) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

function shorten(label: string): string {
  return label.length > 14 ? `${label.slice(0, 13)}…` : label;
}

function label(value: number | string): string {
  return typeof value === "number" ? formatNumber(value) : value;
}

// A single-series line or bar chart drawn as plain SVG.
export function DatasetChart({
  points,
  kind,
  xName,
  yName,
  numericX,
}: {
  points: ChartPoint[];
  kind: "line" | "bar";
  xName: string;
  yName: string;
  numericX: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(520);
  const wrapper = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const linear = kind === "line" && numericX;

  // The chart is drawn at its real size so text stays readable on any screen.
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = Math.round(Math.min(320, Math.max(220, width * 0.5)));

  const values = points.map((point) => point.y);
  const yTicks = niceTicks(
    kind === "bar" ? Math.min(0, ...values) : Math.min(...values),
    kind === "bar" ? Math.max(0, ...values) : Math.max(...values),
  );
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const left = Math.max(...yTicks.map((tick) => formatNumber(tick).length)) * 7 + 18;
  const plotWidth = width - left - RIGHT;
  const plotHeight = height - TOP - BOTTOM;
  const yPosition = (value: number) =>
    TOP + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const xNumbers = linear ? points.map((point) => point.x as number) : [];
  const xLow = linear ? Math.min(...xNumbers) : 0;
  const xHigh = linear ? Math.max(...xNumbers) : 0;
  const xScale = (value: number) =>
    xHigh === xLow
      ? left + plotWidth / 2
      : left + INSET + ((value - xLow) / (xHigh - xLow)) * (plotWidth - INSET * 2);
  const xTicks = linear
    ? niceTicks(xLow, xHigh).filter((tick) => tick >= xLow && tick <= xHigh)
    : [];
  const band = plotWidth / points.length;
  const xPosition = (index: number) =>
    linear ? xScale(points[index].x as number) : left + band * (index + 0.5);

  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 76)));
  const barWidth = Math.min(24, band * 0.7);
  const baseline = yPosition(Math.max(yMin, Math.min(0, yMax)));
  const activePoint = active === null ? null : points[active];

  function nearestIndex(clientX: number, element: SVGSVGElement): number {
    const x = clientX - element.getBoundingClientRect().left;
    let nearest = 0;
    points.forEach((_, index) => {
      if (Math.abs(xPosition(index) - x) < Math.abs(xPosition(nearest) - x)) {
        nearest = index;
      }
    });
    return nearest;
  }

  function moveActive(step: number) {
    setActive((current) => {
      const next = current === null ? (step > 0 ? 0 : points.length - 1) : current + step;
      return Math.max(0, Math.min(points.length - 1, next));
    });
  }

  return (
    <div className="relative" ref={wrapper}>
      <svg
        aria-describedby={descriptionId}
        aria-label={`${kind === "line" ? "Line" : "Bar"} chart of ${yName} by ${xName}`}
        className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        height={height}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") moveActive(1);
          else if (event.key === "ArrowLeft") moveActive(-1);
          else if (event.key === "Home") setActive(0);
          else if (event.key === "End") setActive(points.length - 1);
          else if (event.key === "Escape") setActive(null);
          else return;
          event.preventDefault();
        }}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => setActive(nearestIndex(event.clientX, event.currentTarget))}
        role="img"
        tabIndex={0}
        width={width}
      >
        <text className="fill-slate-500 text-[12px]" x={left} y={14}>
          {shorten(yName)}
        </text>

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"}
              strokeWidth="1"
              x1={left}
              x2={width - RIGHT}
              y1={yPosition(tick)}
              y2={yPosition(tick)}
            />
            <text
              className="fill-slate-500 text-[12px] tabular-nums"
              dominantBaseline="middle"
              textAnchor="end"
              x={left - 8}
              y={yPosition(tick)}
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {linear
          ? xTicks.map((tick) => (
              <text
                key={tick}
                className="fill-slate-500 text-[12px] tabular-nums"
                textAnchor="middle"
                x={xScale(tick)}
                y={height - BOTTOM + 18}
              >
                {formatNumber(tick)}
              </text>
            ))
          : points.map(
              (point, index) =>
                index % labelEvery === 0 && (
                  <text
                    key={index}
                    className="fill-slate-500 text-[12px]"
                    textAnchor="middle"
                    x={xPosition(index)}
                    y={height - BOTTOM + 18}
                  >
                    {shorten(label(point.x))}
                  </text>
                ),
            )}
        <text
          className="fill-slate-500 text-[12px]"
          textAnchor="middle"
          x={left + plotWidth / 2}
          y={height - 6}
        >
          {shorten(xName)}
        </text>

        {active !== null && kind === "line" && (
          <line
            stroke="#94a3b8"
            strokeWidth="1"
            x1={xPosition(active)}
            x2={xPosition(active)}
            y1={TOP}
            y2={TOP + plotHeight}
          />
        )}

        {kind === "bar" ? (
          points.map((point, index) => {
            const top = Math.min(yPosition(point.y), baseline);
            const height = Math.max(Math.abs(yPosition(point.y) - baseline), 1);
            const radius = Math.min(4, barWidth / 2, height);
            const start = xPosition(index) - barWidth / 2;
            const end = start + barWidth;
            const bottom = top + height;
            // Rounded at the value end, square at the baseline.
            const path =
              point.y >= 0
                ? `M${start},${bottom} V${top + radius} Q${start},${top} ${start + radius},${top} H${end - radius} Q${end},${top} ${end},${top + radius} V${bottom} Z`
                : `M${start},${top} V${bottom - radius} Q${start},${bottom} ${start + radius},${bottom} H${end - radius} Q${end},${bottom} ${end},${bottom - radius} V${top} Z`;
            return (
              <path
                key={index}
                d={path}
                fill={MARK_COLOR}
                opacity={active === null || active === index ? 1 : 0.55}
              />
            );
          })
        ) : (
          <>
            <path
              d={points
                .map((point, index) => `${index === 0 ? "M" : "L"}${xPosition(index)},${yPosition(point.y)}`)
                .join(" ")}
              fill="none"
              stroke={MARK_COLOR}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            {points.map(
              (point, index) =>
                (points.length <= 30 || index === active) && (
                  <circle
                    key={index}
                    cx={xPosition(index)}
                    cy={yPosition(point.y)}
                    fill={MARK_COLOR}
                    r={index === active ? 5 : 4}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                ),
            )}
          </>
        )}
      </svg>

      {activePoint && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max max-w-[11rem] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(width - 88, Math.max(88, xPosition(active))) }}
        >
          <p className="font-semibold text-slate-950">
            {formatNumber(activePoint.y)}{" "}
            <span className="font-normal text-slate-500">{shorten(yName)}</span>
          </p>
          <p className="mt-0.5 text-slate-600">
            {shorten(xName)}: {shorten(label(activePoint.x))}
          </p>
        </div>
      )}

      <p className="sr-only" id={descriptionId}>
        {points.length} values. Use the left and right arrow keys to read each value.
        The same values are in the data preview table.
      </p>
      <p aria-live="polite" className="sr-only">
        {activePoint
          ? `${xName} ${label(activePoint.x)}, ${yName} ${formatNumber(activePoint.y)}`
          : ""}
      </p>
    </div>
  );
}
