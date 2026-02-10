"use client";

import { useMemo } from "react";

import { TemplateManager } from "@/components/tasks/template-manager";
import { useCRPC } from "@/lib/convex/crpc";

function safeParseJson(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function TemplatesPage() {
  const crpc = useCRPC();

  const { data: rawTemplates, isPending } =
    crpc.taskTemplates.list.useQuery({});

  const templates = useMemo(() => {
    if (!rawTemplates) return [];
    return rawTemplates.map((t: any) => ({
      ...t,
      id: t._id,
      tags: safeParseJson(t.tagsJson),
      subtaskTitles: safeParseJson(t.subtasksJson),
    }));
  }, [rawTemplates]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Task Templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create reusable templates to quickly add tasks with pre-filled fields and subtask checklists.
          </p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-2xl border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Task Templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create reusable templates to quickly add tasks with pre-filled fields and subtask checklists.
        </p>
      </div>

      <TemplateManager templates={templates} />
    </div>
  );
}
