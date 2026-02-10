import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { taskTemplates } from "@/lib/db/schema";
import { updateTaskTemplateSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const template = db
    .select()
    .from(taskTemplates)
    .where(
      and(eq(taskTemplates.id, templateId), eq(taskTemplates.workspaceId, ctx.workspaceId)),
    )
    .get();
  if (!template) return jsonError(404, "Template not found");

  try {
    const body = await req.json();
    const patch = updateTaskTemplateSchema.parse(body);

    const next: Record<string, unknown> = {};
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.titlePattern !== undefined) next.titlePattern = patch.titlePattern;
    if (patch.description !== undefined) next.description = patch.description;
    if (patch.priority !== undefined) next.priority = patch.priority;
    if (patch.tags !== undefined) next.tags = JSON.stringify(patch.tags);
    if (patch.subtaskTitles !== undefined) next.subtaskTitles = JSON.stringify(patch.subtaskTitles);

    if (!Object.keys(next).length) {
      return jsonError(400, "No fields to update");
    }

    next.updatedAt = Date.now();
    db.update(taskTemplates).set(next).where(eq(taskTemplates.id, templateId)).run();

    const updated = db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "template.update",
      metadata: { templateId, fields: Object.keys(patch) },
    });

    return NextResponse.json({ template: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update template");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const res = db
    .delete(taskTemplates)
    .where(
      and(eq(taskTemplates.id, templateId), eq(taskTemplates.workspaceId, ctx.workspaceId)),
    )
    .run();

  if (!res.changes) return jsonError(404, "Template not found");

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "template.delete",
    metadata: { templateId },
  });

  return NextResponse.json({ ok: true });
}
