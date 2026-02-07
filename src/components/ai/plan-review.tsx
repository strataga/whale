"use client";

import * as React from "react";

type Priority = "low" | "medium" | "high" | "urgent";

export type PlanReviewTask = {
  title: string;
  description: string;
  priority: Priority;
  estimatedDays?: number;
};

export type PlanReviewMilestone = {
  name: string;
  tasks: PlanReviewTask[];
};

export type PlanReviewPlan = {
  scope?: string;
  milestones: PlanReviewMilestone[];
  risks?: string[];
  successCriteria?: string[];
};

type Props = {
  plan: PlanReviewPlan;
  disabled?: boolean;
  onAccept?: (plan: PlanReviewPlan) => void | Promise<void>;
  onRegenerate?: () => void | Promise<void>;
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

export function PlanReview({ plan, disabled, onAccept, onRegenerate }: Props) {
  const [draft, setDraft] = React.useState<PlanReviewPlan>(plan);

  React.useEffect(() => {
    setDraft(plan);
  }, [plan]);

  const updateTaskTitle = (milestoneIndex: number, taskIndex: number, title: string) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      next.milestones[milestoneIndex].tasks[taskIndex].title = title;
      return next;
    });
  };

  const removeTask = (milestoneIndex: number, taskIndex: number) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      next.milestones[milestoneIndex].tasks.splice(taskIndex, 1);
      return next;
    });
  };

  const moveTask = (milestoneIndex: number, fromIndex: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      const list = next.milestones[milestoneIndex].tasks;
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= list.length) return prev;
      const [item] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, item);
      return next;
    });
  };

  const accept = async () => {
    await onAccept?.(draft);
  };

  const regenerate = async () => {
    await onRegenerate?.();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Review The Plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit task titles, remove anything that feels like fluff, and reorder for clarity.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={regenerate}
              disabled={disabled}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={disabled}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              Accept Plan
            </button>
          </div>
        </div>

        {draft.scope ? (
          <div className="mt-4 rounded-xl bg-muted/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scope
            </div>
            <div className="mt-1 text-sm text-foreground">{draft.scope}</div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        {draft.milestones.map((milestone, milestoneIndex) => (
          <section
            key={`${milestone.name}-${milestoneIndex}`}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{milestone.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {milestone.tasks.length} task{milestone.tasks.length === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            <ol className="mt-4 space-y-3">
              {milestone.tasks.map((task, taskIndex) => (
                <li
                  key={`${task.title}-${taskIndex}`}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                            badgeClasses(task.priority),
                          ].join(' ')}
                        >
                          {task.priority}
                        </span>
                        {typeof task.estimatedDays === 'number' ? (
                          <span className="text-xs text-muted-foreground">
                            Est: {task.estimatedDays}d
                          </span>
                        ) : null}
                      </div>

                      <label className="mt-2 block">
                        <span className="sr-only">Task title</span>
                        <input
                          value={task.title}
                          onChange={(e) =>
                            updateTaskTitle(milestoneIndex, taskIndex, e.currentTarget.value)
                          }
                          disabled={disabled}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>

                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {task.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => moveTask(milestoneIndex, taskIndex, -1)}
                        disabled={disabled || taskIndex === 0}
                        className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTask(milestoneIndex, taskIndex, 1)}
                        disabled={disabled || taskIndex === milestone.tasks.length - 1}
                        className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTask(milestoneIndex, taskIndex)}
                        disabled={disabled}
                        className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs font-medium text-destructive shadow-sm hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {(draft.risks?.length ?? 0) > 0 || (draft.successCriteria?.length ?? 0) > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(draft.risks?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">Risks</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {(draft.risks ?? []).map((risk, i) => (
                  <li key={`${risk}-${i}`}>{risk}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {(draft.successCriteria?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">Success Criteria</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {(draft.successCriteria ?? []).map((criterion, i) => (
                  <li key={`${criterion}-${i}`}>{criterion}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
