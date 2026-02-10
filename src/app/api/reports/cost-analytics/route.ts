export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Aggregate by month
  const byMonth = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${schema.aiUsageLog.createdAt} / 1000, 'unixepoch')`.as("month"),
      totalInputTokens: sql<number>`sum(${schema.aiUsageLog.inputTokens})`,
      totalOutputTokens: sql<number>`sum(${schema.aiUsageLog.outputTokens})`,
      totalCostCents: sql<number>`sum(${schema.aiUsageLog.estimatedCostCents})`,
      requestCount: sql<number>`count(*)`,
    })
    .from(schema.aiUsageLog)
    .where(eq(schema.aiUsageLog.workspaceId, ctx.workspaceId))
    .groupBy(sql`strftime('%Y-%m', ${schema.aiUsageLog.createdAt} / 1000, 'unixepoch')`)
    .orderBy(sql`month`)
    .all();

  // Aggregate by operation
  const byOperation = db
    .select({
      operation: schema.aiUsageLog.operation,
      totalInputTokens: sql<number>`sum(${schema.aiUsageLog.inputTokens})`,
      totalOutputTokens: sql<number>`sum(${schema.aiUsageLog.outputTokens})`,
      totalCostCents: sql<number>`sum(${schema.aiUsageLog.estimatedCostCents})`,
      requestCount: sql<number>`count(*)`,
    })
    .from(schema.aiUsageLog)
    .where(eq(schema.aiUsageLog.workspaceId, ctx.workspaceId))
    .groupBy(schema.aiUsageLog.operation)
    .all();

  // Aggregate by provider
  const byProvider = db
    .select({
      provider: schema.aiUsageLog.provider,
      totalInputTokens: sql<number>`sum(${schema.aiUsageLog.inputTokens})`,
      totalOutputTokens: sql<number>`sum(${schema.aiUsageLog.outputTokens})`,
      totalCostCents: sql<number>`sum(${schema.aiUsageLog.estimatedCostCents})`,
      requestCount: sql<number>`count(*)`,
    })
    .from(schema.aiUsageLog)
    .where(eq(schema.aiUsageLog.workspaceId, ctx.workspaceId))
    .groupBy(schema.aiUsageLog.provider)
    .all();

  // Grand totals
  const totals = db
    .select({
      totalInputTokens: sql<number>`coalesce(sum(${schema.aiUsageLog.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${schema.aiUsageLog.outputTokens}), 0)`,
      totalCostCents: sql<number>`coalesce(sum(${schema.aiUsageLog.estimatedCostCents}), 0)`,
      requestCount: sql<number>`count(*)`,
    })
    .from(schema.aiUsageLog)
    .where(eq(schema.aiUsageLog.workspaceId, ctx.workspaceId))
    .get();

  return NextResponse.json({
    byMonth,
    byOperation,
    byProvider,
    totals: totals ?? { totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0, requestCount: 0 },
  });
}
