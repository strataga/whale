export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { botGroupMembers, botGroups, bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { botGroupMemberSchema } from "@/lib/validators";

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

  const members = db
    .select({
      id: botGroupMembers.id,
      botId: botGroupMembers.botId,
      botName: bots.name,
      createdAt: botGroupMembers.createdAt,
    })
    .from(botGroupMembers)
    .leftJoin(bots, eq(botGroupMembers.botId, bots.id))
    .where(eq(botGroupMembers.botGroupId, groupId))
    .all();

  return NextResponse.json({ members });
}

export async function POST(
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
    const data = botGroupMemberSchema.parse(body);

    const bot = db
      .select()
      .from(bots)
      .where(and(eq(bots.id, data.botId), eq(bots.workspaceId, ctx.workspaceId)))
      .get();

    if (!bot) return jsonError(404, "Bot not found");

    const existing = db
      .select()
      .from(botGroupMembers)
      .where(
        and(
          eq(botGroupMembers.botGroupId, groupId),
          eq(botGroupMembers.botId, data.botId),
        ),
      )
      .get();

    if (existing) return jsonError(409, "Bot is already a member of this group");

    const id = crypto.randomUUID();

    db.insert(botGroupMembers)
      .values({
        id,
        botGroupId: groupId,
        botId: data.botId,
      })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_group_member.add",
      metadata: { groupId, botId: data.botId },
    });

    return NextResponse.json({ id, botId: data.botId }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to add member");
  }
}

export async function DELETE(
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
    const data = botGroupMemberSchema.parse(body);

    const member = db
      .select()
      .from(botGroupMembers)
      .where(
        and(
          eq(botGroupMembers.botGroupId, groupId),
          eq(botGroupMembers.botId, data.botId),
        ),
      )
      .get();

    if (!member) return jsonError(404, "Member not found in group");

    db.delete(botGroupMembers).where(eq(botGroupMembers.id, member.id)).run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_group_member.remove",
      metadata: { groupId, botId: data.botId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to remove member");
  }
}
