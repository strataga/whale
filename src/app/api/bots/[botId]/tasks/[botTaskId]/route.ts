import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, botTasks, botTaskEvents, tasks } from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { maybeRetryBotTask } from "@/lib/server/bot-task-retry";
import { settleX402TransactionsForTask } from "@/lib/server/x402-task-settlement";
import { updateBotTaskSchema } from "@/lib/validators";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; botTaskId: string }> },
) {
  const { botId, botTaskId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return jsonError(401, "Unauthorized");
  if (botCtx.botId !== botId) {
    return jsonError(403, "Forbidden: cannot update tasks for another bot");
  }

  const existing = db
    .select()
    .from(botTasks)
    .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
    .get();

  if (!existing) return jsonError(404, "Bot task not found");

  try {
    const body = await req.json();
    const patch = updateBotTaskSchema.parse(body);

    if (!Object.keys(patch).length) {
      return jsonError(400, "No fields to update");
    }

    const now = Date.now();
    const next: Record<string, unknown> = {};

    if (patch.status !== undefined) {
      next.status = patch.status;

      if (patch.status === "running" && existing.startedAt == null) {
        next.startedAt = now;
      }

      if (
        (patch.status === "completed" || patch.status === "failed") &&
        existing.completedAt == null
      ) {
        next.completedAt = now;
      }
    }

    if (patch.outputSummary !== undefined) {
      next.outputSummary = patch.outputSummary;
    }

    if (patch.artifactLinks !== undefined) {
      next.artifactLinks = JSON.stringify(patch.artifactLinks);
    }

    if (patch.outputData !== undefined) {
      next.outputData = JSON.stringify(patch.outputData);
    }

    if (patch.queuePosition !== undefined) {
      next.queuePosition = patch.queuePosition;
    }

    if (!Object.keys(next).length) {
      return jsonError(400, "No fields to update");
    }

    next.updatedAt = now;

    db.update(botTasks)
      .set(next)
      .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
      .run();

    // Update bot's currentBotTaskId based on task status
    if (patch.status === "running") {
      db.update(bots)
        .set({ currentBotTaskId: botTaskId, updatedAt: now })
        .where(eq(bots.id, botId))
        .run();
    } else if (patch.status === "completed" || patch.status === "failed") {
      db.update(bots)
        .set({ currentBotTaskId: null, updatedAt: now })
        .where(eq(bots.id, botId))
        .run();
    }

    // #39 Record timeline event for status changes
    if (patch.status !== undefined) {
      db.insert(botTaskEvents)
        .values({
          id: crypto.randomUUID(),
          botTaskId,
          event: `status.${patch.status}`,
          metadata: JSON.stringify({ from: existing.status }),
          createdAt: now,
        })
        .run();
    }

    // #2 Auto-retry on failure
    let retryResult: { retried: boolean; newTaskId?: string } | null = null;
    if (patch.status === "failed" && existing.maxRetries > 0) {
      retryResult = maybeRetryBotTask(
        db,
        {
          id: botTaskId,
          botId,
          taskId: existing.taskId,
          retryCount: existing.retryCount,
          maxRetries: existing.maxRetries,
          timeoutMinutes: existing.timeoutMinutes,
          botGroupId: existing.botGroupId,
          structuredSpec: existing.structuredSpec,
        },
        botCtx.workspaceId,
      );
    }

    // Trigger handoffs on completion (#13)
    if (patch.status === "completed") {
      const { taskHandoffs } = await import("@/lib/db/schema");
      const handoffs = db
        .select()
        .from(taskHandoffs)
        .where(eq(taskHandoffs.fromBotTaskId, botTaskId))
        .all();

      for (const h of handoffs) {
        const payload = JSON.parse(h.contextPayload || "{}");
        payload._sourceOutput = patch.outputSummary ?? "";
        db.update(taskHandoffs)
          .set({ contextPayload: JSON.stringify(payload) })
          .where(eq(taskHandoffs.id, h.id))
          .run();
      }
    }

    // If bot work completed successfully, reflect into the parent task when no approval is required.
    // Also settle any x402 payments linked to the task.
    if (patch.status === "completed") {
      const parent = db
        .select({ status: tasks.status, requiresApproval: tasks.requiresApproval })
        .from(tasks)
        .where(eq(tasks.id, existing.taskId))
        .get();

      if (parent && parent.status !== "done" && parent.requiresApproval === 0) {
        db.update(tasks)
          .set({ status: "done", updatedAt: now })
          .where(eq(tasks.id, existing.taskId))
          .run();
      }

      // Settle payments once the task is effectively "done" or doesn't require review gates.
      if (!parent || parent.requiresApproval === 0 || parent.status === "done") {
        const settled = settleX402TransactionsForTask(db, botCtx.workspaceId, existing.taskId);
        if (settled > 0) {
          logAudit({
            workspaceId: botCtx.workspaceId,
            userId: null,
            action: "x402_transaction.settled",
            metadata: { taskId: existing.taskId, count: settled, botId, botTaskId },
          });
        }
      }
    }

    const updated = db
      .select()
      .from(botTasks)
      .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
      .get();

    logAudit({
      workspaceId: botCtx.workspaceId,
      userId: null,
      action: "bot_task.update",
      metadata: {
        botId,
        botTaskId,
        fields: Object.keys(next).filter((k) => k !== "updatedAt"),
        status: patch.status,
      },
    });

    return NextResponse.json({
      botTask: updated,
      ...(retryResult?.retried ? { retry: { newTaskId: retryResult.newTaskId } } : {}),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}
