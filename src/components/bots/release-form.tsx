"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";

type ApiError = { error?: string };

export function ReleaseForm() {
  const { toast } = useToast();

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload: Record<string, string> = {};
    const version = (formData.get("version") as string)?.trim();
    const title = (formData.get("title") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();
    const releaseUrl = (formData.get("releaseUrl") as string)?.trim();

    if (version) payload.version = version;
    if (title) payload.title = title;
    if (body) payload.body = body;
    if (releaseUrl) payload.releaseUrl = releaseUrl;

    const res = await fetch("/api/bots/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      const message = data?.error ?? "Failed to create release note.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    setPending(false);
    toast("Release note created.", "success");
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="release-version"
            className="block text-sm font-semibold text-foreground"
          >
            Version
          </label>
          <input
            id="release-version"
            name="version"
            type="text"
            required
            placeholder="e.g. 1.2.0"
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div>
          <label
            htmlFor="release-title"
            className="block text-sm font-semibold text-foreground"
          >
            Title
          </label>
          <input
            id="release-title"
            name="title"
            type="text"
            required
            placeholder="Release title"
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="release-body"
          className="block text-sm font-semibold text-foreground"
        >
          Body
        </label>
        <textarea
          id="release-body"
          name="body"
          required
          rows={4}
          placeholder="Describe what changed in this release..."
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      <div>
        <label
          htmlFor="release-url"
          className="block text-sm font-semibold text-foreground"
        >
          Release URL{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="release-url"
          name="releaseUrl"
          type="url"
          placeholder="https://github.com/org/repo/releases/tag/v1.2.0"
          className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create Release Note"}
      </button>
    </form>
  );
}
