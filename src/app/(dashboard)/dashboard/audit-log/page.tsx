"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCRPC } from "@/lib/convex/crpc";

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { raw };
  }
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function metadataPreview(metadata: unknown) {
  const serialized = (() => {
    if (metadata === null || metadata === undefined) return "";
    if (typeof metadata === "string") return metadata;
    try {
      return JSON.stringify(metadata);
    } catch {
      return String(metadata);
    }
  })();

  const trimmed = serialized.trim();
  if (!trimmed) return "\u2014";
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const crpc = useCRPC();
  const router = useRouter();

  const [filterAction, setFilterAction] = useState("");
  const [appliedAction, setAppliedAction] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: me, isPending: mePending } = crpc.users.me.useQuery({});
  const { data: rawLogs, isPending: logsPending } = crpc.auditLogs.list.useQuery({
    action: appliedAction || undefined,
    limit: 500,
  });
  const { data: usersList } = crpc.users.list.useQuery({});

  const isAdmin = me?.role === "admin";
  const isPending = mePending || logsPending;

  const userMap = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string }>();
    if (!usersList) return map;
    for (const u of usersList) {
      map.set(u._id, { name: u.name ?? null, email: u.email });
    }
    return map;
  }, [usersList]);

  const entries = useMemo(() => {
    if (!rawLogs) return [];
    return rawLogs.map((row: any) => {
      const user = row.userId ? userMap.get(row.userId as string) : null;
      return {
        id: row._id,
        action: row.action,
        createdAt: row._creationTime,
        metadata: safeJsonParse(row.metadata ?? "{}"),
        user: user
          ? {
              id: row.userId as string,
              name: user.name,
              email: user.email,
            }
          : null,
      };
    });
  }, [rawLogs, userMap]);

  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pagedEntries = entries.slice(offset, offset + PAGE_SIZE);

  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages;

  // Redirect non-admin users
  if (!mePending && !isAdmin) {
    router.push("/dashboard");
    return null;
  }

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Audit Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Security-relevant and planning events in this workspace.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[52px] animate-pulse rounded-xl border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Audit Log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Security-relevant and planning events in this workspace.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {total} event{total === 1 ? "" : "s"}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label htmlFor="action" className="text-sm font-medium">
              Filter by action
            </label>
            <input
              id="action"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              placeholder="project.create"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <p className="text-xs text-muted-foreground">
              Examples:{" "}
              <code className="font-mono">project.create</code>,{" "}
              <code className="font-mono">task.update</code>,{" "}
              <code className="font-mono">bot.register</code>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAppliedAction(filterAction.trim() || null);
                setPage(1);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Apply
            </button>
            {appliedAction ? (
              <button
                type="button"
                onClick={() => {
                  setFilterAction("");
                  setAppliedAction(null);
                  setPage(1);
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[180px_240px_240px_1fr_44px] gap-4 border-b border-border px-6 py-3 text-xs font-semibold text-muted-foreground">
              <div>Timestamp</div>
              <div>User</div>
              <div>Action</div>
              <div>Metadata</div>
              <div className="sr-only">Expand</div>
            </div>

            {pagedEntries.length ? (
              <div className="divide-y divide-border">
                {pagedEntries.map((entry: any) => {
                  const userLabel =
                    entry.user?.name?.trim() ||
                    entry.user?.email?.trim() ||
                    "System";
                  const secondary =
                    entry.user?.name?.trim() && entry.user?.email?.trim()
                      ? entry.user.email
                      : null;

                  return (
                    <details key={entry.id} className="group">
                      <summary className="grid min-h-[44px] cursor-pointer list-none grid-cols-[180px_240px_240px_1fr_44px] items-start gap-4 px-6 py-3 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {userLabel}
                          </div>
                          {secondary ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {secondary}
                            </div>
                          ) : null}
                        </div>
                        <div className="truncate font-mono text-xs text-foreground">
                          {entry.action}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {metadataPreview(entry.metadata)}
                        </div>
                        <div className="flex items-center justify-end">
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </div>
                      </summary>

                      <div className="border-t border-border bg-background px-6 py-4">
                        <div className="text-xs font-semibold text-muted-foreground">
                          Metadata JSON
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-card p-4 text-xs text-foreground">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-sm font-semibold text-foreground">
                  No audit events yet
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  As you create projects, edit tasks, and pair bots, events will
                  appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{safePage}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                canGoPrev ? "hover:bg-muted" : "pointer-events-none opacity-50",
              )}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                canGoNext ? "hover:bg-muted" : "pointer-events-none opacity-50",
              )}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
