import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { milestones, projects, tasks } from "@/lib/db/schema";
import { updateTaskSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const patchRoleCheck = checkRole(ctx, "member");
  if (patchRoleCheck) return jsonError(patchRoleCheck.status, patchRoleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
    .get();

  if (!task) return jsonError(404, "Task not found");

  try {
    const body = await req.json();
    const patch = updateTaskSchema.parse(body);

    const next: Record<string, unknown> = { ...patch };

    if (Object.prototype.hasOwnProperty.call(patch, "milestoneId")) {
      const milestoneId = patch.milestoneId ?? null;
      if (milestoneId) {
        const ms = db
          .select({ id: milestones.id })
          .from(milestones)
          .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, project.id)))
          .get();
        if (!ms) return jsonError(400, "Invalid milestoneId");
      }
      next.milestoneId = milestoneId;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
      next.tags = JSON.stringify(patch.tags ?? []);
    }

    if (!Object.keys(next).length) {
      return jsonError(400, "No fields to update");
    }

    next.updatedAt = Date.now();

    db.update(tasks)
      .set(next)
      .where(and(eq(tasks.id, task.id), eq(tasks.projectId, project.id)))
      .run();

    const updated = db.select().from(tasks).where(eq(tasks.id, task.id)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "task.update",
      metadata: { projectId: id, taskId, fields: Object.keys(patch) },
    });

    return NextResponse.json({ task: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update task");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const deleteRoleCheck = checkRole(ctx, "member");
  if (deleteRoleCheck) return jsonError(deleteRoleCheck.status, deleteRoleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const res = db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
    .run();

  if (!res.changes) return jsonError(404, "Task not found");

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "task.delete",
    metadata: { projectId: id, taskId },
  });

  return NextResponse.json({ ok: true });
}

