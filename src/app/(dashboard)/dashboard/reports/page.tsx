"use client";

import { useCRPC } from "@/lib/convex/crpc";

function formatDateTime(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const crpc = useCRPC();
  const statsQuery = crpc.dashboard.stats.useQuery({});
  const activityQuery = crpc.dashboard.activityFeed.useQuery({ limit: 20 });

  if (statsQuery.isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;
  const activity = activityQuery.data ?? [];

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
            {stats?.completedThisWeek ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Active Projects
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {stats?.activeProjects ?? 0}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <a
          href="/api/export/tasks?format=csv"
          download
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Export CSV
        </a>
        <a
          href="/api/export/tasks?format=json"
          download
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Export JSON
        </a>
        <a
          href="/dashboard/retrospective"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary hover:bg-primary/20"
        >
          AI Retrospective
        </a>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-tight">Recent Activity</h3>

        {activity.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {activity.map((entry: any) => (
                <li
                  key={entry._id ?? entry.id}
                  className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-foreground">
                      {entry.action}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {entry.userName ?? entry.userEmail ?? "System"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry._creationTime ?? entry.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            No activity yet.
          </div>
        )}
      </section>
    </div>
  );
}
