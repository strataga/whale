import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { botHeartbeatSchema } from "@/lib/validators";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { transitionBotStatus } from "@/lib/server/bot-state-machine";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return jsonError(401, "Unauthorized");
  if (botCtx.botId !== botId) {
    return jsonError(403, "Forbidden: cannot heartbeat for another bot");
  }

  try {
    const body = await req.json();
    const data = botHeartbeatSchema.parse(body);

    // Fetch current bot status
    const bot = db
      .select({ status: bots.status })
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
      .get();

    if (!bot) return jsonError(404, "Bot not found");

    // Attempt state transition
    const result = transitionBotStatus(
      db,
      botId,
      botCtx.workspaceId,
      bot.status,
      data.status,
      data.statusReason,
    );

    if (!result.ok) {
      return jsonError(409, result.error, {
        allowedTransitions: result.allowedTransitions,
      });
    }

    // Persist version if provided
    if (data.version) {
      const now = Date.now();
      db.update(bots)
        .set({ version: data.version, updatedAt: now })
        .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}
