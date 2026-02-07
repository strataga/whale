"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ApiError = { error?: string };

function statusStyles(status?: string | null) {
  switch (status) {
    case "active":
      return "border-primary/30 bg-primary/10 text-primary";
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "archived":
      return "border-border bg-muted text-muted-foreground";
    case "draft":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function ProjectHeader({
  projectId,
  name,
  description,
  status,
}: {
  projectId: string;
  name: string;
  description: string | null;
  status: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const [draftName, setDraftName] = React.useState(name);
  const [draftDescription, setDraftDescription] = React.useState(description ?? "");
  const [draftStatus, setDraftStatus] = React.useState(status ?? "draft");

  React.useEffect(() => {
    setDraftName(name);
    setDraftDescription(description ?? "");
    setDraftStatus(status ?? "draft");
  }, [description, name, status]);

  async function save() {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: draftName,
        description: draftDescription,
        status: draftStatus,
      }),
    });

    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      setError(data?.error ?? "Failed to update project.");
      setPending(false);
      return;
    }

    setPending(false);
    setEditing(false);
    router.refresh();
  }

  async function deleteProject() {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ApiError | null;
      const message = data?.error ?? "Failed to delete project.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    setPending(false);
    toast("Project deleted.", "success");
    router.push("/dashboard/projects");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {name}
            </h2>
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-xs font-semibold",
                statusStyles(status),
              )}
            >
              {status ?? "draft"}
            </span>
          </div>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No description yet.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={pending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm font-semibold text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            aria-label="Delete project"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void deleteProject();
        }}
        title="Delete project?"
        description="All milestones and tasks will be permanently removed."
        confirmLabel="Delete project"
        variant="danger"
      />

      {editing ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-background p-4">
          {error ? (
            <div
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="project-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="project-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="project-status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="project-status"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="project-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="project-description"
              rows={4}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              aria-busy={pending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
