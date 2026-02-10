export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { updateRetentionSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const workspace = db
    .select({ retentionDays: workspaces.retentionDays })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .get();

  return NextResponse.json({
    retentionDays: workspace?.retentionDays ?? null,
  });
}

export async function PUT(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = updateRetentionSchema.parse(body);

    db.update(workspaces)
      .set({
        retentionDays: data.retentionDays,
        updatedAt: Date.now(),
      })
      .where(eq(workspaces.id, ctx.workspaceId))
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "retention.update",
      metadata: { retentionDays: data.retentionDays },
    });

    return NextResponse.json({ retentionDays: data.retentionDays });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update retention policy");
  }
}
