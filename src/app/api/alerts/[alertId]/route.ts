export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { acknowledgeAlertSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const { alertId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const alert = db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.workspaceId, ctx.workspaceId)))
    .get();

  if (!alert) return jsonError(404, "Alert not found");

  if (alert.acknowledgedAt) return jsonError(409, "Alert already acknowledged");

  try {
    const body = await req.json();
    acknowledgeAlertSchema.parse(body);

    const now = Date.now();

    db.update(alerts)
      .set({
        acknowledgedAt: now,
        acknowledgedBy: ctx.userId,
      })
      .where(eq(alerts.id, alertId))
      .run();

    const updated = db.select().from(alerts).where(eq(alerts.id, alertId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "alert.acknowledge",
      metadata: { alertId },
    });

    return NextResponse.json({
      alert: updated
        ? { ...updated, metadata: JSON.parse(updated.metadata || "{}") }
        : null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to acknowledge alert");
  }
}
