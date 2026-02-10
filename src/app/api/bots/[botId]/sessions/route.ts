export const runtime = "nodejs";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { botSessions, bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const sessions = db
    .select()
    .from(botSessions)
    .where(eq(botSessions.botId, botId))
    .orderBy(desc(botSessions.startedAt))
    .limit(50)
    .all();

  return NextResponse.json({ sessions });
}
