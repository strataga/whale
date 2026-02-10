"use client";

import { useState, useCallback } from "react";

import { BulkActionsBar } from "@/components/tasks/bulk-actions-bar";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: number | null;
  isBlocked?: boolean;
}

interface TaskBoardProps {
  projectId: string;
  tasks: TaskItem[];
}

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const priorityStyles: Record<TaskPriority, string> = {
  urgent: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  high: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  medium: "border-primary/30 bg-primary/10 text-primary",
  low: "border-border bg-muted text-muted-foreground",
};

function PriorityBadge({ priority }: { priority: string }) {
  const styles =
    priorityStyles[priority as TaskPriority] ?? priorityStyles.medium;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
        styles,
      )}
    >
      {priority}
    </span>
  );
}

export function TaskBoard({ projectId, tasks }: TaskBoardProps) {
  const crpc = useCRPC();
  const updateMutation = crpc.tasks.update.useMutation();
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  const tasksByStatus = useCallback(
    (status: TaskStatus) => tasks.filter((t) => t.status === status),
    [tasks],
  );

  function handleDragStart(
    e: React.DragEvent<HTMLDivElement>,
    taskId: string,
  ) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>,
    column: TaskStatus,
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(column);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear if leaving the column element itself (not entering a child)
    if (
      e.currentTarget !== e.relatedTarget &&
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setDragOverColumn(null);
    }
  }

  async function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
    newStatus: TaskStatus,
  ) {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingId(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      await updateMutation.mutateAsync({ id: taskId, status: newStatus });
    } catch (err) {
      console.error("Failed to update task status", err);
    }
  }

  return (
    <div className="space-y-3">
      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onComplete={() => {
          setSelectedIds(new Set());
        }}
      />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnTasks = tasksByStatus(col.key);
        return (
          <div
            key={col.key}
            className={cn(
              "flex min-h-[200px] flex-col rounded-2xl border border-border bg-card p-4 transition-all",
              dragOverColumn === col.key && "ring-2 ring-primary",
            )}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {col.label}
              </h3>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="flex flex-1 flex-col gap-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "cursor-grab rounded-xl border border-border bg-background p-3 shadow-sm transition-opacity active:cursor-grabbing",
                    draggingId === task.id && "opacity-50",
                    selectedIds.has(task.id) && "ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      {task.isBlocked ? (
                        <span className="text-yellow-400" title="Blocked">
                          🔒
                        </span>
                      ) : null}
                      <span className="text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {task.dueDate && task.status !== "done" && task.dueDate < Date.now() ? (
                        <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                          Overdue
                        </span>
                      ) : null}
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </div>
                  {task.description ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-4">
                  <span className="text-xs text-muted-foreground">
                    No tasks
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
