import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  bots,
  botTasks,
  botGroupMembers,
  botGroups,
  botMetrics,
} from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

/**
 * Bot Fleet Map (#41) — enriched bot data for visualization.
 * Returns all bots with current task info, group membership, latest metrics.
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allBots = db
    .select()
    .from(bots)
    .where(eq(bots.workspaceId, auth.workspaceId))
    .all();

  const fleet = allBots.map((bot) => {
    // Current running task
    const currentTask = bot.currentBotTaskId
      ? db
          .select({
            id: botTasks.id,
            taskId: botTasks.taskId,
            status: botTasks.status,
            startedAt: botTasks.startedAt,
          })
          .from(botTasks)
          .where(eq(botTasks.id, bot.currentBotTaskId))
          .get()
      : null;

    // Pending task count
    const pendingCount = db
      .select()
      .from(botTasks)
      .where(and(eq(botTasks.botId, bot.id), eq(botTasks.status, "pending")))
      .all().length;

    // Group memberships
    const groups = db
      .select({ groupId: botGroups.id, groupName: botGroups.name })
      .from(botGroupMembers)
      .innerJoin(botGroups, eq(botGroupMembers.botGroupId, botGroups.id))
      .where(eq(botGroupMembers.botId, bot.id))
      .all();

    // Latest metrics
    const latestMetric = db
      .select()
      .from(botMetrics)
      .where(eq(botMetrics.botId, bot.id))
      .limit(1)
      .all()[0] ?? null;

    return {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      statusReason: bot.statusReason,
      environment: bot.environment,
      labels: bot.labels ? JSON.parse(bot.labels) : [],
      capabilities: JSON.parse(bot.capabilities),
      lastSeenAt: bot.lastSeenAt,
      version: bot.version,
      maxConcurrentTasks: bot.maxConcurrentTasks,
      currentTask,
      pendingTaskCount: pendingCount,
      groups,
      latestMetrics: latestMetric
        ? {
            cpuPercent: latestMetric.cpuPercent,
            memoryMb: latestMetric.memoryMb,
            diskPercent: latestMetric.diskPercent,
            recordedAt: latestMetric.createdAt,
          }
        : null,
    };
  });

  return NextResponse.json({ fleet });
}
