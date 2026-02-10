"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

type ParsedTask = {
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
  tags: string[];
};

export function QuickAddTask({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const [text, setText] = React.useState("");
  const [parsed, setParsed] = React.useState<ParsedTask | null>(null);

  const parseMutation = crpc.tasks.parse.useMutation();
  const createMutation = crpc.tasks.create.useMutation();
  const pending = parseMutation.isPending || createMutation.isPending;

  async function handleParse() {
    if (!text.trim()) return;
    setParsed(null);

    try {
      const result = await parseMutation.mutateAsync({ text });
      setParsed(result.parsed);
    } catch (err: any) {
      toast(err?.message ?? "Failed to parse task", "error");
    }
  }

  async function handleCreate() {
    if (!parsed) return;

    const payload: Record<string, unknown> = {
      projectId,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
    };

    if (parsed.dueDate) {
      payload.dueDate = new Date(parsed.dueDate).getTime();
    }

    try {
      await createMutation.mutateAsync(payload);
      toast("Task created!", "success");
      setText("");
      setParsed(null);
    } catch (err: any) {
      toast(err?.message ?? "Failed to create task", "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleParse();
          }}
          placeholder="e.g. Fix login bug on mobile, high priority, due Friday"
          className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={handleParse}
          disabled={pending || !text.trim()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "Parsing..." : "Parse"}
        </button>
      </div>

      {parsed ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="text-sm">
            <span className="font-semibold">Title:</span> {parsed.title}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Description:</span> {parsed.description || "None"}
          </div>
          <div className="flex gap-4 text-sm">
            <span>
              <span className="font-semibold">Priority:</span> {parsed.priority}
            </span>
            <span>
              <span className="font-semibold">Due:</span> {parsed.dueDate ?? "None"}
            </span>
          </div>
          {parsed.tags.length > 0 ? (
            <div className="flex gap-1">
              {parsed.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              Create Task
            </button>
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
