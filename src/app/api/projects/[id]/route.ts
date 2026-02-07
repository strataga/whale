import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { milestones, projects, tasks } from "@/lib/db/schema";
import { updateProjectSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const ms = db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, project.id))
    .orderBy(asc(milestones.position))
    .all();

  const ts = db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, project.id))
    .orderBy(asc(tasks.position))
    .all();

  return NextResponse.json({ project, milestones: ms, tasks: ts });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const patch = updateProjectSchema.parse(body);

    if (!Object.keys(patch).length) {
      return jsonError(400, "No fields to update");
    }

    const res = db
      .update(projects)
      .set({ ...patch, updatedAt: Date.now() })
      .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
      .run();

    if (!res.changes) return jsonError(404, "Project not found");

    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "project.update",
      metadata: { projectId: id, fields: Object.keys(patch) },
    });

    return NextResponse.json({ project });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update project");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const deleteRoleCheck = checkRole(ctx, "admin");
  if (deleteRoleCheck) return jsonError(deleteRoleCheck.status, deleteRoleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  // Keep deletion deterministic regardless of FK cascade configuration.
  db.delete(tasks).where(eq(tasks.projectId, project.id)).run();
  db.delete(milestones).where(eq(milestones.projectId, project.id)).run();
  db.delete(projects).where(eq(projects.id, project.id)).run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "project.delete",
    metadata: { projectId: id },
  });

  return NextResponse.json({ ok: true });
}

