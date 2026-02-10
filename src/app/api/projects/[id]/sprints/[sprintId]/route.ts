export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { projects, sprints } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { updateSprintSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sprintId: string }> },
) {
  const { id: projectId, sprintId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const sprint = db
    .select()
    .from(sprints)
    .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
    .get();

  if (!sprint) return jsonError(404, "Sprint not found");

  return NextResponse.json({ sprint });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; sprintId: string }> },
) {
  const { id: projectId, sprintId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const sprint = db
    .select()
    .from(sprints)
    .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
    .get();

  if (!sprint) return jsonError(404, "Sprint not found");

  try {
    const body = await req.json();
    const data = updateSprintSchema.parse(body);

    db.update(sprints)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(sprints.id, sprintId))
      .run();

    const updated = db.select().from(sprints).where(eq(sprints.id, sprintId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "sprint.update",
      metadata: { sprintId, projectId },
    });

    return NextResponse.json({ sprint: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update sprint");
  }
}
