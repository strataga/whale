import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, taskDependencies, tasks } from "@/lib/db/schema";
import { addDependencySchema } from "@/lib/validators";
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

  const deps = db
    .select({
      id: taskDependencies.id,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
      dependsOnTitle: tasks.title,
      dependsOnStatus: tasks.status,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .where(eq(taskDependencies.taskId, taskId))
    .all();

  return NextResponse.json({ dependencies: deps });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
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

  try {
    const body = await req.json();
    const { dependsOnTaskId } = addDependencySchema.parse(body);

    if (dependsOnTaskId === taskId) {
      return jsonError(400, "A task cannot depend on itself");
    }

    const depTask = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, dependsOnTaskId), eq(tasks.projectId, project.id)))
      .get();
    if (!depTask) return jsonError(404, "Dependency task not found in this project");

    const existing = db
      .select({ id: taskDependencies.id })
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
        ),
      )
      .get();
    if (existing) return jsonError(409, "Dependency already exists");

    const depId = crypto.randomUUID();
    db.insert(taskDependencies)
      .values({ id: depId, taskId, dependsOnTaskId })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "task.dependency.add",
      metadata: { projectId: id, taskId, dependsOnTaskId },
    });

    return NextResponse.json({ id: depId, taskId, dependsOnTaskId }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to add dependency");
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const url = new URL(req.url);
  const dependsOnTaskId = url.searchParams.get("dependsOnTaskId");
  if (!dependsOnTaskId) return jsonError(400, "dependsOnTaskId query param required");

  const res = db
    .delete(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
      ),
    )
    .run();

  if (!res.changes) return jsonError(404, "Dependency not found");

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "task.dependency.remove",
    metadata: { projectId: id, taskId, dependsOnTaskId },
  });

  return NextResponse.json({ ok: true });
}
