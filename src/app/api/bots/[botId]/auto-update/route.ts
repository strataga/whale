import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

const autoUpdateSchema = z.object({ autoUpdate: z.boolean() }).strict();

/**
 * PATCH /api/bots/[botId]/auto-update — user-authenticated, admin-only
 * Toggle the auto-update setting for a bot.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = autoUpdateSchema.parse(body);

    const bot = db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
      .get();

    if (!bot) return jsonError(404, "Bot not found");

    const now = Date.now();
    db.update(bots)
      .set({ autoUpdate: data.autoUpdate ? 1 : 0, updatedAt: now })
      .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
      .run();

    return NextResponse.json({ ok: true, autoUpdate: data.autoUpdate });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}
