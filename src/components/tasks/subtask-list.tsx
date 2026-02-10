"use client";

import * as React from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

type Subtask = {
  _id: string;
  title: string;
  done: number;
  position: number;
};

export function SubtaskList({
  projectId,
  taskId,
  subtasks,
}: {
  projectId: string;
  taskId: string;
  subtasks: Subtask[];
}) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const [newTitle, setNewTitle] = React.useState("");

  const createMutation = crpc.subtasks.create.useMutation();
  const updateMutation = crpc.subtasks.update.useMutation();
  const removeMutation = crpc.subtasks.remove.useMutation();

  const adding = createMutation.isPending;

  const doneCount = subtasks.filter((s) => s.done).length;

  async function addSubtask() {
    if (!newTitle.trim()) return;
    try {
      await createMutation.mutateAsync({ projectId, taskId, title: newTitle.trim() });
      setNewTitle("");
      toast("Subtask added", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to add subtask", "error");
    }
  }

  async function toggleDone(subtask: Subtask) {
    try {
      await updateMutation.mutateAsync({ id: subtask._id, done: !subtask.done });
    } catch (err: any) {
      toast(err?.message ?? "Failed to update subtask", "error");
    }
  }

  async function deleteSubtask(subtaskId: string) {
    try {
      await removeMutation.mutateAsync({ id: subtaskId });
      toast("Subtask removed", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to delete subtask", "error");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted-foreground">
          Subtasks ({doneCount}/{subtasks.length})
        </span>
        {subtasks.length > 0 ? (
          <div className="h-1.5 w-20 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-[width]"
              style={{ width: `${subtasks.length ? (doneCount / subtasks.length) * 100 : 0}%` }}
            />
          </div>
        ) : null}
      </div>

      {subtasks.length > 0 ? (
        <ul className="space-y-1">
          {subtasks.map((s) => (
            <li key={s._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
              <button
                type="button"
                onClick={() => toggleDone(s)}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                  s.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {s.done ? <Check className="h-3 w-3" /> : null}
              </button>
              <span className={`flex-1 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => deleteSubtask(s._id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Delete subtask"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addSubtask();
          }}
          placeholder="Add subtask..."
          className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={addSubtask}
          disabled={adding || !newTitle.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
          aria-label="Add"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
