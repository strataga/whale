export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and, sql, gte, lt } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

interface RiskPrediction {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata: Record<string, unknown>;
}

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const predictions: RiskPrediction[] = [];

  // 1. Bot failure rate trending up
  const recentFailures = db
    .select({
      botId: schema.botTasks.botId,
      failCount: sql<number>`count(*)`,
    })
    .from(schema.botTasks)
    .innerJoin(schema.bots, eq(schema.botTasks.botId, schema.bots.id))
    .where(
      and(
        eq(schema.bots.workspaceId, ctx.workspaceId),
        eq(schema.botTasks.status, "failed"),
        gte(schema.botTasks.createdAt, oneDayAgo),
      ),
    )
    .groupBy(schema.botTasks.botId)
    .all();

  const priorFailures = db
    .select({
      botId: schema.botTasks.botId,
      failCount: sql<number>`count(*)`,
    })
    .from(schema.botTasks)
    .innerJoin(schema.bots, eq(schema.botTasks.botId, schema.bots.id))
    .where(
      and(
        eq(schema.bots.workspaceId, ctx.workspaceId),
        eq(schema.botTasks.status, "failed"),
        gte(schema.botTasks.createdAt, sevenDaysAgo),
        lt(schema.botTasks.createdAt, oneDayAgo),
      ),
    )
    .groupBy(schema.botTasks.botId)
    .all();

  const priorMap = new Map(priorFailures.map((r) => [r.botId, r.failCount]));

  for (const recent of recentFailures) {
    const priorDailyAvg = (priorMap.get(recent.botId) ?? 0) / 6;
    if (recent.failCount > priorDailyAvg * 2 && recent.failCount >= 3) {
      predictions.push({
        type: "bot_failure_trending",
        severity: recent.failCount >= 10 ? "critical" : "high",
        message: `Bot has ${recent.failCount} failures in last 24h, up from ~${Math.round(priorDailyAvg)}/day average`,
        metadata: { botId: recent.botId, recentFailures: recent.failCount, priorDailyAvg: Math.round(priorDailyAvg) },
      });
    }
  }

  // 2. Tasks with past-due dates
  const overdueTasks = db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      dueDate: schema.tasks.dueDate,
      status: schema.tasks.status,
    })
    .from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.projects.workspaceId, ctx.workspaceId),
        lt(schema.tasks.dueDate, now),
        sql`${schema.tasks.status} NOT IN ('done', 'cancelled')`,
      ),
    )
    .all();

  for (const task of overdueTasks) {
    const daysOverdue = Math.floor((now - (task.dueDate ?? 0)) / (24 * 60 * 60 * 1000));
    predictions.push({
      type: "task_overdue",
      severity: daysOverdue >= 7 ? "high" : daysOverdue >= 3 ? "medium" : "low",
      message: `Task "${task.title}" is ${daysOverdue} day(s) overdue`,
      metadata: { taskId: task.id, daysOverdue, status: task.status },
    });
  }

  // 3. Budget burn rate (AI cost)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthlySpend = db
    .select({
      totalCostCents: sql<number>`coalesce(sum(${schema.aiUsageLog.estimatedCostCents}), 0)`,
    })
    .from(schema.aiUsageLog)
    .where(
      and(
        eq(schema.aiUsageLog.workspaceId, ctx.workspaceId),
        gte(schema.aiUsageLog.createdAt, monthStart.getTime()),
      ),
    )
    .get();

  // costBudgets uses entityType/entityId — look for workspace-level budgets
  const budgets = db
    .select()
    .from(schema.costBudgets)
    .where(
      and(
        eq(schema.costBudgets.entityType, "workspace"),
        eq(schema.costBudgets.entityId, ctx.workspaceId),
      ),
    )
    .all();

  for (const budget of budgets) {
    const spent = monthlySpend?.totalCostCents ?? 0;
    const budgetCents = budget.monthlyLimitCents;
    const burnPct = budgetCents > 0 ? Math.round((spent / budgetCents) * 100) : 0;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const expectedPct = Math.round((dayOfMonth / daysInMonth) * 100);

    if (burnPct > expectedPct * 1.5 && spent > 100) {
      predictions.push({
        type: "budget_burn_rate",
        severity: burnPct > 90 ? "critical" : burnPct > 70 ? "high" : "medium",
        message: `AI budget is ${burnPct}% spent (expected ~${expectedPct}% by day ${dayOfMonth})`,
        metadata: { spentCents: spent, budgetCents, burnPct, expectedPct },
      });
    }
  }

  return NextResponse.json({ predictions, analyzedAt: now });
}
