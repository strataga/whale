export const runtime = "nodejs";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { botTaskFeedback, botTasks, bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createBotTaskFeedbackSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; botTaskId: string }> },
) {
  const { botId, botTaskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const botTask = db
    .select({ id: botTasks.id })
    .from(botTasks)
    .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
    .get();

  if (!botTask) return jsonError(404, "Bot task not found");

  const feedbacks = db
    .select()
    .from(botTaskFeedback)
    .where(eq(botTaskFeedback.botTaskId, botTaskId))
    .orderBy(desc(botTaskFeedback.createdAt))
    .all();

  return NextResponse.json({ feedback: feedbacks });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; botTaskId: string }> },
) {
  const { botId, botTaskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const botTask = db
    .select({ id: botTasks.id })
    .from(botTasks)
    .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
    .get();

  if (!botTask) return jsonError(404, "Bot task not found");

  try {
    const body = await req.json();
    const data = createBotTaskFeedbackSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(botTaskFeedback)
      .values({
        id,
        botTaskId,
        reviewerId: ctx.userId,
        rating: data.rating,
        feedback: data.feedback ?? "",
      })
      .run();

    const entry = db
      .select()
      .from(botTaskFeedback)
      .where(eq(botTaskFeedback.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_task_feedback.create",
      metadata: { botTaskId, botId, rating: data.rating },
    });

    return NextResponse.json({ feedback: entry }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create feedback");
  }
}
