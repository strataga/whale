export const runtime = "nodejs";

import { and, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { auditLogs, botLogs, botTaskEvents, workspaces } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { verifyCronSecret } from "@/lib/server/cron-auth";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  const ctx = isCron ? null : await getAuthContext();
  if (!isCron && !ctx) return jsonError(401, "Unauthorized");

  if (ctx) {
    const roleCheck = checkRole(ctx, "admin");
    if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);
  }

  // Get workspaces to clean (all in cron mode, single in user mode)
  const wsIds = ctx
    ? [ctx.workspaceId]
    : db.select({ id: workspaces.id }).from(workspaces).all().map((w) => w.id);

  let totalDeleted = 0;

  for (const wsId of wsIds) {
    const workspace = db
      .select({ retentionDays: workspaces.retentionDays })
      .from(workspaces)
      .where(eq(workspaces.id, wsId))
      .get();

    if (!workspace?.retentionDays) continue;

    const cutoff = Date.now() - workspace.retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const auditResult = db
      .delete(auditLogs)
      .where(and(eq(auditLogs.workspaceId, wsId), lt(auditLogs.createdAt, cutoff)))
      .run();
    deletedCount += auditResult.changes;

    const botLogResult = db
      .delete(botLogs)
      .where(and(eq(botLogs.workspaceId, wsId), lt(botLogs.createdAt, cutoff)))
      .run();
    deletedCount += botLogResult.changes;

    const eventResult = db
      .delete(botTaskEvents)
      .where(lt(botTaskEvents.createdAt, cutoff))
      .run();
    deletedCount += eventResult.changes;

    if (ctx) {
      logAudit({
        workspaceId: wsId,
        userId: ctx.userId,
        action: "retention.cleanup",
        metadata: { retentionDays: workspace.retentionDays, cutoff, deletedCount },
      });
    }

    totalDeleted += deletedCount;
  }

  if (!ctx && wsIds.length === 0) {
    return jsonError(400, "No workspaces with retention policy configured");
  }

  return NextResponse.json({ success: true, deletedCount: totalDeleted });
}
