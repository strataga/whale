import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { bots, botReleaseNotes } from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/**
 * GET /api/bots/[botId]/update-check — bot-authenticated
 * Check if a newer release is available for the bot.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return jsonError(401, "Unauthorized");
  if (botCtx.botId !== botId) {
    return jsonError(403, "Forbidden: cannot check updates for another bot");
  }

  const bot = db
    .select({
      version: bots.version,
      autoUpdate: bots.autoUpdate,
    })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const latestRelease = db
    .select({
      version: botReleaseNotes.version,
      releaseUrl: botReleaseNotes.releaseUrl,
      title: botReleaseNotes.title,
    })
    .from(botReleaseNotes)
    .where(eq(botReleaseNotes.workspaceId, botCtx.workspaceId))
    .orderBy(desc(botReleaseNotes.createdAt))
    .limit(1)
    .get();

  const currentVersion = bot.version ?? null;
  const latestVersion = latestRelease?.version ?? null;
  const updateAvailable =
    latestVersion !== null && latestVersion !== currentVersion;

  return NextResponse.json({
    updateAvailable,
    currentVersion,
    latestVersion,
    releaseUrl: latestRelease?.releaseUrl ?? null,
    autoUpdate: !!bot.autoUpdate,
    releaseTitle: latestRelease?.title ?? null,
  });
}
