import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";

import { BotActivityLog } from "@/components/bots/bot-activity-log";
import { BotTaskStatus } from "@/components/bots/bot-task-status";
import { RevokeBotButton } from "@/components/bots/revoke-bot-button";
import { db } from "@/lib/db";
import { bots, botTasks, tasks } from "@/lib/db/schema";
import { checkRole, requireAuthContext } from "@/lib/server/auth-context";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

function statusStyles(status?: string | null) {
  switch (status) {
    case "idle":
    case "online": // legacy
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "working":
    case "busy": // legacy
      return "border-blue-400/30 bg-blue-400/10 text-blue-200";
    case "waiting":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "recovering":
      return "border-purple-400/30 bg-purple-400/10 text-purple-200";
    case "error":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    case "offline":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function parseCapabilities(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      // Fall through.
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function formatDateTime(ts?: number | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const ctx = await requireAuthContext();
  const isAdmin = !checkRole(ctx, "admin");

  // Mark stale active bots as offline
  const staleStatuses = ["idle", "working", "waiting", "online", "busy"];
  for (const s of staleStatuses) {
    db.update(bots)
      .set({
        status: "offline",
        statusReason: "Stale: no heartbeat",
        statusChangedAt: sql`(strftime('%s','now') * 1000)`,
        updatedAt: sql`(strftime('%s','now') * 1000)`,
      })
      .where(
        and(
          eq(bots.workspaceId, ctx.workspaceId),
          eq(bots.status, s),
          sql`${bots.lastSeenAt} < (strftime('%s','now') * 1000 - 5 * 60 * 1000)`,
        ),
      )
      .run();
  }

  const bot = db
    .select({
      id: bots.id,
      name: bots.name,
      host: bots.host,
      status: bots.status,
      statusReason: bots.statusReason,
      capabilities: bots.capabilities,
      lastSeenAt: bots.lastSeenAt,
      version: bots.version,
      onboardedAt: bots.onboardedAt,
      currentBotTaskId: bots.currentBotTaskId,
      createdAt: bots.createdAt,
    })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) notFound();

  // Look up current task title if bot is working on something
  let currentTaskTitle: string | null = null;
  if (bot.currentBotTaskId) {
    const currentBotTask = db
      .select({ taskTitle: tasks.title })
      .from(botTasks)
      .innerJoin(tasks, eq(botTasks.taskId, tasks.id))
      .where(eq(botTasks.id, bot.currentBotTaskId))
      .get();
    currentTaskTitle = currentBotTask?.taskTitle ?? null;
  }

  const recentBotTasks = db
    .select({
      id: botTasks.id,
      status: botTasks.status,
      outputSummary: botTasks.outputSummary,
      createdAt: botTasks.createdAt,
      taskId: tasks.id,
      taskTitle: tasks.title,
    })
    .from(botTasks)
    .innerJoin(tasks, eq(botTasks.taskId, tasks.id))
    .where(eq(botTasks.botId, bot.id))
    .orderBy(desc(botTasks.createdAt))
    .limit(25)
    .all();

  const capabilities = parseCapabilities(bot.capabilities);
  const registeredAt = formatDateTime(bot.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/dashboard/bots"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Bots
          </Link>
          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
            {bot.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{bot.host}</span>
          </p>
        </div>

        {isAdmin ? <RevokeBotButton botId={bot.id} /> : null}
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">Bot info</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Status, capabilities, and registration metadata.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold",
                statusStyles(bot.status),
              )}
            >
              {bot.status ?? "offline"}
            </span>
            {currentTaskTitle ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-200">
                Working on: {currentTaskTitle}
              </span>
            ) : null}
            {bot.statusReason ? (
              <span className="text-xs text-muted-foreground">{bot.statusReason}</span>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-xs font-semibold text-muted-foreground">
              Host
            </div>
            <div className="mt-2 font-mono text-sm text-foreground">
              {bot.host}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="text-xs font-semibold text-muted-foreground">
              Registered
            </div>
            <div className="mt-2 text-sm text-foreground">
              {registeredAt ?? "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold text-muted-foreground">
            Capabilities
          </div>
          {capabilities.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {capabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
                >
                  {cap}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">
              No capabilities reported.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Recent bot tasks</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest assignments and reported output summaries.
        </p>

        {recentBotTasks.length ? (
          <div className="mt-5 space-y-3">
            {recentBotTasks.map((bt) => (
              <div
                key={bt.id}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {bt.taskTitle}
                    </div>
                    {bt.outputSummary ? (
                      <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {bt.outputSummary}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">
                        No output summary yet.
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <BotTaskStatus status={bt.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
            No bot tasks yet.
          </div>
        )}
      </section>

      <BotActivityLog botId={bot.id} />
    </div>
  );
}
