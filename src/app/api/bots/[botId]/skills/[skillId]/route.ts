import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botSkills, bots } from "@/lib/db/schema";
import { updateBotSkillSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ botId: string; skillId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, skillId } = await params;
  const bot = db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const skill = db
    .select()
    .from(botSkills)
    .where(and(eq(botSkills.id, skillId), eq(botSkills.botId, botId)))
    .get();
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  try {
    const body = await request.json();
    const data = updateBotSkillSchema.parse(body);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.version !== undefined) updates.version = data.version;
    if (data.inputSchema !== undefined) updates.inputSchema = JSON.stringify(data.inputSchema);
    if (data.outputSchema !== undefined) updates.outputSchema = JSON.stringify(data.outputSchema);
    if (data.successRate !== undefined) updates.successRate = data.successRate;
    db.update(botSkills)
      .set(updates)
      .where(eq(botSkills.id, skillId))
      .run();
    return NextResponse.json({ updated: true });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ botId: string; skillId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId, skillId } = await params;
  const bot = db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const result = db
    .delete(botSkills)
    .where(and(eq(botSkills.id, skillId), eq(botSkills.botId, botId)))
    .run();
  if (result.changes === 0)
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
