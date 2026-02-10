import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, subtasks, tasks } from "@/lib/db/schema";
import { createSubtaskSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

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

  const items = db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.position))
    .all();

  return NextResponse.json({ subtasks: items });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`subtasks:create:${ctx.userId}`, { limit: 120, windowMs: 60_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

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

  try {
    const body = await req.json();
    const data = createSubtaskSchema.parse(body);

    const maxPosRow = db
      .select({ max: sql<number>`max(${subtasks.position})`.mapWith(Number) })
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId))
      .get();

    const position = (maxPosRow?.max ?? -1) + 1;
    const subId = crypto.randomUUID();

    db.insert(subtasks)
      .values({ id: subId, taskId, title: data.title, position })
      .run();

    const created = db.select().from(subtasks).where(eq(subtasks.id, subId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "subtask.create",
      metadata: { projectId: id, taskId, subtaskId: subId },
    });

    return NextResponse.json({ subtask: created }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create subtask");
  }
}
