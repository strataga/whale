"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const createMutation = crpc.milestones.create.useMutation();
  const uid = React.useId();

  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  const pending = createMutation.isPending;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await createMutation.mutateAsync({
        projectId,
        name,
        ...(dueDate ? { dueDate: new Date(dueDate).getTime() } : {}),
      });
      setOpen(false);
      setName("");
      setDueDate("");
      toast("Milestone created.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to create milestone.";
      setError(message);
      toast(message, "error");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4" />
        Add milestone
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-lg">
          {error ? (
            <div
              className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label
                htmlFor={`${uid}-milestone-name`}
                className="text-sm font-medium"
              >
                Name
              </label>
              <input
                id={`${uid}-milestone-name`}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="Design & UX"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`${uid}-milestone-due`}
                className="text-sm font-medium"
              >
                Due date (optional)
              </label>
              <input
                id={`${uid}-milestone-due`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
