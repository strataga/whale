import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  bots,
  botTasks,
  botGuidelines,
  botReleaseNotes,
  botCommands,
} from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (botCtx.botId !== botId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = db.select().from(bots).where(eq(bots.id, botId)).get();
  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const pendingTasks = db
    .select()
    .from(botTasks)
    .where(and(eq(botTasks.botId, botId), eq(botTasks.status, "pending")))
    .all().length;

  const runningTasks = db
    .select()
    .from(botTasks)
    .where(and(eq(botTasks.botId, botId), eq(botTasks.status, "running")))
    .all().length;

  const guidelineCount = db
    .select()
    .from(botGuidelines)
    .where(eq(botGuidelines.workspaceId, botCtx.workspaceId))
    .all().length;

  const latestRelease = db
    .select()
    .from(botReleaseNotes)
    .where(eq(botReleaseNotes.workspaceId, botCtx.workspaceId))
    .all();

  const hasUpdate =
    bot.version && latestRelease.length > 0
      ? latestRelease[latestRelease.length - 1].version !== bot.version
      : false;

  const pendingCommands = db
    .select()
    .from(botCommands)
    .where(
      and(eq(botCommands.botId, botId), eq(botCommands.status, "pending")),
    )
    .all().length;

  return NextResponse.json({
    health: {
      status: bot.status,
      pendingTaskCount: pendingTasks,
      runningTaskCount: runningTasks,
      guidelineCount,
      hasUpdate,
      pendingCommandCount: pendingCommands,
      maxConcurrentTasks: bot.maxConcurrentTasks,
      atCapacity: runningTasks >= bot.maxConcurrentTasks,
    },
  });
}
