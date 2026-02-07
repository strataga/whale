import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { checkRole, requireAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

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
  if (Number.isNaN(d.getTime())) return "—";
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
  if (!trimmed) return "—";
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

type SearchParams = {
  page?: string;
  limit?: string;
  action?: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireAuthContext();
  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) redirect("/dashboard");

  const sp = await searchParams;

  const requestedPage = parsePositiveInt(sp.page, 1);
  const requestedLimit = parsePositiveInt(sp.limit, 50);
  const limit = Math.min(Math.max(requestedLimit, 1), 200);

  const action = sp.action?.trim() || null;

  const where = action
    ? and(eq(auditLogs.workspaceId, ctx.workspaceId), eq(auditLogs.action, action))
    : eq(auditLogs.workspaceId, ctx.workspaceId);

  const totalRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(where)
    .get();

  const total = totalRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * limit;

  const rows = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const entries = rows.map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: row.createdAt,
    metadata: safeJsonParse(row.metadata ?? "{}"),
    user: row.userId
      ? {
          id: row.userId,
          name: row.userName,
          email: row.userEmail,
        }
      : null,
  }));

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("limit", String(limit));
    if (action) params.set("action", action);
    return `/dashboard/audit-log?${params.toString()}`;
  }

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

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

      <form
        method="get"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label htmlFor="action" className="text-sm font-medium">
              Filter by action
            </label>
            <input
              id="action"
              name="action"
              defaultValue={action ?? ""}
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
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="limit" value={String(limit)} />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Apply
            </button>
            {action ? (
              <Link
                href="/dashboard/audit-log"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </form>

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

            {entries.length ? (
              <div className="divide-y divide-border">
                {entries.map((entry) => {
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
            Page <span className="font-medium text-foreground">{page}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={!canGoPrev}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                canGoPrev ? "hover:bg-muted" : "pointer-events-none opacity-50",
              )}
            >
              Prev
            </Link>
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              aria-disabled={!canGoNext}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                canGoNext ? "hover:bg-muted" : "pointer-events-none opacity-50",
              )}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
