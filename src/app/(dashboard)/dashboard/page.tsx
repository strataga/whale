import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ProjectCard } from "@/components/projects/project-card";
import { db } from "@/lib/db";
import { auditLogs, bots, projects, tasks, users, workspaces } from "@/lib/db/schema";
import { checkRole, requireAuthContext } from "@/lib/server/auth-context";

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

export default async function DashboardHomePage() {
  const ctx = await requireAuthContext();
  const { workspaceId, name: userName, email } = ctx;
  const isAdmin = !checkRole(ctx, "admin");

  const workspace = db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .get();

  const activeProjectsRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, "active")))
    .get();

  const completedThisWeekRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(tasks.status, "done"),
        sql`${tasks.updatedAt} >= (strftime('%s', 'now') * 1000 - 7 * 24 * 60 * 60 * 1000)`,
      ),
    )
    .get();

  const onlineBotsRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(bots)
    .where(and(eq(bots.workspaceId, workspaceId), eq(bots.status, "online")))
    .get();

  const totalAuditEventsRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, workspaceId))
    .get();

  const recentActivity = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.workspaceId, workspaceId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10)
    .all();

  const recentProjects = db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.updatedAt))
    .limit(6)
    .all();

  const recentProjectIds = recentProjects.map((p) => p.id);

  const recentTaskCounts = recentProjectIds.length
    ? db
        .select({
          projectId: tasks.projectId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(tasks)
        .where(inArray(tasks.projectId, recentProjectIds))
        .groupBy(tasks.projectId)
        .all()
    : [];

  const recentTaskCountByProjectId = new Map(
    recentTaskCounts.map((r) => [r.projectId, r.count]),
  );

  const greeting = userName?.trim() || email?.trim() || "there";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Workspace: {workspace?.name ?? "Your workspace"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Welcome back, {greeting}.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here’s what’s moving this week.
          </p>
        </div>

        <Link
          href="/dashboard/projects/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          New Project
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Active projects
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {activeProjectsRow?.count ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Tasks completed (7d)
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {completedThisWeekRow?.count ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Online bots
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {onlineBotsRow?.count ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Total audit events
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {totalAuditEventsRow?.count ?? 0}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-tight">Recent activity</h3>
          {isAdmin ? (
            <Link
              href="/dashboard/audit-log"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              View audit log
            </Link>
          ) : null}
        </div>

        {recentActivity.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {recentActivity.map((entry) => {
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
            No recent activity yet.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">
            Recent projects
          </h3>
          <Link
            href="/dashboard/projects"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>

        {recentProjects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={recentTaskCountByProjectId.get(project.id) ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h4 className="text-sm font-semibold">No projects yet</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a goal. Whale will help you break it down into
              milestones and tasks.
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard/projects/new"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Create your first project
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
