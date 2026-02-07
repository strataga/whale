import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { bots, botGuidelines } from "@/lib/db/schema";
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
    return jsonError(403, "Forbidden: cannot access onboarding for another bot");
  }

  const bot = db
    .select({ onboardedAt: bots.onboardedAt })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  if (bot.onboardedAt) {
    return NextResponse.json({ onboarded: true, guidelines: [] });
  }

  const guidelines = db
    .select()
    .from(botGuidelines)
    .where(eq(botGuidelines.workspaceId, botCtx.workspaceId))
    .orderBy(desc(botGuidelines.createdAt))
    .all();

  return NextResponse.json({ onboarded: false, guidelines });
}
