"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

export function AddTaskForm({
  projectId,
  milestoneId,
}: {
  projectId: string;
  milestoneId?: string | null;
}) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const createMutation = crpc.tasks.create.useMutation();
  const uid = React.useId();

  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("medium");

  const pending = createMutation.isPending;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await createMutation.mutateAsync({
        projectId,
        title,
        description,
        priority,
        ...(milestoneId ? { milestoneId } : {}),
      });
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      toast("Task created.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to create task.";
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
        Add task
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-lg">
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
              <label htmlFor={`${uid}-task-title`} className="text-sm font-medium">
                Title
              </label>
              <input
                id={`${uid}-task-title`}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="Implement API route for projects"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor={`${uid}-task-priority`}
                  className="text-sm font-medium"
                >
                  Priority
                </label>
                <select
                  id={`${uid}-task-priority`}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor={`${uid}-task-status`} className="text-sm font-medium">
                  Status
                </label>
                <input
                  id={`${uid}-task-status`}
                  value="todo"
                  disabled
                  className="h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`${uid}-task-description`}
                className="text-sm font-medium"
              >
                Description (optional)
              </label>
              <textarea
                id={`${uid}-task-description`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="What does done look like?"
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
