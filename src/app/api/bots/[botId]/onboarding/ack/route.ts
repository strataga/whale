import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, botGuidelines } from "@/lib/db/schema";
import { ackOnboardingSchema } from "@/lib/validators";
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
    return jsonError(403, "Forbidden: cannot acknowledge onboarding for another bot");
  }

  try {
    const body = await req.json();
    ackOnboardingSchema.parse(body);

    // Check that guidelines exist for this workspace
    const countResult = db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(botGuidelines)
      .where(eq(botGuidelines.workspaceId, botCtx.workspaceId))
      .get();

    const guidelineCount = countResult?.count ?? 0;
    if (guidelineCount === 0) {
      return jsonError(400, "No guidelines to acknowledge");
    }

    const onboardedAt = Date.now();
    db.update(bots)
      .set({ onboardedAt, updatedAt: onboardedAt })
      .where(and(eq(bots.id, botId), eq(bots.workspaceId, botCtx.workspaceId)))
      .run();

    logAudit({
      workspaceId: botCtx.workspaceId,
      action: "bot.onboarding_ack",
      metadata: { botId, guidelineCount },
    });

    return NextResponse.json({ ok: true, onboardedAt });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}
