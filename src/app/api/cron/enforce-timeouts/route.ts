import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { botTasks, bots, auditLogs } from "@/lib/db/schema";
import { authorizeCronRequest } from "@/lib/server/cron-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authorized = await authorizeCronRequest(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = Date.now();

  // Find running tasks with a timeout that have exceeded it
  const allRunning = db
    .select()
    .from(botTasks)
    .where(
      and(
        eq(botTasks.status, "running"),
        isNotNull(botTasks.timeoutMinutes),
        isNotNull(botTasks.startedAt),
      ),
    )
    .all();

  const timedOut = allRunning.filter((t) => {
    if (!t.startedAt || !t.timeoutMinutes) return false;
    return now - t.startedAt > t.timeoutMinutes * 60_000;
  });

  for (const task of timedOut) {
    db.update(botTasks)
      .set({ status: "failed", completedAt: now, updatedAt: now })
      .where(eq(botTasks.id, task.id))
      .run();

    db.update(bots)
      .set({ currentBotTaskId: null, updatedAt: now })
      .where(and(eq(bots.id, task.botId), eq(bots.currentBotTaskId, task.id)))
      .run();

    // Get bot's workspaceId for audit
    const bot = db
      .select({ workspaceId: bots.workspaceId })
      .from(bots)
      .where(eq(bots.id, task.botId))
      .get();

    if (bot) {
      db.insert(auditLogs)
        .values({
          id: crypto.randomUUID(),
          workspaceId: bot.workspaceId,
          userId: null,
          action: "bot_task.timeout",
          metadata: JSON.stringify({
            botId: task.botId,
            botTaskId: task.id,
            timeoutMinutes: task.timeoutMinutes,
          }),
        })
        .run();
    }
  }

  return NextResponse.json({
    timedOutCount: timedOut.length,
    taskIds: timedOut.map((t) => t.id),
  });
}
