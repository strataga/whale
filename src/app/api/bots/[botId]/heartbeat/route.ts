import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { bots, botMetrics, botSessions } from "@/lib/db/schema";
import { botHeartbeatWithMetricsSchema } from "@/lib/validators";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { transitionBotStatus } from "@/lib/server/bot-state-machine";
import { checkRateLimit } from "@/lib/rate-limit";

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

  // #13 Rate-limit bot heartbeat (60 per minute per bot)
  const rl = checkRateLimit(`heartbeat:${botId}`, { limit: 60, windowMs: 60_000 });
  if (rl) {
    return NextResponse.json({ error: rl.error }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  try {
    const body = await req.json();
    const data = botHeartbeatWithMetricsSchema.parse(body);

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

    // #11 Store resource metrics if provided
    if (data.metrics) {
      db.insert(botMetrics)
        .values({
          id: crypto.randomUUID(),
          botId,
          cpuPercent: data.metrics.cpuPercent != null ? Math.round(data.metrics.cpuPercent) : null,
          memoryMb: data.metrics.memoryMb != null ? Math.round(data.metrics.memoryMb) : null,
          diskPercent: data.metrics.diskPercent != null ? Math.round(data.metrics.diskPercent) : null,
          customMetrics: JSON.stringify(data.metrics.custom ?? {}),
          createdAt: Date.now(),
        })
        .run();
    }

    // #46 Track bot sessions: if transitioning from offline → active, start a session
    if (bot.status === "offline" && data.status !== "offline") {
      db.insert(botSessions)
        .values({
          id: crypto.randomUUID(),
          botId,
          startedAt: Date.now(),
          createdAt: Date.now(),
        })
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
