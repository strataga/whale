import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botSkills, bots } from "@/lib/db/schema";
import { createBotSkillSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const skills = db
    .select()
    .from(botSkills)
    .where(eq(botSkills.botId, botId))
    .all();
  return NextResponse.json(skills);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const body = await request.json();
    const data = createBotSkillSchema.parse(body);
    const id = crypto.randomUUID();
    const now = Date.now();
    db.insert(botSkills)
      .values({
        id,
        botId,
        skillName: data.skillName,
        version: data.version ?? "1.0.0",
        inputSchema: data.inputSchema ? JSON.stringify(data.inputSchema) : "{}",
        outputSchema: data.outputSchema ? JSON.stringify(data.outputSchema) : "{}",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return NextResponse.json({ id, skillName: data.skillName }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
