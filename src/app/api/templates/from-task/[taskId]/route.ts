import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { subtasks, taskDependencies, taskTemplates, tasks } from "@/lib/db/schema";
import { createTemplateFromTaskSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task) return jsonError(404, "Task not found");

  try {
    const body = await req.json();
    const data = createTemplateFromTaskSchema.parse(body);

    const taskSubtasks = db
      .select()
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId))
      .all();

    const subtaskTitles = taskSubtasks.map((s) => s.title);

    const deps = db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, taskId))
      .all();

    const tags: string[] = JSON.parse(task.tags || "[]");

    const id = crypto.randomUUID();

    db.insert(taskTemplates)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        titlePattern: task.title,
        description: task.description,
        priority: task.priority,
        tags: JSON.stringify(tags),
        subtaskTitles: JSON.stringify(subtaskTitles),
      })
      .run();

    return NextResponse.json({
      templateId: id,
      name: data.name,
      subtaskCount: subtaskTitles.length,
      dependencyCount: deps.length,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create template from task");
  }
}
