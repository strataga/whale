import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { updateBotLabelsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bot = db
    .select({
      id: bots.id,
      environment: bots.environment,
      labels: bots.labels,
    })
    .from(bots)
    .where(eq(bots.id, botId))
    .get();
  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  return NextResponse.json({
    environment: bot.environment,
    labels: bot.labels ? JSON.parse(bot.labels) : [],
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = updateBotLabelsSchema.parse(body);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.environment !== undefined) updates.environment = data.environment;
    if (data.labels !== undefined)
      updates.labels = data.labels ? JSON.stringify(data.labels) : null;

    db.update(bots).set(updates).where(eq(bots.id, botId)).run();

    logAudit({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: "bot.update_labels",
      metadata: { botId, ...data },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
