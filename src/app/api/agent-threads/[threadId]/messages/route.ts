import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { agentMessages, agentThreads } from "@/lib/db/schema";
import { createAgentMessageSchema } from "@/lib/validators";
import { getAuthContext } from "@/lib/server/auth-context";
import { getBotAuthContext } from "@/lib/server/bot-auth";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;

  const thread = db
    .select({ id: agentThreads.id })
    .from(agentThreads)
    .where(eq(agentThreads.id, threadId))
    .get();

  if (!thread) return jsonError(404, "Thread not found");

  const messages = db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.threadId, threadId))
    .all();

  return NextResponse.json({ messages });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;

  // Try bot auth first, fall back to user auth
  const botCtx = await getBotAuthContext(req);
  const userCtx = botCtx ? null : await getAuthContext();

  if (!botCtx && !userCtx) return jsonError(401, "Unauthorized");

  const thread = db
    .select({ id: agentThreads.id })
    .from(agentThreads)
    .where(eq(agentThreads.id, threadId))
    .get();

  if (!thread) return jsonError(404, "Thread not found");

  try {
    const body = await req.json();
    const data = createAgentMessageSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(agentMessages)
      .values({
        id,
        threadId,
        senderBotId: botCtx?.botId ?? null,
        content: data.content,
      })
      .run();

    const message = db.select().from(agentMessages).where(eq(agentMessages.id, id)).get();

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create message");
  }
}
