import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { botCommands } from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { ackBotCommandSchema } from "@/lib/validators";
export const runtime = "nodejs";
export async function PATCH(req: Request, { params }: { params: Promise<{ botId: string; commandId: string }> }) {
  const { botId, commandId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (botCtx.botId !== botId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const { status } = ackBotCommandSchema.parse(body);
    db.update(botCommands).set({ status, acknowledgedAt: Date.now() }).where(and(eq(botCommands.id, commandId), eq(botCommands.botId, botId))).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
