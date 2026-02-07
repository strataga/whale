import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { bots, botTasks, projects, tasks } from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return jsonError(401, "Unauthorized");
  if (botCtx.botId !== botId) {
    return jsonError(403, "Forbidden: cannot read tasks for another bot");
  }

  // Treat task polling as an implicit heartbeat.
  db.update(bots)
    .set({ lastSeenAt: Date.now() })
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
    .run();

  const rows = db
    .select({
      botTaskId: botTasks.id,
      botTaskStatus: botTasks.status,
      outputSummary: botTasks.outputSummary,
      artifactLinks: botTasks.artifactLinks,
      startedAt: botTasks.startedAt,
      completedAt: botTasks.completedAt,
      createdAt: botTasks.createdAt,
      updatedAt: botTasks.updatedAt,

      taskId: tasks.id,
      projectId: tasks.projectId,
      milestoneId: tasks.milestoneId,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
    })
    .from(botTasks)
    .innerJoin(tasks, eq(botTasks.taskId, tasks.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(botTasks.botId, botId),
        eq(projects.workspaceId, botCtx.workspaceId),
        inArray(botTasks.status, ["pending", "running"]),
      ),
    )
    .orderBy(asc(botTasks.createdAt))
    .all();

  return NextResponse.json({ botTasks: rows });
}
