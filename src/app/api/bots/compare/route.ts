export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ error: "ids query parameter is required" }, { status: 400 });
  }

  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "At least one bot ID is required" }, { status: 400 });
  }

  const comparisons: any[] = [];

  for (const botId of ids) {
    const bot = db
      .select({ id: schema.bots.id, name: schema.bots.name, status: schema.bots.status })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    if (!bot) continue;

    const stats = db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`sum(case when ${schema.botTasks.status} = 'completed' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${schema.botTasks.status} = 'failed' then 1 else 0 end)`,
        avgDurationMs: sql<number>`avg(case when ${schema.botTasks.completedAt} is not null then ${schema.botTasks.completedAt} - ${schema.botTasks.startedAt} else null end)`,
      })
      .from(schema.botTasks)
      .where(eq(schema.botTasks.botId, botId))
      .get();

    comparisons.push({
      botId: bot.id,
      name: bot.name,
      status: bot.status,
      totalTasks: stats?.total ?? 0,
      completed: stats?.completed ?? 0,
      failed: stats?.failed ?? 0,
      avgDurationMs: stats?.avgDurationMs != null ? Math.round(stats.avgDurationMs) : null,
    });
  }

  return NextResponse.json({ comparisons });
}
