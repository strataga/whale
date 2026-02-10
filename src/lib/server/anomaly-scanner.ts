import { eq, and, gt } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

/**
 * Scan for bot anomalies within a workspace.
 * Returns IDs of any alerts created.
 *
 * Detects:
 * 1. Failure spikes: >50% failure rate in the last hour with >=3 tasks
 * 2. Stale bots: no heartbeat in 15 minutes for non-offline bots
 */
export function scanAnomalies(
  db: BetterSQLite3Database<typeof schema>,
  workspaceId: string,
  now?: number,
): string[] {
  const timestamp = now ?? Date.now();
  const oneHourAgo = timestamp - 60 * 60 * 1000;
  const alertIds: string[] = [];

  const wsBots = db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.workspaceId, workspaceId))
    .all();

  for (const bot of wsBots) {
    // 1. Check failure rate in last hour
    const recentTasks = db
      .select()
      .from(schema.botTasks)
      .where(
        and(
          eq(schema.botTasks.botId, bot.id),
          gt(schema.botTasks.completedAt, oneHourAgo),
        ),
      )
      .all();

    const failedCount = recentTasks.filter((t) => t.status === "failed").length;
    const totalCount = recentTasks.length;

    if (totalCount >= 3 && failedCount / totalCount > 0.5) {
      const alertId = crypto.randomUUID();
      db.insert(schema.alerts)
        .values({
          id: alertId,
          workspaceId,
          type: "bot_failure_spike",
          severity: "critical",
          message: `Bot "${bot.name}" has ${failedCount}/${totalCount} failed tasks in the last hour`,
          metadata: JSON.stringify({
            botId: bot.id,
            failedCount,
            totalCount,
          }),
          createdAt: timestamp,
        })
        .run();
      alertIds.push(alertId);
    }

    // 2. Stale bot detection
    if (
      bot.status !== "offline" &&
      bot.lastSeenAt &&
      timestamp - bot.lastSeenAt > 15 * 60 * 1000
    ) {
      const alertId = crypto.randomUUID();
      db.insert(schema.alerts)
        .values({
          id: alertId,
          workspaceId,
          type: "bot_stale",
          severity: "warning",
          message: `Bot "${bot.name}" hasn't sent a heartbeat in over 15 minutes`,
          metadata: JSON.stringify({
            botId: bot.id,
            lastSeenAt: bot.lastSeenAt,
            status: bot.status,
          }),
          createdAt: timestamp,
        })
        .run();
      alertIds.push(alertId);
    }
  }

  return alertIds;
}

/**
 * Run anomaly scan across all workspaces.
 * Used by the cron route.
 */
export function scanAllWorkspaces(
  db: BetterSQLite3Database<typeof schema>,
  now?: number,
): { alertsCreated: number; alertIds: string[] } {
  const allWorkspaces = db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .all();

  const allAlertIds: string[] = [];
  for (const ws of allWorkspaces) {
    const ids = scanAnomalies(db, ws.id, now);
    allAlertIds.push(...ids);
  }

  return { alertsCreated: allAlertIds.length, alertIds: allAlertIds };
}
