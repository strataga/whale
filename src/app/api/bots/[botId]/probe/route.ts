import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botCommands, bots } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
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
  const id = crypto.randomUUID();
  db.insert(botCommands)
    .values({
      id,
      botId,
      command: "probe",
      payload: "{}",
      status: "pending",
      createdAt: Date.now(),
    })
    .run();
  return NextResponse.json({ id, command: "probe" }, { status: 201 });
}
