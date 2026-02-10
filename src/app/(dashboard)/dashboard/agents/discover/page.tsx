"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCRPC } from "@/lib/convex/crpc";

export default function DiscoverAgentPage() {
  const router = useRouter();
  const crpc = useCRPC();
  const createAgentMutation = crpc.agents.create.useMutation();

  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{
    agentId: string;
    name?: string;
  } | null>(null);

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Fetch the agent card from the remote URL (external discovery stays as fetch)
      const cardUrl = url.trim().replace(/\/$/, "") + "/.well-known/agent.json";
      const cardRes = await fetch(cardUrl);

      if (!cardRes.ok) {
        setError(`Failed to fetch Agent Card from ${cardUrl} (${cardRes.status})`);
        return;
      }

      const card = await cardRes.json();

      // Register the discovered agent via cRPC
      const agentId = await createAgentMutation.mutateAsync({
        name: card.name ?? "Discovered Agent",
        type: "external",
        description: card.description ?? "",
        url: url.trim(),
        slug: card.slug,
        visibility: "private",
      });

      setSuccess({ agentId: agentId as string, name: card.name });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error \u2014 check the URL",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Agent Registry
        </Link>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Discover Agent
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the base URL of an A2A-compatible agent. Whale will fetch its{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            /.well-known/agent.json
          </code>{" "}
          Agent Card and register it in your workspace.
        </p>
      </div>

      <form onSubmit={handleDiscover} className="space-y-4">
        <div>
          <label
            htmlFor="agent-url"
            className="mb-1.5 block text-sm font-medium"
          >
            Agent URL
          </label>
          <input
            id="agent-url"
            type="url"
            required
            placeholder="https://agent.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Example: <code className="font-mono">https://code-review-bot.acme.dev</code>
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
              Discovering...
            </>
          ) : (
            "Discover Agent"
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm font-medium text-rose-400">Discovery failed</p>
          <p className="mt-1 text-sm text-rose-300/80">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-sm font-semibold text-emerald-400">
            Agent discovered successfully
          </p>
          <p className="mt-1 text-sm text-emerald-300/80">
            {success.name ? (
              <>
                <strong>{success.name}</strong> has been registered in your
                workspace.
              </>
            ) : (
              "The agent has been registered in your workspace."
            )}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/agents")}
              className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              View Agents
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setUrl("");
              }}
              className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Discover Another
            </button>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">How A2A Discovery Works</h3>
        <div className="mt-4 space-y-3">
          {[
            {
              step: "1",
              title: "Fetch Agent Card",
              desc: "Whale requests the agent's .well-known/agent.json endpoint to learn its capabilities.",
            },
            {
              step: "2",
              title: "Validate & Register",
              desc: "The Agent Card is validated against the A2A v0.3 specification and stored in your registry.",
            },
            {
              step: "3",
              title: "Ready for Tasks",
              desc: "The agent appears in your registry. You can assign tasks, negotiate terms, and settle payments.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-xs font-bold text-cyan-400">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
