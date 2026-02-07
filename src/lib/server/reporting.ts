import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs, projects, tasks, users } from "@/lib/db/schema";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type DailySummaryRow = { label: string; count: number };
export type WeeklySummaryRow = { label: string; count: number };

export type BotActivityRow = {
  id: string;
  action: string;
  createdAt: number;
  userName: string | null;
  userEmail: string | null;
};

export type ReportingSummary = {
  daily: DailySummaryRow[];
  weekly: WeeklySummaryRow[];
  botActivity: BotActivityRow[];
  totals: {
    completedLast7Days: number;
    completedLast30Days: number;
  };
};

export function getReportingSummary(workspaceId: string): ReportingSummary {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * ONE_DAY_MS;
  const thirtyDaysAgo = now - 30 * ONE_DAY_MS;
  const sixWeeksAgo = now - 6 * 7 * ONE_DAY_MS;

  const dailyRows = db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', ${tasks.updatedAt} / 1000, 'unixepoch')`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(tasks.status, "done"),
        sql`${tasks.updatedAt} >= ${sevenDaysAgo}`,
      ),
    )
    .groupBy(sql`strftime('%Y-%m-%d', ${tasks.updatedAt} / 1000, 'unixepoch')`)
    .orderBy(sql`strftime('%Y-%m-%d', ${tasks.updatedAt} / 1000, 'unixepoch')`)
    .all();

  const weeklyRows = db
    .select({
      week: sql<string>`strftime('%Y-%W', ${tasks.updatedAt} / 1000, 'unixepoch')`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(tasks.status, "done"),
        sql`${tasks.updatedAt} >= ${sixWeeksAgo}`,
      ),
    )
    .groupBy(sql`strftime('%Y-%W', ${tasks.updatedAt} / 1000, 'unixepoch')`)
    .orderBy(sql`strftime('%Y-%W', ${tasks.updatedAt} / 1000, 'unixepoch')`)
    .all();

  const completedLast7DaysRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(tasks.status, "done"),
        sql`${tasks.updatedAt} >= ${sevenDaysAgo}`,
      ),
    )
    .get();

  const completedLast30DaysRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(tasks.status, "done"),
        sql`${tasks.updatedAt} >= ${thirtyDaysAgo}`,
      ),
    )
    .get();

  const botActivity = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(
      and(
        eq(auditLogs.workspaceId, workspaceId),
        sql`${auditLogs.action} like 'bot.%' or ${auditLogs.action} like 'bot_task.%'`,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(25)
    .all();

  return {
    daily: fillDailySeries(dailyRows, now, 7),
    weekly: weeklyRows.map((row) => ({ label: row.week, count: row.count })),
    botActivity,
    totals: {
      completedLast7Days: completedLast7DaysRow?.count ?? 0,
      completedLast30Days: completedLast30DaysRow?.count ?? 0,
    },
  };
}

function fillDailySeries(
  rows: Array<{ day: string; count: number }>,
  now: number,
  days: number,
): DailySummaryRow[] {
  const map = new Map(rows.map((row) => [row.day, row.count]));
  const result: DailySummaryRow[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * ONE_DAY_MS);
    const key = date.toISOString().slice(0, 10);
    result.push({
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      count: map.get(key) ?? 0,
    });
  }

  return result;
}
