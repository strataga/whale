"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { useToast } from "@/components/ui/toast";

type ApiError = { error?: string };

export function ReplanButton({ projectId }: { projectId: string }) {
  const { toast } = useToast();

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);

    const res = await fetch("/api/ai/replan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });

    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      const message = data?.error ?? "Replan failed.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    setPending(false);
    toast("Replan complete.", "success");
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        {pending ? "Replanning\u2026" : "Replan"}
      </button>

      {error ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
