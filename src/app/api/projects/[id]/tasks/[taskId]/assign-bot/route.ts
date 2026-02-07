import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, botTasks, projects, tasks } from "@/lib/db/schema";
import { assignBotSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id: projectId, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
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
    const data = assignBotSchema.parse(body);

    const bot = db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, data.botId), eq(bots.workspaceId, ctx.workspaceId)))
      .get();

    if (!bot) return jsonError(404, "Bot not found");

    const botTaskId = crypto.randomUUID();

    db.insert(botTasks)
      .values({
        id: botTaskId,
        botId: bot.id,
        taskId: task.id,
        status: "pending",
        outputSummary: "",
        artifactLinks: "[]",
        startedAt: null,
        completedAt: null,
      })
      .run();

    const botTask = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, botTaskId))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_task.assign",
      metadata: { projectId, taskId, botId: bot.id, botTaskId },
    });

    return NextResponse.json({ botTask }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}

