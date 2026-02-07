"use client";

import * as React from "react";

type Priority = "low" | "medium" | "high" | "urgent";

export type DailyPlanTask = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status?: "todo" | "in_progress" | "done";
};

export type DailyPlanItem = {
  task: DailyPlanTask;
  reasoning: string;
};

export type DailyPlanData = {
  mustDo: DailyPlanItem[];
  niceToDo: DailyPlanItem[];
  finishThis: DailyPlanItem[];
  overallReasoning: string;
};

type Props = {
  projectId: string;
  plan: DailyPlanData;
  disabled?: boolean;
  onRegenerate?: () => void | Promise<void>;
  onTaskPatched?: (taskId: string, patch: unknown) => void;
};

function badgeClasses(priority: Priority) {
  switch (priority) {
    case "urgent":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "high":
      return "border-primary/30 bg-primary/10 text-primary";
    case "medium":
      return "border-border bg-secondary text-secondary-foreground";
    case "low":
      return "border-border bg-muted text-muted-foreground";
  }
}

function Section({
  title,
  subtitle,
  items,
  projectId,
  disabled,
  onTaskPatched,
}: {
  title: string;
  subtitle: string;
  items: DailyPlanItem[];
  projectId: string;
  disabled?: boolean;
  onTaskPatched?: (taskId: string, patch: unknown) => void;
}) {
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);

  const markComplete = async (taskId: string, next: boolean) => {
    // We only support marking complete for now (a common daily-planning action).
    if (!next) return;

    setError(null);
    setPending((p) => ({ ...p, [taskId]: true }));
    setCompleted((c) => ({ ...c, [taskId]: true }));

    const patch = { status: "done" as const };

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      onTaskPatched?.(taskId, patch);
    } catch (e) {
      setCompleted((c) => ({ ...c, [taskId]: false }));
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setPending((p) => ({ ...p, [taskId]: false }));
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </header>

      {error ? (
        <div
          className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No tasks selected for this section.
          </div>
        ) : null}

        {items.map(({ task, reasoning }) => {
          const isDone = completed[task.id] || task.status === "done";
          const isPending = !!pending[task.id];

          return (
            <article
              key={task.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <label className="mt-0.5 inline-flex items-center gap-2">
                  <span className="sr-only">Mark complete</span>
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(e) => markComplete(task.id, e.currentTarget.checked)}
                    disabled={disabled || isPending || isDone}
                    className="h-4 w-4 rounded border-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                        badgeClasses(task.priority),
                      ].join(' ')}
                    >
                      {task.priority}
                    </span>
                    <h4 className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {task.title}
                    </h4>
                    {isPending ? (
                      <span className="text-xs text-muted-foreground">Saving…</span>
                    ) : null}
                  </div>

                  {task.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-muted-foreground">{reasoning}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DailyPlan({ projectId, plan, disabled, onRegenerate, onTaskPatched }: Props) {
  const regenerate = async () => {
    await onRegenerate?.();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Daily Plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Focus on high-impact work. Keep the day realistic.
            </p>
          </div>
          <button
            type="button"
            onClick={regenerate}
            disabled={disabled}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          title="Must Do"
          subtitle="Highest impact tasks for today (up to 3)."
          items={plan.mustDo}
          projectId={projectId}
          disabled={disabled}
          onTaskPatched={onTaskPatched}
        />
        <Section
          title="Nice To Do"
          subtitle="Useful work if time/energy permits (up to 2)."
          items={plan.niceToDo}
          projectId={projectId}
          disabled={disabled}
          onTaskPatched={onTaskPatched}
        />
        <Section
          title="Finish This"
          subtitle="Close a loop: something already in progress (up to 1)."
          items={plan.finishThis}
          projectId={projectId}
          disabled={disabled}
          onTaskPatched={onTaskPatched}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">AI Reasoning</h3>
        <p className="mt-2 text-sm text-muted-foreground">{plan.overallReasoning}</p>
      </div>
    </div>
  );
}
