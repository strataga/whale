import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { auditLogs, tasks, users } from "@/lib/db/schema";
import { updateUserRoleSchema } from "@/lib/validators";
import { checkRole, getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const patch = updateUserRoleSchema.parse(body);

    if (userId === ctx.userId && patch.role !== "admin") {
      return jsonError(400, "You can't demote yourself");
    }

    const target = db
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.workspaceId, ctx.workspaceId)))
      .get();

    if (!target) return jsonError(404, "User not found");

    if ((target.role ?? "member") === patch.role) {
      return NextResponse.json({ ok: true });
    }

    db.update(users)
      .set({ role: patch.role, updatedAt: Date.now() })
      .where(and(eq(users.id, target.id), eq(users.workspaceId, ctx.workspaceId)))
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "user.role_update",
      metadata: {
        targetUserId: target.id,
        email: target.email,
        fromRole: target.role,
        toRole: patch.role,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update user role");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  if (userId === ctx.userId) {
    return jsonError(400, "You can't remove yourself");
  }

  const target = db
    .select({
      id: users.id,
      role: users.role,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.workspaceId, ctx.workspaceId)))
    .get();

  if (!target) return jsonError(404, "User not found");

  // Keep deletion deterministic regardless of FK cascade configuration.
  db.update(tasks)
    .set({ assigneeId: null, updatedAt: Date.now() })
    .where(eq(tasks.assigneeId, target.id))
    .run();

  db.update(auditLogs)
    .set({ userId: null })
    .where(and(eq(auditLogs.workspaceId, ctx.workspaceId), eq(auditLogs.userId, target.id)))
    .run();

  db.delete(users)
    .where(and(eq(users.id, target.id), eq(users.workspaceId, ctx.workspaceId)))
    .run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "user.remove",
    metadata: {
      removedUserId: target.id,
      email: target.email,
      role: target.role,
      name: target.name,
    },
  });

  return NextResponse.json({ ok: true });
}
