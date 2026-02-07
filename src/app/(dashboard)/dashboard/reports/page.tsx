import { requireAuthContext } from "@/lib/server/auth-context";
import { getReportingSummary } from "@/lib/server/reporting";

export const runtime = "nodejs";

function formatDateTime(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ReportsPage() {
  const ctx = await requireAuthContext();
  const summary = getReportingSummary(ctx.workspaceId);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reporting</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Daily and weekly progress, plus bot activity across the workspace.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Tasks completed (7d)
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {summary.totals.completedLast7Days}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Tasks completed (30d)
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {summary.totals.completedLast30Days}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Daily completions</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Last 7 days of completed tasks.
          </p>
          <ul className="mt-4 space-y-2">
            {summary.daily.map((row) => (
              <li key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold text-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Weekly completions</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed tasks grouped by week.
          </p>
          {summary.weekly.length ? (
            <ul className="mt-4 space-y-2">
              {summary.weekly.map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold text-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No weekly data yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Bot activity</h3>
        </div>

        {summary.botActivity.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {summary.botActivity.map((entry) => {
                const userLabel =
                  entry.userName?.trim() || entry.userEmail?.trim() || "System";

                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-semibold text-foreground">
                        {entry.action}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {userLabel}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            No bot activity yet.
          </div>
        )}
      </section>
    </div>
  );
}
