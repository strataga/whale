import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { milestones, projects } from "@/lib/db/schema";
import { createMilestoneSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createMilestoneSchema.parse(body);

    const maxPosRow = db
      .select({ max: sql<number>`max(${milestones.position})`.mapWith(Number) })
      .from(milestones)
      .where(eq(milestones.projectId, project.id))
      .get();

    const position = (maxPosRow?.max ?? -1) + 1;

    const id = crypto.randomUUID();

    db.insert(milestones)
      .values({
        id,
        projectId: project.id,
        name: data.name,
        dueDate: data.dueDate ?? null,
        position,
      })
      .run();

    const milestone = db
      .select()
      .from(milestones)
      .where(eq(milestones.id, id))
      .get();

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create milestone");
  }
}

