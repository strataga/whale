"use client";

import * as React from "react";
import { X } from "lucide-react";

const SHORTCUTS = [
  { keys: ["n"], description: "Create new task" },
  { keys: ["p"], description: "Create new project" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["g", "d"], description: "Go to Dashboard" },
  { keys: ["g", "p"], description: "Go to Projects" },
  { keys: ["g", "b"], description: "Go to Bots" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close dialog / cancel" },
] as const;

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let pending = "";
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      // Two-key combos (g+d, g+p, g+b)
      if (pending === "g") {
        if (timeout) clearTimeout(timeout);
        pending = "";
        if (e.key === "d") window.location.href = "/dashboard";
        else if (e.key === "p") window.location.href = "/dashboard/projects";
        else if (e.key === "b") window.location.href = "/dashboard/bots";
        return;
      }

      if (e.key === "g") {
        pending = "g";
        timeout = setTimeout(() => {
          pending = "";
        }, 500);
        return;
      }

      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        // Dispatch custom event for task creation
        window.dispatchEvent(new CustomEvent("whale:shortcut", { detail: "new-task" }));
        return;
      }

      if (e.key === "p" && !e.ctrlKey && !e.metaKey) {
        window.location.href = "/dashboard/projects/new";
        return;
      }

      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("whale:shortcut", { detail: "focus-search" }));
        return;
      }

      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("whale:shortcut", { detail: "focus-search" }));
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.description}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
