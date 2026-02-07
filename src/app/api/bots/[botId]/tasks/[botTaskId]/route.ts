import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, botTasks } from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";
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

    return NextResponse.json({ botTask: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}

