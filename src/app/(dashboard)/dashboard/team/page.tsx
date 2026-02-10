"use client";

import { useMemo } from "react";

import { useCRPC } from "@/lib/convex/crpc";

export default function TeamPage() {
  const crpc = useCRPC();
  const usersQuery = crpc.users.list.useQuery({});
  const tasksQuery = crpc.tasks.list.useQuery({ limit: 200 });
  const projectsQuery = crpc.projects.list.useQuery({});

  const isPending =
    usersQuery.isPending || tasksQuery.isPending || projectsQuery.isPending;

  const teamMembers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const { countsByUser, unassignedCount } = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const projects = projectsQuery.data ?? [];
    const projectIds = new Set(projects.map((p) => p._id));

    // Only count tasks that belong to workspace projects
    const workspaceTasks = tasks.filter(
      (t) => t.projectId === undefined || projectIds.has(t.projectId),
    );

    const counts = new Map<
      string,
      {
        total: number;
        todo: number;
        inProgress: number;
        done: number;
        estimatedMinutes: number;
      }
    >();

    let unassigned = 0;

    for (const t of workspaceTasks) {
      if (!t.assigneeId) {
        if (t.status !== "done") unassigned++;
        continue;
      }

      const existing = counts.get(t.assigneeId) ?? {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        estimatedMinutes: 0,
      };

      existing.total++;
      if (t.status === "todo") existing.todo++;
      else if (t.status === "in_progress") existing.inProgress++;
      else if (t.status === "done") existing.done++;

      if (t.status !== "done" && t.estimatedMinutes) {
        existing.estimatedMinutes += t.estimatedMinutes;
      }

      counts.set(t.assigneeId, existing);
    }

    return { countsByUser: counts, unassignedCount: unassigned };
  }, [tasksQuery.data, projectsQuery.data]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Team Workload</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          See who&apos;s free and how work is distributed.
        </p>
      </div>

      {unassignedCount > 0 ? (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
          <p className="text-sm font-semibold text-yellow-200">
            {unassignedCount} unassigned task{unassignedCount === 1 ? "" : "s"} need attention
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((member) => {
          const stats = countsByUser.get(member._id);
          const openTasks = (stats?.todo ?? 0) + (stats?.inProgress ?? 0);
          const estHours = stats?.estimatedMinutes
            ? Math.round(stats.estimatedMinutes / 60 * 10) / 10
            : 0;

          return (
            <div
              key={member._id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background text-sm font-semibold">
                  {(member.name ?? member.email ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {member.name ?? member.email}
                  </div>
                  <div className="text-xs text-muted-foreground">{member.role}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border bg-background p-2">
                  <div className="text-lg font-semibold">{openTasks}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">Open</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <div className="text-lg font-semibold">{stats?.done ?? 0}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">Done</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <div className="text-lg font-semibold">{estHours}h</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">Load</div>
                </div>
              </div>

              {openTasks === 0 ? (
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                  Available
                </div>
              ) : openTasks >= 5 ? (
                <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-200">
                  Heavy load
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
