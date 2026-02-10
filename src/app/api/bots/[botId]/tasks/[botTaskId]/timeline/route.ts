export const runtime = "nodejs";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { botTaskEvents, botTasks, bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; botTaskId: string }> },
) {
  const { botId, botTaskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const botTask = db
    .select({ id: botTasks.id })
    .from(botTasks)
    .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
    .get();

  if (!botTask) return jsonError(404, "Bot task not found");

  const events = db
    .select()
    .from(botTaskEvents)
    .where(eq(botTaskEvents.botTaskId, botTaskId))
    .orderBy(desc(botTaskEvents.createdAt))
    .all();

  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      metadata: JSON.parse(e.metadata || "{}"),
    })),
  });
}
