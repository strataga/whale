import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const decompositionSchema = z.object({
  subtasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      estimatedMinutes: z.number().optional(),
    }),
  ),
  reasoning: z.string(),
});

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const body = await req.json();
  const { taskId, projectId } = body as { taskId?: string; projectId?: string };

  if (!taskId || !projectId) {
    return jsonError(400, "taskId and projectId are required");
  }

  const project = db
    .select({ id: projects.id, name: projects.name, description: projects.description })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();
  if (!project) return jsonError(404, "Project not found");

  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
    .get();
  if (!task) return jsonError(404, "Task not found");

  try {
    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: decompositionSchema,
      prompt: `You are a project planning assistant. Break down the following task into actionable subtasks.

Project: ${project.name}
Project Description: ${project.description}

Task: ${task.title}
Task Description: ${task.description}
Priority: ${task.priority}

Break this task into 3-7 concrete, actionable subtasks. Each subtask should be small enough to complete in one sitting. Estimate minutes for each if possible.`,
    });

    return NextResponse.json({ decomposition: object });
  } catch {
    return jsonError(500, "AI decomposition failed. Check AI provider configuration.");
  }
}
