"use client";

import * as React from "react";
import Link from "next/link";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

type SprintStatus = "planning" | "active" | "completed";

function statusBadgeStyles(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "completed":
      return "border-primary/30 bg-primary/10 text-primary";
    case "planning":
    default:
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  }
}

function taskStatusBadgeStyles(status: string) {
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

const statusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const sprintStatusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
};

function formatDate(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Next valid status transitions for a sprint */
function nextStatus(current: string): SprintStatus | null {
  if (current === "planning") return "active";
  if (current === "active") return "completed";
  return null;
}

function nextStatusLabel(current: string): string | null {
  const next = nextStatus(current);
  if (!next) return null;
  if (next === "active") return "Start Sprint";
  if (next === "completed") return "Complete Sprint";
  return null;
}

export function SprintBoard({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const crpc = useCRPC();

  // ---- cRPC queries ----
  const sprintsQuery = crpc.sprints.list.useQuery({ projectId });
  const tasksQuery = crpc.tasks.list.useQuery({ projectId });

  const sprints = sprintsQuery.data ?? [];
  const allTasks = tasksQuery.data ?? [];
  const loading = sprintsQuery.isLoading || tasksQuery.isLoading;
  const [error, setError] = React.useState<string | null>(null);

  // ---- cRPC mutations ----
  const createMutation = crpc.sprints.create.useMutation();
  const updateMutation = crpc.sprints.update.useMutation();
  const addTaskMutation = crpc.sprints.addTask.useMutation();
  const removeTaskMutation = crpc.sprints.removeTask.useMutation();

  const actionPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    addTaskMutation.isPending ||
    removeTaskMutation.isPending;

  // Create sprint form state
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newStartDate, setNewStartDate] = React.useState("");
  const [newEndDate, setNewEndDate] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  // ---- Derive sprint tasks and backlog ----

  // For each sprint, load its full details (including tasks) via crpc.sprints.get
  // We use the sprint list + per-sprint get queries
  // To keep it simple, we fetch all sprint details in one pass
  const sprintDetails = sprints.map((s) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const detail = crpc.sprints.get.useQuery({ id: s._id });
    return { sprint: s, tasks: detail.data?.tasks ?? [], isLoading: detail.isLoading };
  });

  // Determine which taskIds are assigned to any sprint
  const assignedIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const sd of sprintDetails) {
      for (const t of sd.tasks) {
        if (t) ids.add(t._id);
      }
    }
    return ids;
  }, [sprintDetails]);

  // Backlog = tasks not in any sprint
  const backlogTasks = React.useMemo(
    () => allTasks.filter((t) => !assignedIds.has(t._id)),
    [allTasks, assignedIds],
  );

  // ---- Actions ----

  async function createSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newStartDate || !newEndDate) return;

    setCreateError(null);

    const startTs = new Date(newStartDate).getTime();
    const endTs = new Date(newEndDate).getTime();

    if (endTs <= startTs) {
      setCreateError("End date must be after start date");
      return;
    }

    try {
      await createMutation.mutateAsync({
        projectId,
        name: newName.trim(),
        startDate: startTs,
        endDate: endTs,
      });
      setNewName("");
      setNewStartDate("");
      setNewEndDate("");
      setShowCreate(false);
      toast("Sprint created.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to create sprint";
      setCreateError(message);
      toast(message, "error");
    }
  }

  async function transitionSprint(sprintId: string, currentStatus: string) {
    const next = nextStatus(currentStatus);
    if (!next) return;

    try {
      await updateMutation.mutateAsync({ id: sprintId, status: next });
      toast(`Sprint ${next === "active" ? "started" : "completed"}.`, "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to update sprint";
      setError(message);
      toast(message, "error");
    }
  }

  async function assignToSprint(sprintId: string, taskId: string) {
    try {
      await addTaskMutation.mutateAsync({ sprintId, taskId });
      toast("Task assigned to sprint.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to assign task";
      setError(message);
      toast(message, "error");
    }
  }

  async function removeFromSprint(sprintTaskId: string) {
    try {
      await removeTaskMutation.mutateAsync({ id: sprintTaskId });
      toast("Task removed from sprint.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to remove task";
      setError(message);
      toast(message, "error");
    }
  }

  // ---- Sort: active sprints first, then planning, then completed ----
  const statusOrder: Record<string, number> = {
    active: 0,
    planning: 1,
    completed: 2,
  };
  const sortedSprints = [...sprintDetails].sort(
    (a, b) =>
      (statusOrder[a.sprint.status] ?? 9) - (statusOrder[b.sprint.status] ?? 9) ||
      b.sprint._creationTime - a.sprint._creationTime,
  );

  // ---- Render ----

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Create sprint toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {showCreate ? "Cancel" : "Create Sprint"}
        </button>
      </div>

      {/* Create sprint form */}
      {showCreate ? (
        <form
          onSubmit={createSprint}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
        >
          <h3 className="text-sm font-semibold tracking-tight">New Sprint</h3>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label
                htmlFor="sprint-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Name
              </label>
              <input
                id="sprint-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Sprint 1"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="sprint-start"
                className="text-xs font-medium text-muted-foreground"
              >
                Start Date
              </label>
              <input
                id="sprint-start"
                type="date"
                required
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="sprint-end"
                className="text-xs font-medium text-muted-foreground"
              >
                End Date
              </label>
              <input
                id="sprint-end"
                type="date"
                required
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>
          </div>

          {createError ? (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
              role="alert"
            >
              {createError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={actionPending || !newName.trim() || !newStartDate || !newEndDate}
            aria-busy={actionPending}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionPending ? "Creating..." : "Create Sprint"}
          </button>
        </form>
      ) : null}

      {/* Two-column layout: Sprints | Backlog */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Sprints */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-tight">Sprints</h3>

          {sortedSprints.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <h4 className="text-sm font-semibold">No sprints yet</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a sprint to organize your tasks into time-boxed iterations.
              </p>
            </div>
          ) : (
            sortedSprints.map(({ sprint, tasks }) => {
              const label = nextStatusLabel(sprint.status);

              return (
                <div
                  key={sprint._id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
                >
                  {/* Sprint header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {sprint.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            statusBadgeStyles(sprint.status),
                          )}
                        >
                          {sprintStatusLabels[sprint.status] ?? sprint.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(sprint.startDate)} &ndash;{" "}
                        {formatDate(sprint.endDate)} &middot; {tasks.length}{" "}
                        task{tasks.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    {label ? (
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() =>
                          transitionSprint(sprint._id, sprint.status)
                        }
                        className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                      >
                        {label}
                      </button>
                    ) : null}
                  </div>

                  {/* Sprint task list */}
                  {tasks.length > 0 ? (
                    <div className="space-y-2">
                      {tasks.map((st) => {
                        if (!st) return null;
                        return (
                          <div
                            key={st._id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <Link
                                href={`/dashboard/projects/${projectId}/tasks/${st._id}`}
                                className="truncate text-sm font-medium text-foreground hover:underline"
                              >
                                {st.title ?? "Untitled"}
                              </Link>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                  taskStatusBadgeStyles(st.status ?? "todo"),
                                )}
                              >
                                {statusLabels[st.status ?? "todo"] ??
                                  st.status}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                  priorityBadgeStyles(
                                    st.priority ?? "medium",
                                  ),
                                )}
                              >
                                {st.priority ?? "medium"}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={actionPending}
                              onClick={() =>
                                removeFromSprint(st._id)
                              }
                              className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                              aria-label={`Remove ${st.title ?? "task"} from sprint`}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                      No tasks assigned to this sprint yet. Add tasks from the
                      backlog.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Backlog */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-tight">Backlog</h3>
          <p className="text-xs text-muted-foreground">
            Tasks not assigned to any sprint. Click &ldquo;Assign&rdquo; to add a task to
            a sprint.
          </p>

          {backlogTasks.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <h4 className="text-sm font-semibold">Backlog is empty</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                All tasks are assigned to sprints, or no tasks exist yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backlogTasks.map((task) => {
                // Determine which sprint to offer assignment to:
                // prefer active sprint, then planning, skip completed
                const targetSprint = sortedSprints.find(
                  (s) => s.sprint.status === "active",
                )?.sprint ??
                  sortedSprints.find((s) => s.sprint.status === "planning")?.sprint ??
                  null;

                return (
                  <div
                    key={task._id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/projects/${projectId}/tasks/${task._id}`}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {task.title}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          taskStatusBadgeStyles(task.status),
                        )}
                      >
                        {statusLabels[task.status] ?? task.status}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          priorityBadgeStyles(task.priority),
                        )}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {targetSprint ? (
                      <button
                        type="button"
                        disabled={actionPending}
                        onClick={() =>
                          assignToSprint(targetSprint._id, task._id)
                        }
                        className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                        aria-label={`Assign ${task.title} to ${targetSprint.name}`}
                      >
                        Assign to Sprint
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No sprint available
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
