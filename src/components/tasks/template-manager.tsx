"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

type Template = {
  _id: string;
  name: string;
  titlePattern: string | null;
  description: string | null;
  priority: string | null;
  tags: string[];
  subtaskTitles: string[];
  _creationTime: number;
};

export function TemplateManager({ templates }: { templates: Template[] }) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const [showForm, setShowForm] = React.useState(false);

  const [name, setName] = React.useState("");
  const [titlePattern, setTitlePattern] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [subtaskInput, setSubtaskInput] = React.useState("");

  const createMutation = crpc.taskTemplates.create.useMutation();
  const removeMutation = crpc.taskTemplates.remove.useMutation();
  const pending = createMutation.isPending;

  async function createTemplate() {
    if (!name.trim()) return;

    const subtaskTitles = subtaskInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        titlePattern: titlePattern.trim() || undefined,
        description: description.trim() || undefined,
        priority,
        subtaskTitles: subtaskTitles.length > 0 ? subtaskTitles : undefined,
      });
      toast("Template created", "success");
      setName("");
      setTitlePattern("");
      setDescription("");
      setPriority("medium");
      setSubtaskInput("");
      setShowForm(false);
    } catch (err: any) {
      toast(err?.message ?? "Failed to create template", "error");
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;

    try {
      await removeMutation.mutateAsync({ id });
      toast("Template deleted", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to delete template", "error");
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        New Template
      </button>

      {showForm ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="space-y-1">
            <label htmlFor="tpl-name" className="text-xs font-medium">
              Template Name *
            </label>
            <input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bug Report"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="tpl-title" className="text-xs font-medium">
              Title Pattern
            </label>
            <input
              id="tpl-title"
              value={titlePattern}
              onChange={(e) => setTitlePattern(e.target.value)}
              placeholder="e.g. [BUG] "
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="tpl-desc" className="text-xs font-medium">
              Description
            </label>
            <textarea
              id="tpl-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Default task description..."
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="tpl-priority" className="text-xs font-medium">
              Default Priority
            </label>
            <select
              id="tpl-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="tpl-subtasks" className="text-xs font-medium">
              Subtasks (one per line)
            </label>
            <textarea
              id="tpl-subtasks"
              rows={3}
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              placeholder={"Reproduce the issue\nIdentify root cause\nWrite fix\nVerify fix"}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={createTemplate}
              disabled={pending || !name.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t._id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                {t.titlePattern ? (
                  <div className="text-xs text-muted-foreground">
                    Title prefix: <span className="font-mono">{t.titlePattern}</span>
                  </div>
                ) : null}
                {t.description ? (
                  <div className="line-clamp-2 text-xs text-muted-foreground">
                    {t.description}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Priority: {t.priority ?? "medium"}</span>
                  {t.subtaskTitles.length > 0 ? (
                    <span>{t.subtaskTitles.length} subtasks</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteTemplate(t._id)}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Delete template"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h4 className="text-sm font-semibold">No templates yet</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a template to speed up task creation with pre-filled fields.
          </p>
        </div>
      )}
    </div>
  );
}
