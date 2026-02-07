import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { milestones, projects, tasks } from "@/lib/db/schema";
import { createTaskSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
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

  const rl = checkRateLimit(`tasks:create:${ctx.userId}`, { limit: 60, windowMs: 60_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

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
    const data = createTaskSchema.parse(body);

    const milestoneId = data.milestoneId ?? null;
    if (milestoneId) {
      const ms = db
        .select({ id: milestones.id })
        .from(milestones)
        .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, project.id)))
        .get();
      if (!ms) return jsonError(400, "Invalid milestoneId");
    }

    const maxPosRow = db
      .select({ max: sql<number>`max(${tasks.position})`.mapWith(Number) })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, project.id),
          milestoneId ? eq(tasks.milestoneId, milestoneId) : isNull(tasks.milestoneId),
        ),
      )
      .get();

    const position = (maxPosRow?.max ?? -1) + 1;

    const id = crypto.randomUUID();

    db.insert(tasks)
      .values({
        id,
        projectId: project.id,
        milestoneId,
        title: data.title,
        description: data.description ?? "",
        status: "todo",
        priority: data.priority ?? "medium",
        assigneeId: null,
        dueDate: data.dueDate ?? null,
        tags: JSON.stringify([]),
        position,
      })
      .run();

    const task = db.select().from(tasks).where(eq(tasks.id, id)).get();

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create task");
  }
}
