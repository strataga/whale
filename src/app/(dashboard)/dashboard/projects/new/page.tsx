"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

type Mode = "manual" | "ai";

type ApiError = { error?: string };

type GeneratedPlan = {
  scope?: string;
  milestones?: Array<{
    name: string;
    dueDate?: number | null;
    tasks?: Array<{
      title: string;
      description?: string | null;
      priority?: string | null;
    }>;
  }>;
};

export default function NewProjectPage() {
  const router = useRouter();

  const [mode, setMode] = React.useState<Mode>("manual");

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [goal, setGoal] = React.useState("");

  const [plan, setPlan] = React.useState<GeneratedPlan | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function createProject(payload: { name: string; description?: string }) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as
      | { project?: { id: string } }
      | { id?: string }
      | ApiError
      | null;

    if (!res.ok) {
      throw new Error((data as ApiError | null)?.error ?? "Failed to create project.");
    }

    const projectId =
      (data && "project" in data && data.project?.id) ||
      (data && "id" in data && data.id) ||
      null;

    if (!projectId) throw new Error("Project created but no id returned.");

    return projectId;
  }

  async function onCreateManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const projectId = await createProject({ name, description });
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project.");
      setPending(false);
    }
  }

  async function onGeneratePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setPlan(null);

    const res = await fetch("/api/ai/generate-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal }),
    });

    const data = (await res.json().catch(() => null)) as GeneratedPlan | ApiError | null;

    if (!res.ok) {
      setError((data as ApiError | null)?.error ?? "Failed to generate plan.");
      setPending(false);
      return;
    }

    setPlan((data ?? {}) as GeneratedPlan);
    setPending(false);
  }

  async function onCreateFromPlan() {
    if (!plan) return;

    setPending(true);
    setError(null);

    try {
      const projectId = await createProject({
        name: name.trim() || goal.trim().slice(0, 64) || "New Project",
        description: plan.scope ?? description,
      });

      const milestones = plan.milestones ?? [];

      for (const m of milestones) {
        const milestonePayload: { name: string; dueDate?: number } = {
          name: m.name,
        };
        if (m.dueDate) milestonePayload.dueDate = m.dueDate;

        const mRes = await fetch(`/api/projects/${projectId}/milestones`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(milestonePayload),
        });

        const mData = (await mRes.json().catch(() => null)) as
          | { milestone?: { id: string } }
          | { id?: string }
          | ApiError
          | null;

        if (!mRes.ok) {
          throw new Error(
            (mData as ApiError | null)?.error ?? `Failed to create milestone: ${m.name}`,
          );
        }

        const milestoneId =
          (mData && "milestone" in mData && mData.milestone?.id) ||
          (mData && "id" in mData && mData.id) ||
          null;

        for (const t of m.tasks ?? []) {
          const taskPayload: {
            title: string;
            description?: string;
            priority?: string;
            milestoneId?: string;
          } = {
            title: t.title,
            description: t.description ?? "",
            priority: t.priority ?? "medium",
          };

          if (milestoneId) taskPayload.milestoneId = milestoneId;

          const tRes = await fetch(`/api/projects/${projectId}/tasks`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(taskPayload),
          });

          const tData = (await tRes.json().catch(() => null)) as ApiError | null;

          if (!tRes.ok) {
            throw new Error(
              tData?.error ?? `Failed to create task: ${t.title}`,
            );
          }
        }
      }

      router.push(`/dashboard/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project from plan.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a project manually, or start with an AI-assisted intake.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
            mode === "manual"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={mode === "manual"}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
            mode === "ai"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={mode === "ai"}
        >
          AI
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

      {mode === "manual" ? (
        <form
          onSubmit={onCreateManual}
          className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Project name
            </label>
            <input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="Billing dashboard MVP"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="What does success look like? Any constraints?"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      ) : (
        <div className="max-w-3xl space-y-4">
          <form
            onSubmit={onGeneratePlan}
            className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-2">
              <label htmlFor="goal" className="text-sm font-medium">
                Goal
              </label>
              <textarea
                id="goal"
                name="goal"
                rows={6}
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="Describe what you want to achieve, constraints, and an ideal timeline…"
              />
              <p className="text-xs text-muted-foreground">
                Whale will call <code className="font-mono">/api/ai/generate-plan</code> to
                suggest milestones and tasks.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="mr-2 inline-flex items-center">
                  <Sparkles className="h-4 w-4" />
                </span>
                {pending ? "Generating…" : "Generate plan"}
              </button>
            </div>
          </form>

          {plan ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Generated plan
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and create the project.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateFromPlan}
                  disabled={pending}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Creating…" : "Create project"}
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {plan.scope ? (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      Scope
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {plan.scope}
                    </p>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Milestones
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(plan.milestones ?? []).map((m) => (
                      <div
                        key={m.name}
                        className="rounded-xl border border-border bg-background p-4"
                      >
                        <div className="text-sm font-semibold">{m.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {(m.tasks ?? []).length} tasks
                        </div>
                      </div>
                    ))}
                    {(plan.milestones ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No milestones returned.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Show raw JSON
                </summary>
                <pre className="mt-3 overflow-auto rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
                  {JSON.stringify(plan, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
