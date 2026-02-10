import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botMemory, bots } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
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
  const memories = db
    .select()
    .from(botMemory)
    .where(eq(botMemory.botId, botId))
    .all();
  return NextResponse.json(memories);
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
  const body = await request.json();
  const { createBotMemorySchema } = await import("@/lib/validators");
  const parsed = createBotMemorySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const id = crypto.randomUUID();
  const now = Date.now();
  db.insert(botMemory)
    .values({
      id,
      botId,
      key: parsed.data.key,
      value: parsed.data.value,
      scope: parsed.data.scope ?? "task",
      expiresAt: parsed.data.expiresAt ?? null,
      createdAt: now,
    })
    .run();
  return NextResponse.json({ id, ...parsed.data }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key)
    return NextResponse.json({ error: "key parameter required" }, { status: 400 });
  db.delete(botMemory)
    .where(and(eq(botMemory.botId, botId), eq(botMemory.key, key)))
    .run();
  return NextResponse.json({ deleted: true });
}
