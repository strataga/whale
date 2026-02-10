export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";

const DEFAULT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bot = db.select().from(bots).where(eq(bots.id, botId)).get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  if (bot.workspaceId !== auth.workspaceId) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const newToken = randomBytes(32).toString("hex");
  const newPrefix = newToken.slice(0, 8);
  const newHash = await hash(newToken, 10);
  const now = Date.now();

  db.update(bots)
    .set({
      previousTokenHash: bot.tokenHash,
      tokenHash: newHash,
      tokenPrefix: newPrefix,
      tokenRotatedAt: now,
      tokenGracePeriodMs: DEFAULT_GRACE_PERIOD_MS,
      updatedAt: now,
    })
    .where(eq(bots.id, botId))
    .run();

  logAudit({
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    action: "bot.rotate_token",
    metadata: { botId },
  });

  return NextResponse.json({
    token: newToken,
    prefix: newPrefix,
    gracePeriodMs: DEFAULT_GRACE_PERIOD_MS,
  });
}
