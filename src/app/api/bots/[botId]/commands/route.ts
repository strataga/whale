import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { botCommands } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { createBotCommandSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const botCtx = await getBotAuthContext(req);
  const humanCtx = botCtx ? null : await getAuthContext();
  if (!botCtx && !humanCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (botCtx && botCtx.botId !== botId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const commands = db.select().from(botCommands).where(and(eq(botCommands.botId, botId), eq(botCommands.status, "pending"))).all();
  return NextResponse.json({ commands });
}
export async function POST(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = createBotCommandSchema.parse(body);
    const id = crypto.randomUUID();
    db.insert(botCommands).values({ id, botId, command: data.command, payload: JSON.stringify(data.payload ?? {}), createdAt: Date.now() }).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "bot_command.create", metadata: { botId, command: data.command } });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
