"use client";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onComplete: () => void;
}

export function BulkActionsBar({
  selectedIds,
  onClear,
  onComplete,
}: BulkActionsBarProps) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const updateMutation = crpc.tasks.update.useMutation();
  const removeMutation = crpc.tasks.remove.useMutation();

  const loading = updateMutation.isPending || removeMutation.isPending;

  if (selectedIds.length === 0) return null;

  async function executeBulk(operation: string, value?: string) {
    try {
      if (operation === "delete") {
        for (const id of selectedIds) {
          await removeMutation.mutateAsync({ id });
        }
      } else {
        for (const id of selectedIds) {
          await updateMutation.mutateAsync({ id, [operation]: value });
        }
      }
      toast("Bulk operation completed", "success");
      onComplete();
    } catch (err: any) {
      toast(err?.message ?? "Bulk operation failed", "error");
    }
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 backdrop-blur">
      <span className="text-sm font-medium text-primary">
        {selectedIds.length} selected
      </span>

      <div className="flex items-center gap-2">
        <select
          className="rounded-lg border border-border bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
          disabled={loading}
          onChange={(e) => {
            const val = e.target.value;
            if (val) executeBulk("status", val);
            e.target.value = "";
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Set status...
          </option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>

        <select
          className="rounded-lg border border-border bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
          disabled={loading}
          onChange={(e) => {
            const val = e.target.value;
            if (val) executeBulk("priority", val);
            e.target.value = "";
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Set priority...
          </option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <button
          onClick={() => {
            if (confirm(`Delete ${selectedIds.length} tasks?`)) {
              executeBulk("delete");
            }
          }}
          disabled={loading}
          className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-400/20 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <button
        onClick={onClear}
        className="ml-auto text-xs text-zinc-400 hover:text-zinc-200"
      >
        Clear selection
      </button>

      {loading && (
        <span className="text-xs text-zinc-500 animate-pulse">
          Processing...
        </span>
      )}
    </div>
  );
}
