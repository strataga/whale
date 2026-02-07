"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { BotTaskStatus } from "@/components/bots/bot-task-status";
import { AssignBotDropdown } from "@/components/tasks/assign-bot-dropdown";
import { useToast } from "@/components/ui/toast";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";

type TaskBotAssignment =
  | {
      id: string;
      status: string;
      botName?: string | null;
      bot?: { id: string; name: string } | null;
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
  task: Pick<
    Task,
    "id" | "title" | "description" | "status" | "priority" | "assigneeId"
  > & {
    botTask?: TaskBotAssignment;
  };
  showDelete?: boolean;
  canAssignBot?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  const [draftTitle, setDraftTitle] = React.useState(task.title);
  const [draftDescription, setDraftDescription] = React.useState(task.description ?? "");
  const [draftPriority, setDraftPriority] = React.useState(task.priority ?? "medium");

  React.useEffect(() => {
    setDraftTitle(task.title);
    setDraftDescription(task.description ?? "");
    setDraftPriority(task.priority ?? "medium");
  }, [task.title, task.description, task.priority]);

  async function updateTask(patch: Partial<Task>) {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      const message = data?.error ?? "Update failed.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return false;
    }

    setPending(false);
    router.refresh();
    return true;
  }

  async function saveEdit() {
    const ok = await updateTask({
      title: draftTitle,
      description: draftDescription,
      priority: draftPriority as Task["priority"],
    });
    if (ok) {
      toast("Task saved.", "success");
      setEditing(false);
    }
  }

  async function deleteTask() {
    const ok = confirm("Delete this task?");
    if (!ok) return;

    setPending(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      const message = data?.error ?? "Delete failed.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    setPending(false);
    toast("Task deleted.", "success");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold text-foreground">
              {task.title}
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                priorityStyles(task.priority),
              )}
            >
              {task.priority ?? "low"}
            </span>
          </div>

          {task.description ? (
            <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {task.description}
            </div>
          ) : null}

          <div className="mt-2 text-xs text-muted-foreground">
            Assignee:{" "}
            {task.assigneeId ? (
              <span className="text-foreground">{task.assigneeId}</span>
            ) : (
              <span>Unassigned</span>
            )}
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
            <AssignBotDropdown projectId={projectId} taskId={task.id} />
          ) : null}

          <label className="sr-only" htmlFor={`task-status-${task.id}`}>
            Status
          </label>
          <select
            id={`task-status-${task.id}`}
            value={task.status ?? "todo"}
            onChange={(e) => updateTask({ status: e.target.value as Task["status"] })}
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
            <label htmlFor={`task-title-${task.id}`} className="text-xs font-medium">
              Title
            </label>
            <input
              id={`task-title-${task.id}`}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`task-desc-${task.id}`} className="text-xs font-medium">
              Description
            </label>
            <textarea
              id={`task-desc-${task.id}`}
              rows={3}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`task-priority-${task.id}`} className="text-xs font-medium">
              Priority
            </label>
            <select
              id={`task-priority-${task.id}`}
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
