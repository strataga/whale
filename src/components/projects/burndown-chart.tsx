"use client";

type DataPoint = {
  date: string;
  remaining: number;
};

export function BurndownChart({
  data,
  total,
}: {
  data: DataPoint[];
  total: number;
}) {
  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Not enough data for a burndown chart yet. Complete some tasks to see the trend.
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxY = Math.max(total, ...data.map((d) => d.remaining));
  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - (v / maxY) * chartHeight;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.remaining)}`)
    .join(" ");

  // Ideal burndown line
  const idealPath = `M ${xScale(0)} ${yScale(total)} L ${xScale(data.length - 1)} ${yScale(0)}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold">Burndown</h3>
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[600px]"
          aria-label="Burndown chart"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = yScale(maxY * frac);
            return (
              <g key={frac}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {Math.round(maxY * frac)}
                </text>
              </g>
            );
          })}

          {/* Ideal line (dashed) */}
          <path
            d={idealPath}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />

          {/* Actual burndown */}
          <path
            d={linePath}
            fill="none"
            stroke="rgb(99 102 241)"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(d.remaining)}
              r={3}
              fill="rgb(99 102 241)"
            />
          ))}

          {/* X-axis labels (first and last) */}
          {[0, data.length - 1].map((i) => (
            <text
              key={i}
              x={xScale(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {data[i]!.date}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-indigo-500" />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-muted-foreground" />
          Ideal
        </span>
      </div>
    </div>
  );
}
