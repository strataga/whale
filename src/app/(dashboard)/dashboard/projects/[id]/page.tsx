import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, like } from "drizzle-orm";

import { AddMilestoneForm } from "@/components/projects/add-milestone-form";
import { ProjectHeader } from "@/components/projects/project-header";
import { ReplanButton } from "@/components/projects/replan-button";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskFilters } from "@/components/tasks/task-filters";
import { db } from "@/lib/db";
import { milestones, projects, tasks } from "@/lib/db/schema";
import { checkRole, requireAuthContext } from "@/lib/server/auth-context";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

function formatDueDate(ts?: number | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeStyles(status: string) {
  switch (status) {
    case "done":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "in_progress":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    case "todo":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function priorityBadgeStyles(priority: string) {
  switch (priority) {
    case "urgent":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    case "high":
      return "border-orange-400/30 bg-orange-400/10 text-orange-200";
    case "medium":
      return "border-primary/30 bg-primary/10 text-primary";
    case "low":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

type SearchParams = {
  status?: string;
  priority?: string;
  q?: string;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireAuthContext();
  const { workspaceId } = ctx;
  const canAssignBot = !checkRole(ctx, "member");

  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .get();

  if (!project) notFound();

  const projectMilestones = db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, project.id))
    .orderBy(asc(milestones.position))
    .all();

  // Build filter conditions for the task query
  const filterStatuses = sp.status
    ? sp.status.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const filterPriorities = sp.priority
    ? sp.priority.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const filterSearch = sp.q?.trim() ?? "";

  const taskConditions = [eq(tasks.projectId, project.id)];

  if (filterStatuses.length > 0) {
    taskConditions.push(inArray(tasks.status, filterStatuses));
  }
  if (filterPriorities.length > 0) {
    taskConditions.push(inArray(tasks.priority, filterPriorities));
  }
  if (filterSearch) {
    taskConditions.push(like(tasks.title, `%${filterSearch}%`));
  }

  const projectTasks = db
    .select()
    .from(tasks)
    .where(and(...taskConditions))
    .orderBy(asc(tasks.position))
    .all();

  const hasActiveFilters =
    filterStatuses.length > 0 || filterPriorities.length > 0 || filterSearch.length > 0;

  const totalTasks = projectTasks.length;
  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
  const donePercent = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const statusCounts: Record<"todo" | "in_progress" | "done", number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
  };

  const priorityCounts: Record<"low" | "medium" | "high" | "urgent", number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  for (const task of projectTasks) {
    if (task.status in statusCounts) {
      statusCounts[task.status as keyof typeof statusCounts] += 1;
    }
    if (task.priority in priorityCounts) {
      priorityCounts[task.priority as keyof typeof priorityCounts] += 1;
    }
  }

  const taskIds = projectTasks.map((t) => t.id);

  const schema = (await import("@/lib/db/schema")) as unknown as {
    bots?: unknown;
    botTasks?: unknown;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const botsTable = (schema as any).bots as any | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const botTasksTable = (schema as any).botTasks as any | undefined;

  const latestBotTaskByTaskId = new Map<
    string,
    { id: string; status: string; botName: string; bot: { id: string; name: string } }
  >();

  if (botsTable && botTasksTable && taskIds.length) {
    const rows = db
      .select({
        taskId: botTasksTable.taskId,
        id: botTasksTable.id,
        status: botTasksTable.status,
        botId: botsTable.id,
        botName: botsTable.name,
      })
      .from(botTasksTable)
      .innerJoin(botsTable, eq(botTasksTable.botId, botsTable.id))
      .where(inArray(botTasksTable.taskId, taskIds))
      .orderBy(desc(botTasksTable.createdAt))
      .all() as Array<{
      taskId: string;
      id: string;
      status: string;
      botId: string;
      botName: string;
    }>;

    for (const row of rows) {
      if (latestBotTaskByTaskId.has(row.taskId)) continue;
      latestBotTaskByTaskId.set(row.taskId, {
        id: row.id,
        status: row.status,
        botName: row.botName,
        bot: { id: row.botId, name: row.botName },
      });
    }
  }

  const projectTasksWithBots = projectTasks.map((t) => ({
    ...t,
    botTask: latestBotTaskByTaskId.get(t.id) ?? null,
  }));

  const tasksByMilestoneId = new Map<string, typeof projectTasksWithBots>();
  const backlogTasks: typeof projectTasksWithBots = [];

  for (const task of projectTasksWithBots) {
    if (task.milestoneId) {
      const list = tasksByMilestoneId.get(task.milestoneId) ?? [];
      list.push(task);
      tasksByMilestoneId.set(task.milestoneId, list);
    } else {
      backlogTasks.push(task);
    }
  }

  return (
    <div className="space-y-8">
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        description={project.description}
        status={project.status}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={`/dashboard/projects/${project.id}/plan`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Generate Daily Plan
        </Link>
        <ReplanButton projectId={project.id} />
      </div>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
        <TaskFilters />
      </Suspense>

      {hasActiveFilters ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{projectTasks.length}</span>{" "}
          filtered task{projectTasks.length === 1 ? "" : "s"}.
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">Task stats</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Progress and breakdowns for this project.
            </p>
          </div>
          <div className="text-sm font-semibold text-foreground">
            {doneTasks}/{totalTasks} done
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-medium text-foreground">{donePercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-[width]"
              style={{ width: `${donePercent}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-xs font-semibold text-muted-foreground">
              Status
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { key: "todo", label: "To do" },
                  { key: "in_progress", label: "In progress" },
                  { key: "done", label: "Done" },
                ] as const
              ).map(({ key, label }) => (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                    statusBadgeStyles(key),
                  )}
                >
                  {label}: {statusCounts[key]}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-xs font-semibold text-muted-foreground">
              Priority
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { key: "low", label: "Low" },
                  { key: "medium", label: "Medium" },
                  { key: "high", label: "High" },
                  { key: "urgent", label: "Urgent" },
                ] as const
              ).map(({ key, label }) => (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                    priorityBadgeStyles(key),
                  )}
                >
                  {label}: {priorityCounts[key]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Milestones</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tasks grouped into outcomes.
            </p>
          </div>
          <AddMilestoneForm projectId={project.id} />
        </div>

        {projectMilestones.length ? (
          <div className="space-y-3">
            {projectMilestones.map((m) => {
              const due = formatDueDate(m.dueDate);
              const milestoneTasks = tasksByMilestoneId.get(m.id) ?? [];

              return (
                <details
                  key={m.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                  open
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {m.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {milestoneTasks.length} tasks
                          {due ? <span> • Due {due}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AddTaskForm projectId={project.id} milestoneId={m.id} />
                      </div>
                    </div>
                  </summary>

                  <div className="mt-5 space-y-3">
                    {milestoneTasks.length ? (
                      milestoneTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          projectId={project.id}
                          task={t}
                          showDelete
                          canAssignBot={canAssignBot}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                        No tasks in this milestone yet.
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h4 className="text-sm font-semibold">No milestones yet</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Add milestones to keep work structured, or start in the backlog.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Backlog</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tasks without a milestone.
            </p>
          </div>
          <AddTaskForm projectId={project.id} />
        </div>

        {backlogTasks.length ? (
          <div className="space-y-3">
            {backlogTasks.map((t) => (
              <TaskCard
                key={t.id}
                projectId={project.id}
                task={t}
                showDelete
                canAssignBot={canAssignBot}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h4 className="text-sm font-semibold">Backlog is empty</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a task, or generate a daily plan once you have work to do.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
