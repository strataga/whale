export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and, gte, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/server/cron-auth";

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  const ctx = isCron ? null : await getAuthContext();
  if (!isCron && !ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const periodStart = Math.floor(now / hourMs) * hourMs;
  const windowStart = periodStart - hourMs;

  // In cron mode, get all bots; in user mode, scope to workspace
  const workspaceBots = ctx
    ? db.select({ id: schema.bots.id }).from(schema.bots).where(eq(schema.bots.workspaceId, ctx.workspaceId)).all()
    : db.select({ id: schema.bots.id }).from(schema.bots).all();

  const botIds = workspaceBots.map((b) => b.id);
  let rollupsCreated = 0;

  for (const botId of botIds) {
    const metrics = db
      .select({
        avgCpu: sql<number>`avg(${schema.botMetrics.cpuPercent})`,
        avgMemory: sql<number>`avg(${schema.botMetrics.memoryMb})`,
        avgDisk: sql<number>`avg(${schema.botMetrics.diskPercent})`,
        taskCount: sql<number>`count(*)`,
      })
      .from(schema.botMetrics)
      .where(
        and(
          eq(schema.botMetrics.botId, botId),
          gte(schema.botMetrics.createdAt, windowStart),
        ),
      )
      .get();

    if (!metrics || metrics.taskCount === 0) continue;

    db.insert(schema.botMetricRollups)
      .values({
        id: crypto.randomUUID(),
        botId,
        period: "hourly",
        periodStart,
        avgCpu: metrics.avgCpu != null ? Math.round(metrics.avgCpu) : null,
        avgMemory: metrics.avgMemory != null ? Math.round(metrics.avgMemory) : null,
        avgDisk: metrics.avgDisk != null ? Math.round(metrics.avgDisk) : null,
        taskCount: metrics.taskCount,
        createdAt: now,
      })
      .run();

    rollupsCreated++;
  }

  return NextResponse.json({ rollupsCreated, periodStart });
}
