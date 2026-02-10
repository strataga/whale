import { botTasks, auditLogs } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleDb = { insert: any; select: any; update: any };

export function maybeRetryBotTask(
  db: AnyDrizzleDb,
  failedTask: {
    id: string;
    botId: string;
    taskId: string;
    retryCount: number;
    maxRetries: number;
    timeoutMinutes: number | null;
    botGroupId: string | null;
    structuredSpec: string | null;
  },
  workspaceId: string,
): { retried: boolean; newTaskId?: string } {
  if (failedTask.maxRetries <= 0 || failedTask.retryCount >= failedTask.maxRetries) {
    return { retried: false };
  }

  const newRetryCount = failedTask.retryCount + 1;
  // Exponential backoff: 30s * 2^(retry-1)
  const backoffMs = 30_000 * Math.pow(2, newRetryCount - 1);
  const retryAfter = Date.now() + backoffMs;
  const newId = crypto.randomUUID();
  const now = Date.now();

  db.insert(botTasks)
    .values({
      id: newId,
      botId: failedTask.botId,
      taskId: failedTask.taskId,
      status: "pending",
      retryCount: newRetryCount,
      maxRetries: failedTask.maxRetries,
      retryAfter,
      timeoutMinutes: failedTask.timeoutMinutes,
      botGroupId: failedTask.botGroupId,
      structuredSpec: failedTask.structuredSpec,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      userId: null,
      action: "bot_task.retry",
      metadata: JSON.stringify({
        originalTaskId: failedTask.id,
        newTaskId: newId,
        retryCount: newRetryCount,
        retryAfter,
      }),
    })
    .run();

  return { retried: true, newTaskId: newId };
}
