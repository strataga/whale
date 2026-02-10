"use client";

import * as React from "react";
import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { useCRPC } from "@/lib/convex/crpc";

const AVAILABLE_SCOPES = [
  "read",
  "write",
  "admin",
  "bots:read",
  "bots:write",
  "tasks:read",
  "tasks:write",
] as const;

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TokensPage() {
  const crpc = useCRPC();
  const [showForm, setShowForm] = React.useState(false);
  const [newToken, setNewToken] = React.useState<string | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formScopes, setFormScopes] = React.useState<string[]>(["read"]);
  const [formExpiry, setFormExpiry] = React.useState("0");
  const [submitting, setSubmitting] = React.useState(false);

  const tokensQuery = crpc.apiTokens.list.useQuery();
  const createMutation = crpc.apiTokens.create.useMutation();
  const revokeMutation = crpc.apiTokens.revoke.useMutation();

  const tokens = (tokensQuery.data ?? []).map((t) => ({
    id: t._id,
    name: t.name,
    tokenPrefix: t.prefix ?? "",
    scopes: typeof t.scopes === "string" ? t.scopes.split(",") : (t.scopes ?? []),
    expiresAt: t.expiresAt ?? null,
    lastUsedAt: t.lastUsedAt ?? null,
    createdAt: t._creationTime,
  }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const expiresInDays = Number(formExpiry) || 0;
      const expiresAt = expiresInDays > 0
        ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000
        : undefined;

      const result = await createMutation.mutateAsync({
        name: formName,
        scopes: formScopes.join(","),
        expiresAt,
      });
      setNewToken((result as { token: string }).token);
      setFormName("");
      setFormScopes(["read"]);
      setFormExpiry("0");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await revokeMutation.mutateAsync({ id });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function toggleScope(scope: string) {
    setFormScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope],
    );
  }

  if (tokensQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">API Tokens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create tokens for programmatic access to the Whale API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setNewToken(null);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          New Token
        </button>
      </div>

      {newToken && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          <p className="text-sm font-semibold text-emerald-400">
            Token created successfully
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy this token now. You won&apos;t be able to see it again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
              {newToken}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(newToken)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-card hover:bg-muted"
              aria-label="Copy token"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showForm && !newToken && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-foreground">
              Token Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              placeholder="e.g. CI/CD Pipeline"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">
              Scopes
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={formScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="rounded border-border"
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">
              Expiration
            </label>
            <select
              value={formExpiry}
              onChange={(e) => setFormExpiry(e.target.value)}
              className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="0">No expiration</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !formName.trim()}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Token"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {tokens.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <Key className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">No API tokens</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a token to access the Whale API programmatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Prefix
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  Scopes
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Last Used
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Expires
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tokens.map((token) => (
                <tr key={token.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {token.name}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {token.tokenPrefix}...
                    </code>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {token.scopes.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatDate(token.lastUsedAt)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {token.expiresAt ? formatDate(token.expiresAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(token.id)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400"
                      aria-label={`Delete token ${token.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
