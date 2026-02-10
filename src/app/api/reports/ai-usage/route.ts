export const runtime = "nodejs";

import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { aiUsageLog } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const byOperation = db
    .select({
      operation: aiUsageLog.operation,
      totalInputTokens: sql<number>`sum(${aiUsageLog.inputTokens})`.mapWith(Number),
      totalOutputTokens: sql<number>`sum(${aiUsageLog.outputTokens})`.mapWith(Number),
      totalCostCents: sql<number>`sum(${aiUsageLog.estimatedCostCents})`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.workspaceId, ctx.workspaceId))
    .groupBy(aiUsageLog.operation)
    .all();

  const byProvider = db
    .select({
      provider: aiUsageLog.provider,
      totalInputTokens: sql<number>`sum(${aiUsageLog.inputTokens})`.mapWith(Number),
      totalOutputTokens: sql<number>`sum(${aiUsageLog.outputTokens})`.mapWith(Number),
      totalCostCents: sql<number>`sum(${aiUsageLog.estimatedCostCents})`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.workspaceId, ctx.workspaceId))
    .groupBy(aiUsageLog.provider)
    .all();

  const totals = db
    .select({
      totalInputTokens: sql<number>`sum(${aiUsageLog.inputTokens})`.mapWith(Number),
      totalOutputTokens: sql<number>`sum(${aiUsageLog.outputTokens})`.mapWith(Number),
      totalCostCents: sql<number>`sum(${aiUsageLog.estimatedCostCents})`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.workspaceId, ctx.workspaceId))
    .get();

  return NextResponse.json({
    totals: totals ?? {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostCents: 0,
      count: 0,
    },
    byOperation,
    byProvider,
  });
}
