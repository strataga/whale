import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, subtasks, tasks } from "@/lib/db/schema";
import { updateSubtaskSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> },
) {
  const { id, taskId, subtaskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();
  if (!project) return jsonError(404, "Project not found");

  const task = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
    .get();
  if (!task) return jsonError(404, "Task not found");

  const subtask = db
    .select()
    .from(subtasks)
    .where(and(eq(subtasks.id, subtaskId), eq(subtasks.taskId, taskId)))
    .get();
  if (!subtask) return jsonError(404, "Subtask not found");

  try {
    const body = await req.json();
    const patch = updateSubtaskSchema.parse(body);

    const next: Record<string, unknown> = {};
    if (patch.title !== undefined) next.title = patch.title;
    if (patch.done !== undefined) next.done = patch.done ? 1 : 0;
    if (patch.position !== undefined) next.position = patch.position;

    if (!Object.keys(next).length) {
      return jsonError(400, "No fields to update");
    }

    db.update(subtasks).set(next).where(eq(subtasks.id, subtaskId)).run();

    const updated = db.select().from(subtasks).where(eq(subtasks.id, subtaskId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "subtask.update",
      metadata: { projectId: id, taskId, subtaskId, fields: Object.keys(patch) },
    });

    return NextResponse.json({ subtask: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update subtask");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> },
) {
  const { id, taskId, subtaskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const res = db
    .delete(subtasks)
    .where(and(eq(subtasks.id, subtaskId), eq(subtasks.taskId, taskId)))
    .run();

  if (!res.changes) return jsonError(404, "Subtask not found");

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "subtask.delete",
    metadata: { projectId: id, taskId, subtaskId },
  });

  return NextResponse.json({ ok: true });
}
