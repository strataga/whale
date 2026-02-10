"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { BotTaskStatus } from "@/components/bots/bot-task-status";
import { AssignBotDropdown } from "@/components/tasks/assign-bot-dropdown";
import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

type TaskBotAssignment =
  | {
      _id: string;
      status: string;
      botName?: string | null;
      bot?: { _id: string; name: string } | null;
    }
  | null
  | undefined;

function priorityStyles(priority?: string | null) {
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

export function TaskCard({
  projectId,
  task,
  showDelete = false,
  canAssignBot = false,
}: {
  projectId: string;
  task: {
    _id: string;
    title: string;
    description?: string | null;
    status?: string | null;
    priority?: string | null;
    assigneeId?: string | null;
    botTask?: TaskBotAssignment;
    dueDate?: number | null;
    estimatedMinutes?: number | null;
    subtasksDone?: number;
    subtasksTotal?: number;
    isBlocked?: boolean;
  };
  showDelete?: boolean;
  canAssignBot?: boolean;
}) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const updateMutation = crpc.tasks.update.useMutation();
  const removeMutation = crpc.tasks.remove.useMutation();

  const [now] = React.useState(() => Date.now());
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  const pending = updateMutation.isPending || removeMutation.isPending;

  const [draftTitle, setDraftTitle] = React.useState(task.title);
  const [draftDescription, setDraftDescription] = React.useState(task.description ?? "");
  const [draftPriority, setDraftPriority] = React.useState(task.priority ?? "medium");

  React.useEffect(() => {
    setDraftTitle(task.title);
    setDraftDescription(task.description ?? "");
    setDraftPriority(task.priority ?? "medium");
  }, [task.title, task.description, task.priority]);

  async function updateTask(patch: Record<string, any>) {
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: task._id, ...patch });
      return true;
    } catch (err: any) {
      const message = err?.message ?? "Update failed.";
      setError(message);
      toast(message, "error");
      return false;
    }
  }

  async function saveEdit() {
    const ok = await updateTask({
      title: draftTitle,
      description: draftDescription,
      priority: draftPriority,
    });
    if (ok) {
      toast("Task saved.", "success");
      setEditing(false);
    }
  }

  async function deleteTask() {
    const ok = confirm("Delete this task?");
    if (!ok) return;

    setError(null);
    try {
      await removeMutation.mutateAsync({ id: task._id });
      toast("Task deleted.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Delete failed.";
      setError(message);
      toast(message, "error");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/projects/${projectId}/tasks/${task._id}`}
              className="truncate text-sm font-semibold text-foreground hover:underline"
            >
              {task.title}
            </Link>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                priorityStyles(task.priority),
              )}
            >
              {task.priority ?? "low"}
            </span>
            {task.dueDate && task.status !== "done" && task.dueDate < now ? (
              <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                Overdue
              </span>
            ) : null}
            {task.isBlocked ? (
              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-300">
                Blocked
              </span>
            ) : null}
          </div>

          {task.description ? (
            <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {task.description}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Assignee:{" "}
              {task.assigneeId ? (
                <span className="text-foreground">{task.assigneeId}</span>
              ) : (
                <span>Unassigned</span>
              )}
            </span>
            {task.subtasksTotal ? (
              <span className="text-foreground">
                {task.subtasksDone ?? 0}/{task.subtasksTotal} subtasks
              </span>
            ) : null}
            {task.estimatedMinutes ? (
              <span>~{task.estimatedMinutes}m</span>
            ) : null}
          </div>

          {task.botTask ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Bot:{" "}
                <span className="text-foreground">
                  {task.botTask.botName ??
                    task.botTask.bot?.name ??
                    "Unknown"}
                </span>
              </span>
              <BotTaskStatus status={task.botTask.status} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!task.botTask && canAssignBot ? (
            <AssignBotDropdown projectId={projectId} taskId={task._id} />
          ) : null}

          <label className="sr-only" htmlFor={`task-status-${task._id}`}>
            Status
          </label>
          <select
            id={`task-status-${task._id}`}
            value={task.status ?? "todo"}
            onChange={(e) => updateTask({ status: e.target.value })}
            disabled={pending}
            className="h-11 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>

          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={pending}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            aria-label="Edit task"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {showDelete ? (
            <button
              type="button"
              onClick={deleteTask}
              disabled={pending}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-3">
          <div className="space-y-1">
            <label htmlFor={`task-title-${task._id}`} className="text-xs font-medium">
              Title
            </label>
            <input
              id={`task-title-${task._id}`}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`task-desc-${task._id}`} className="text-xs font-medium">
              Description
            </label>
            <textarea
              id={`task-desc-${task._id}`}
              rows={3}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`task-priority-${task._id}`} className="text-xs font-medium">
              Priority
            </label>
            <select
              id={`task-priority-${task._id}`}
              value={draftPriority}
              onChange={(e) => setDraftPriority(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending || !draftTitle.trim()}
              aria-busy={pending}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
