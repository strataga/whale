export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { botGroups } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { updateBotGroupSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const group = db
    .select()
    .from(botGroups)
    .where(and(eq(botGroups.id, groupId), eq(botGroups.workspaceId, ctx.workspaceId)))
    .get();

  if (!group) return jsonError(404, "Bot group not found");

  return NextResponse.json({ group });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const group = db
    .select()
    .from(botGroups)
    .where(and(eq(botGroups.id, groupId), eq(botGroups.workspaceId, ctx.workspaceId)))
    .get();

  if (!group) return jsonError(404, "Bot group not found");

  try {
    const body = await req.json();
    const data = updateBotGroupSchema.parse(body);

    db.update(botGroups)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(botGroups.id, groupId))
      .run();

    const updated = db.select().from(botGroups).where(eq(botGroups.id, groupId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_group.update",
      metadata: { groupId },
    });

    return NextResponse.json({ group: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update bot group");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const group = db
    .select()
    .from(botGroups)
    .where(and(eq(botGroups.id, groupId), eq(botGroups.workspaceId, ctx.workspaceId)))
    .get();

  if (!group) return jsonError(404, "Bot group not found");

  db.delete(botGroups).where(eq(botGroups.id, groupId)).run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "bot_group.delete",
    metadata: { groupId },
  });

  return NextResponse.json({ success: true });
}
