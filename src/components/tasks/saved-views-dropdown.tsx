"use client";

import { useState, useEffect, useRef } from "react";
import { Bookmark, ChevronDown, Trash2, Share2, Plus } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

interface SavedView {
  _id: string;
  name: string;
  filters: Record<string, unknown>;
  isShared: boolean;
}

interface SavedViewsDropdownProps {
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}

export function SavedViewsDropdown({
  currentFilters,
  onApply,
}: SavedViewsDropdownProps) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const viewsQuery = crpc.savedViews.list.useQuery({ entityType: "tasks" });
  const views: SavedView[] = viewsQuery.data?.views ?? [];

  const createMutation = crpc.savedViews.create.useMutation();
  const removeMutation = crpc.savedViews.remove.useMutation();

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSave() {
    if (!newName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        entityType: "tasks",
        filters: currentFilters,
        isShared,
      });
      setNewName("");
      setIsShared(false);
      setCreating(false);
      toast("View saved", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to save view", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeMutation.mutateAsync({ id });
      toast("View deleted", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to delete view", "error");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Saved views
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
          <div className="max-h-60 overflow-y-auto p-1">
            {views.length === 0 && !creating && (
              <p className="px-3 py-2 text-xs text-zinc-500">
                No saved views yet
              </p>
            )}

            {views.map((v) => (
              <div
                key={v._id}
                className="group flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-zinc-700"
              >
                <button
                  onClick={() => {
                    onApply(v.filters);
                    setOpen(false);
                  }}
                  className="flex flex-1 items-center gap-2 text-left text-sm text-zinc-200"
                >
                  {v.name}
                  {v.isShared && (
                    <Share2 className="h-3 w-3 text-zinc-500" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(v._id)}
                  className="hidden text-zinc-500 hover:text-rose-400 group-hover:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-700 p-2">
            {creating ? (
              <div className="space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="View name..."
                  className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 placeholder:text-zinc-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Share with team
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={handleSave}
                    className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="flex-1 rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Save current view
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
