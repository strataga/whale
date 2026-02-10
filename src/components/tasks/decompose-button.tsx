"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";

type Subtask = {
  title: string;
  description: string;
  estimatedMinutes?: number;
};

export function DecomposeButton({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    subtasks: Subtask[];
    reasoning: string;
  } | null>(null);

  async function decompose() {
    setPending(true);
    try {
      const res = await fetch("/api/ai/decompose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, projectId }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast((d as { error?: string } | null)?.error ?? "Decomposition failed", "error");
        return;
      }

      const d = await res.json();
      setResult(d.decomposition);
    } catch {
      toast("Decomposition failed", "error");
    } finally {
      setPending(false);
    }
  }

  async function applySubtasks() {
    if (!result) return;
    setPending(true);

    for (const sub of result.subtasks) {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: sub.title }),
      });
    }

    toast(`Added ${result.subtasks.length} subtasks`, "success");
    setResult(null);
    setPending(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={decompose}
        disabled={pending}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
        title="AI: Break this down into subtasks"
      >
        <Wand2 className="h-4 w-4" />
        {pending ? "Thinking..." : "Break down"}
      </button>

      {result ? (
        <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground">{result.reasoning}</p>
          <ul className="space-y-1">
            {result.subtasks.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{s.title}</span>
                {s.estimatedMinutes ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ~{s.estimatedMinutes}m
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applySubtasks}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              Add as subtasks
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
