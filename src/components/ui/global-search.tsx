"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckSquare,
  FolderKanban,
  Milestone,
  Search,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  description?: string;
  extra?: string;
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  task: CheckSquare,
  project: FolderKanban,
  milestone: Milestone,
  bot: Bot,
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    function handleEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail === "focus-search") {
        setOpen(true);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }

    window.addEventListener("whale:shortcut", handleEvent);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("whale:shortcut", handleEvent);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setSelectedIndex(0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [query]);

  function navigateTo(result: SearchResult) {
    setOpen(false);
    if (result.type === "project") {
      router.push(`/dashboard/projects/${result.id}`);
    } else if (result.type === "task") {
      // Tasks don't have their own page yet, navigate to projects
      router.push("/dashboard/projects");
    } else if (result.type === "bot") {
      router.push(`/dashboard/bots/${result.id}`);
    } else if (result.type === "milestone") {
      router.push("/dashboard/projects");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigateTo(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm">
      <div
        className="w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        role="dialog"
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, bots..."
            className="h-12 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(24rem,50vh)] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Type to search across your workspace.
            </div>
          ) : (
            <ul className="py-2">
              {results.map((r, i) => {
                const Icon = TYPE_ICONS[r.type] ?? Search;
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      onClick={() => navigateTo(r)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                        i === selectedIndex
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.title}</div>
                        {r.description ? (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {r.description}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {r.type}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↑↓</kbd> navigate{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">↵</kbd> open{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
