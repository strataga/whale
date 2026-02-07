import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { botHeartbeatSchema } from "@/lib/validators";
import { getBotAuthContext } from "@/lib/server/bot-auth";

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

    const now = Date.now();

    const res = db
      .update(bots)
      .set({ status: data.status, lastSeenAt: now, updatedAt: now })
      .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
      .run();

    if (!res.changes) return jsonError(404, "Bot not found");

    logAudit({
      workspaceId: botCtx.workspaceId,
      userId: null,
      action: "bot.heartbeat",
      metadata: { botId, status: data.status },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}

