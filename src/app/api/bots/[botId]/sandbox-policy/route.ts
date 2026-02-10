import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { updateSandboxPolicySchema } from "@/lib/validators";

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
  const policy = bot.sandboxPolicy ? JSON.parse(bot.sandboxPolicy) : null;
  return NextResponse.json({ botId, sandboxPolicy: policy });
}

export async function PUT(
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
    const data = updateSandboxPolicySchema.parse(body);
    db.update(bots)
      .set({
        sandboxPolicy: JSON.stringify(data),
        updatedAt: Date.now(),
      })
      .where(eq(bots.id, botId))
      .run();
    return NextResponse.json({ botId, sandboxPolicy: data });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
