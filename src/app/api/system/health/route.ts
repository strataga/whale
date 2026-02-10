export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and, sql, gte } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Active bots (seen within last 5 minutes)
  const fiveMinAgo = now - 5 * 60 * 1000;
  const activeBots = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bots)
    .where(
      and(
        eq(schema.bots.workspaceId, ctx.workspaceId),
        gte(schema.bots.lastSeenAt, fiveMinAgo),
      ),
    )
    .get();

  // Total bots
  const totalBots = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bots)
    .where(eq(schema.bots.workspaceId, ctx.workspaceId))
    .get();

  // Tasks in progress
  const tasksInProgress = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.projects.workspaceId, ctx.workspaceId),
        eq(schema.tasks.status, "in_progress"),
      ),
    )
    .get();

  // Failed tasks in last 24h
  const failedTasks = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.botTasks)
    .innerJoin(schema.bots, eq(schema.botTasks.botId, schema.bots.id))
    .where(
      and(
        eq(schema.bots.workspaceId, ctx.workspaceId),
        eq(schema.botTasks.status, "failed"),
        gte(schema.botTasks.updatedAt, oneDayAgo),
      ),
    )
    .get();

  // Pending alerts
  const pendingAlerts = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.alerts)
    .where(
      and(
        eq(schema.alerts.workspaceId, ctx.workspaceId),
        sql`${schema.alerts.acknowledgedAt} is null`,
      ),
    )
    .get();

  // Compute composite health score (0-100)
  const activeCount = activeBots?.count ?? 0;
  const totalCount = totalBots?.count ?? 0;
  const failedCount = failedTasks?.count ?? 0;
  const alertCount = pendingAlerts?.count ?? 0;

  let score = 100;

  // Deduct for bot availability
  if (totalCount > 0) {
    const botHealthPct = (activeCount / totalCount) * 100;
    if (botHealthPct < 50) score -= 30;
    else if (botHealthPct < 80) score -= 15;
  }

  // Deduct for recent failures
  if (failedCount >= 10) score -= 25;
  else if (failedCount >= 5) score -= 15;
  else if (failedCount >= 1) score -= 5;

  // Deduct for unacknowledged alerts
  if (alertCount >= 10) score -= 20;
  else if (alertCount >= 5) score -= 10;
  else if (alertCount >= 1) score -= 5;

  score = Math.max(0, score);

  return NextResponse.json({
    score,
    activeBots: activeCount,
    totalBots: totalCount,
    tasksInProgress: tasksInProgress?.count ?? 0,
    failedTasksLast24h: failedCount,
    pendingAlerts: alertCount,
    checkedAt: now,
  });
}
