export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { projects, sprints, sprintTasks, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { addSprintTaskSchema } from "@/lib/validators";

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

  const rows = db
    .select({
      id: sprintTasks.id,
      taskId: sprintTasks.taskId,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskPriority: tasks.priority,
      createdAt: sprintTasks.createdAt,
    })
    .from(sprintTasks)
    .leftJoin(tasks, eq(sprintTasks.taskId, tasks.id))
    .where(eq(sprintTasks.sprintId, sprintId))
    .all();

  return NextResponse.json({ tasks: rows });
}

export async function POST(
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
    const data = addSprintTaskSchema.parse(body);

    const task = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, data.taskId), eq(tasks.projectId, projectId)))
      .get();

    if (!task) return jsonError(404, "Task not found in this project");

    const existing = db
      .select()
      .from(sprintTasks)
      .where(
        and(
          eq(sprintTasks.sprintId, sprintId),
          eq(sprintTasks.taskId, data.taskId),
        ),
      )
      .get();

    if (existing) return jsonError(409, "Task is already in this sprint");

    const id = crypto.randomUUID();

    db.insert(sprintTasks)
      .values({
        id,
        sprintId,
        taskId: data.taskId,
      })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "sprint_task.add",
      metadata: { sprintId, taskId: data.taskId, projectId },
    });

    return NextResponse.json({ id, taskId: data.taskId }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to add task to sprint");
  }
}

export async function DELETE(
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
    const data = addSprintTaskSchema.parse(body);

    const st = db
      .select()
      .from(sprintTasks)
      .where(
        and(
          eq(sprintTasks.sprintId, sprintId),
          eq(sprintTasks.taskId, data.taskId),
        ),
      )
      .get();

    if (!st) return jsonError(404, "Task not found in sprint");

    db.delete(sprintTasks).where(eq(sprintTasks.id, st.id)).run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "sprint_task.remove",
      metadata: { sprintId, taskId: data.taskId, projectId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to remove task from sprint");
  }
}
