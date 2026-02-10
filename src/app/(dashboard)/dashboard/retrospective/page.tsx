"use client";

import * as React from "react";

type RetroData = {
  summary: string;
  tasksCompleted: number;
  tasksSlipped: Array<{ title: string; reason: string }>;
  botProductivity: Array<{ botName: string; tasksCompleted: number; avgMinutes: number }>;
  velocityTrend: string;
  recommendations: string[];
};

export default function RetrospectivePage() {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<RetroData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState(7);

  // AI route stays as fetch -- no DB-backed queries on this page
  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/retrospective", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error((d as { error?: string } | null)?.error ?? "Failed");
      }
      const d = await res.json();
      setData(d.retrospective);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">AI Retrospective</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated summary of recent activity, velocity trends, and recommendations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="retro-days" className="text-sm font-medium">
          Period (days)
        </label>
        <select
          id="retro-days"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Retrospective"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-semibold">Summary</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground">Tasks Completed</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{data.tasksCompleted}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground">Velocity Trend</p>
              <p className="mt-2 text-sm leading-relaxed">{data.velocityTrend}</p>
            </div>
          </div>

          {data.tasksSlipped.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-rose-400">Slipped Tasks</h3>
              <ul className="mt-3 space-y-2">
                {data.tasksSlipped.map((t, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-muted-foreground"> &mdash; {t.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.botProductivity.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold">Bot Productivity</h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="px-4 py-2 font-semibold">Bot</th>
                      <th className="px-4 py-2 font-semibold">Completed</th>
                      <th className="px-4 py-2 font-semibold">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.botProductivity.map((b, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">{b.botName}</td>
                        <td className="px-4 py-2">{b.tasksCompleted}</td>
                        <td className="px-4 py-2">{Math.round(b.avgMinutes)}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {data.recommendations.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold">Recommendations</h3>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {data.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
