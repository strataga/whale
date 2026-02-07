import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError, z } from "zod";

import { db } from "@/lib/db";
import { milestones, projects, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

const updateMilestoneSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    dueDate: z.number().int().positive().nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const { id: projectId, milestoneId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const existing = db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, project.id)))
    .get();

  if (!existing) return jsonError(404, "Milestone not found");

  try {
    const body = await req.json();
    const patch = updateMilestoneSchema.parse(body);

    if (!Object.keys(patch).length) {
      return jsonError(400, "No fields to update");
    }

    db.update(milestones)
      .set({ ...patch, updatedAt: Date.now() })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, project.id)))
      .run();

    const updated = db.select().from(milestones).where(eq(milestones.id, milestoneId)).get();

    return NextResponse.json({ milestone: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update milestone");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const { id: projectId, milestoneId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  // Move tasks from this milestone to backlog (null milestoneId)
  db.update(tasks)
    .set({ milestoneId: null, updatedAt: Date.now() })
    .where(and(eq(tasks.milestoneId, milestoneId), eq(tasks.projectId, project.id)))
    .run();

  const res = db
    .delete(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, project.id)))
    .run();

  if (!res.changes) return jsonError(404, "Milestone not found");

  return NextResponse.json({ ok: true });
}
