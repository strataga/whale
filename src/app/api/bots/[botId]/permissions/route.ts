import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { updateBotPermissionsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bot = db
    .select({ allowedProjects: bots.allowedProjects, allowedTags: bots.allowedTags })
    .from(bots)
    .where(eq(bots.id, botId))
    .get();

  if (!bot)
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  return NextResponse.json({
    allowedProjects: bot.allowedProjects ? JSON.parse(bot.allowedProjects) : null,
    allowedTags: bot.allowedTags ? JSON.parse(bot.allowedTags) : null,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = updateBotPermissionsSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.allowedProjects !== undefined)
      updates.allowedProjects = data.allowedProjects
        ? JSON.stringify(data.allowedProjects)
        : null;
    if (data.allowedTags !== undefined)
      updates.allowedTags = data.allowedTags
        ? JSON.stringify(data.allowedTags)
        : null;

    db.update(bots).set(updates).where(eq(bots.id, botId)).run();

    logAudit({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: "bot.update_permissions",
      metadata: { botId, ...data },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 },
      );
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
