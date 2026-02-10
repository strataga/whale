export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { projects, sprints } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createSprintSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
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

  const rows = db
    .select()
    .from(sprints)
    .where(eq(sprints.projectId, projectId))
    .all();

  return NextResponse.json({ sprints: rows });
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

  try {
    const body = await req.json();
    const data = createSprintSchema.parse(body);

    if (data.endDate <= data.startDate) {
      return jsonError(400, "endDate must be after startDate");
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(sprints)
      .values({
        id,
        projectId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: "planning",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const sprint = db.select().from(sprints).where(eq(sprints.id, id)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "sprint.create",
      metadata: { sprintId: id, projectId },
    });

    return NextResponse.json({ sprint }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create sprint");
  }
}
