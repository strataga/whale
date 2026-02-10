"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";

type ApiError = { error?: string };

export function GuidelinesForm() {
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/bots/guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });

      const data = (await res.json().catch(() => null)) as
        | (ApiError & Record<string, unknown>)
        | null;

      if (!res.ok) {
        const message = data?.error ?? "Failed to create guideline.";
        setError(message);
        toast(message, "error");
        setPending(false);
        return;
      }

      toast("Guideline created successfully.", "success");
      setTitle("");
      setContent("");
      setPending(false);
    } catch {
      const message = "Network error. Please try again.";
      setError(message);
      toast(message, "error");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="guideline-title"
          className="block text-sm font-medium text-foreground"
        >
          Title
        </label>
        <input
          id="guideline-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Code style rules"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div>
        <label
          htmlFor="guideline-content"
          className="block text-sm font-medium text-foreground"
        >
          Content
        </label>
        <textarea
          id="guideline-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={10000}
          rows={6}
          placeholder="Describe the guideline bots should follow..."
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || !title.trim() || !content.trim()}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create Guideline"}
      </button>
    </form>
  );
}
