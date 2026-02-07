"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

function statusChipStyles(value: string, active: boolean) {
  if (!active) return "border-border bg-background text-muted-foreground hover:bg-muted";
  switch (value) {
    case "done":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "in_progress":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    case "todo":
    default:
      return "border-primary/30 bg-primary/10 text-primary";
  }
}

function priorityChipStyles(value: string, active: boolean) {
  if (!active) return "border-border bg-background text-muted-foreground hover:bg-muted";
  switch (value) {
    case "urgent":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    case "high":
      return "border-orange-400/30 bg-orange-400/10 text-orange-200";
    case "medium":
      return "border-primary/30 bg-primary/10 text-primary";
    case "low":
    default:
      return "border-border bg-muted text-foreground";
  }
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TaskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeStatuses = parseList(searchParams.get("status"));
  const activePriorities = parseList(searchParams.get("priority"));
  const searchQuery = searchParams.get("q") ?? "";

  const [localSearch, setLocalSearch] = React.useState(searchQuery);

  // Keep local search in sync with URL param when it changes externally
  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?", { scroll: false });
  }

  function toggleFilter(key: "status" | "priority", value: string) {
    const current = key === "status" ? activeStatuses : activePriorities;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    pushParams({ [key]: next.length ? next.join(",") : null });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q: localSearch.trim() || null });
  }

  function clearAll() {
    router.push("?", { scroll: false });
    setLocalSearch("");
  }

  const hasFilters =
    activeStatuses.length > 0 || activePriorities.length > 0 || searchQuery.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          {/* Status filter */}
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">
              Status
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(({ value, label }) => {
                const active = activeStatuses.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleFilter("status", value)}
                    className={cn(
                      "inline-flex min-h-[44px] items-center rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      statusChipStyles(value, active),
                    )}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority filter */}
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">
              Priority
            </div>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map(({ value, label }) => {
                const active = activePriorities.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleFilter("priority", value)}
                    className={cn(
                      "inline-flex min-h-[44px] items-center rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      priorityChipStyles(value, active),
                    )}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 lg:min-w-[280px]">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search tasks..."
            className="min-h-[44px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Search
          </button>
        </form>
      </div>

      {hasFilters ? (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Filters active
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
