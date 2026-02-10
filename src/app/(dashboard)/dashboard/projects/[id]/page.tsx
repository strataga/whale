"use client";

import type { FormEvent } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { AddMilestoneForm } from "@/components/projects/add-milestone-form";
import { BurndownChart } from "@/components/projects/burndown-chart";
import { ProjectHeader } from "@/components/projects/project-header";
import { ReplanButton } from "@/components/projects/replan-button";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskFilters } from "@/components/tasks/task-filters";
import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

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

export default function ProjectDetailPage() {
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const crpc = useCRPC();

  const projectQuery = crpc.projects.get.useQuery({ id });
  const milestonesQuery = crpc.milestones.list.useQuery({ projectId: id });
  const missionStatementsQuery = crpc.missionStatements.listByProject.useQuery({
    projectId: id,
    limit: 5,
  });
  const createMissionStatement = crpc.missionStatements.create.useMutation();
  const deleteMissionStatement = crpc.missionStatements.remove.useMutation();
  const tasksQuery = crpc.tasks.list.useQuery({
    projectId: id,
    status: searchParams.get("status") || undefined,
    priority: searchParams.get("priority") || undefined,
  });

  const isLoading = projectQuery.isPending || tasksQuery.isPending;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-12 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const project = projectQuery.data;
  if (!project) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h4 className="text-sm font-semibold">Project not found</h4>
        <Link href="/dashboard/projects" className="mt-2 text-sm text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const projectMilestones = milestonesQuery.data ?? [];
  const projectTasks = tasksQuery.data ?? [];
  const missionStatements = missionStatementsQuery.data ?? [];

  const filterStatus = searchParams.get("status");
  const filterPriority = searchParams.get("priority");
  const filterSearch = searchParams.get("q")?.trim() ?? "";
  const hasActiveFilters = !!filterStatus || !!filterPriority || !!filterSearch;

  const totalTasks = projectTasks.length;
  const doneTasks = projectTasks.filter((t: any) => t.status === "done").length;
  const donePercent = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const statusCounts = { todo: 0, in_progress: 0, done: 0 };
  const priorityCounts = { low: 0, medium: 0, high: 0, urgent: 0 };

  for (const task of projectTasks) {
    const t = task as any;
    if (t.status in statusCounts) statusCounts[t.status as keyof typeof statusCounts] += 1;
    if (t.priority in priorityCounts) priorityCounts[t.priority as keyof typeof priorityCounts] += 1;
  }

  const tasksByMilestoneId = new Map<string, any[]>();
  const backlogTasks: any[] = [];

  for (const task of projectTasks) {
    const t = task as any;
    if (t.milestoneId) {
      const list = tasksByMilestoneId.get(t.milestoneId) ?? [];
      list.push(t);
      tasksByMilestoneId.set(t.milestoneId, list);
    } else {
      backlogTasks.push(t);
    }
  }

  async function onAddMissionStatement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return;

    try {
      await createMissionStatement.mutateAsync({ projectId: id, body });
      form.reset();
      toast("Mission statement added.", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to add mission statement.", "error");
    }
  }

  async function onDeleteMissionStatement(statementId: string) {
    try {
      await deleteMissionStatement.mutateAsync({ id: statementId });
      toast("Mission statement deleted.", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to delete mission statement.", "error");
    }
  }

  return (
    <div className="space-y-8">
      <ProjectHeader
        projectId={project._id ?? id}
        name={project.name}
        description={project.description}
        status={project.status}
      />

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">Mission statements</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the intent for bots and humans working in this project.
            </p>
          </div>
        </div>

        {missionStatements.length ? (
          <div className="mt-5 space-y-3">
            {missionStatements.map((s: any) => {
              const date = s.createdAt
                ? new Date(s.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : null;
              return (
                <div
                  key={s._id}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-muted-foreground">
                        {date ?? "Mission"}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {s.body}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteMissionStatement(s._id)}
                      disabled={deleteMissionStatement.isPending}
                      className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            No mission statements yet.
          </div>
        )}

        <form className="mt-5 space-y-3" onSubmit={onAddMissionStatement}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="mission-body">
              Add statement
            </label>
            <textarea
              id="mission-body"
              name="body"
              required
              rows={3}
              placeholder="Example: Ship a working Mission Control that can delegate tasks to bots without Slack. Keep security and audit logs first-class."
              className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={createMissionStatement.isPending}
              aria-busy={createMissionStatement.isPending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {createMissionStatement.isPending ? "Adding…" : "Add statement"}
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={`/dashboard/projects/${id}/plan`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Generate Daily Plan
        </Link>
        <ReplanButton projectId={id} />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold tracking-tight">Quick add (AI)</h3>
        <p className="text-sm text-muted-foreground">
          Describe a task in natural language and AI will parse it.
        </p>
        <QuickAddTask projectId={id} />
      </section>

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
            <div className="text-xs font-semibold text-muted-foreground">Status</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { key: "todo", label: "To do" },
                { key: "in_progress", label: "In progress" },
                { key: "done", label: "Done" },
              ] as const).map(({ key, label }) => (
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
            <div className="text-xs font-semibold text-muted-foreground">Priority</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { key: "low", label: "Low" },
                { key: "medium", label: "Medium" },
                { key: "high", label: "High" },
                { key: "urgent", label: "Urgent" },
              ] as const).map(({ key, label }) => (
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
          <AddMilestoneForm projectId={id} />
        </div>

        {projectMilestones.length ? (
          <div className="space-y-3">
            {projectMilestones.map((m: any) => {
              const due = formatDueDate(m.dueDate);
              const milestoneTasks = tasksByMilestoneId.get(m._id) ?? [];

              return (
                <details
                  key={m._id}
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
                          {due ? <span> &bull; Due {due}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AddTaskForm projectId={id} milestoneId={m._id} />
                      </div>
                    </div>
                  </summary>

                  <div className="mt-5 space-y-3">
                    {milestoneTasks.length ? (
                      milestoneTasks.map((t: any) => (
                        <TaskCard
                          key={t._id}
                          projectId={id}
                          task={t}
                          showDelete
                          canAssignBot
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
          <AddTaskForm projectId={id} />
        </div>

        {backlogTasks.length ? (
          <div className="space-y-3">
            {backlogTasks.map((t: any) => (
              <TaskCard
                key={t._id}
                projectId={id}
                task={t}
                showDelete
                canAssignBot
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
