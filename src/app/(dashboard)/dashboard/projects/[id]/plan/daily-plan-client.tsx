"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";

import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

type ApiError = { error?: string };

type PlanItem = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
};

type DailyPlan = {
  mustDo: PlanItem[];
  niceToDo: PlanItem[];
  finishThis: PlanItem[];
  reasoning?: string;
};

function priorityDot(priority?: string | null) {
  switch (priority) {
    case "urgent":
      return "bg-rose-400";
    case "high":
      return "bg-orange-400";
    case "medium":
      return "bg-blue-400";
    case "low":
    default:
      return "bg-zinc-400";
  }
}

function Section({
  title,
  subtitle,
  items,
  doneIds,
  onToggle,
}: {
  title: string;
  subtitle: string;
  items: PlanItem[];
  doneIds: Set<string>;
  onToggle: (taskId: string, nextDone: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {items.length ? (
        <ul className="mt-5 space-y-3">
          {items.map((t) => {
            const checked = doneIds.has(t.id);
            return (
              <li key={t.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle(t.id, e.target.checked)}
                  aria-label={t.title}
                  className="mt-1 h-4 w-4 accent-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        checked ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      {t.title}
                    </span>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        priorityDot(t.priority),
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
          No tasks selected.
        </div>
      )}
    </section>
  );
}

export default function DailyPlanClient({
  projectId,
  initialPlan,
}: {
  projectId: string;
  initialPlan: DailyPlan;
}) {
  const crpc = useCRPC();
  const updateMutation = crpc.tasks.update.useMutation();

  const [plan, setPlan] = React.useState<DailyPlan>(initialPlan);
  const [aiPending, setAiPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pending = aiPending || updateMutation.isPending;

  const doneIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const bucket of [plan.mustDo, plan.niceToDo, plan.finishThis]) {
      for (const t of bucket) {
        if (t.status === "done") ids.add(t.id);
      }
    }
    return ids;
  }, [plan.finishThis, plan.mustDo, plan.niceToDo]);

  async function regenerate() {
    setAiPending(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/daily-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = (await res.json().catch(() => null)) as DailyPlan | ApiError | null;

      if (res.ok && data && "mustDo" in data && "niceToDo" in data && "finishThis" in data) {
        setPlan(data as DailyPlan);
      } else {
        setError((data as ApiError | null)?.error ?? "AI daily plan not available.");
      }
    } catch {
      setError("Failed to regenerate plan.");
    } finally {
      setAiPending(false);
    }
  }

  async function toggleDone(taskId: string, nextDone: boolean) {
    setError(null);

    // Optimistic update
    setPlan((prev) => {
      const patchBucket = (bucket: PlanItem[]) =>
        bucket.map((t) =>
          t.id === taskId ? { ...t, status: nextDone ? "done" : "todo" } : t,
        );
      return {
        ...prev,
        mustDo: patchBucket(prev.mustDo),
        niceToDo: patchBucket(prev.niceToDo),
        finishThis: patchBucket(prev.finishThis),
      };
    });

    try {
      await updateMutation.mutateAsync({ id: taskId, status: nextDone ? "done" : "todo" });
    } catch (err: any) {
      setError(err?.message ?? "Failed to update task.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          Check off tasks to mark them done.
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          {pending ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {error ? (
        <div
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          title="Must do"
          subtitle="The most important tasks for today."
          items={plan.mustDo}
          doneIds={doneIds}
          onToggle={toggleDone}
        />
        <Section
          title="Nice to do"
          subtitle="If you have extra time."
          items={plan.niceToDo}
          doneIds={doneIds}
          onToggle={toggleDone}
        />
        <Section
          title="Finish this"
          subtitle="Pick one task and take it across the line."
          items={plan.finishThis}
          doneIds={doneIds}
          onToggle={toggleDone}
        />
      </div>
    </div>
  );
}

