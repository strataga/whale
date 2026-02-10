import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, botTasks, taskHandoffs } from "@/lib/db/schema";
import { createHandoffSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return jsonError(404, "Bot not found");

  const handoffs = db
    .select()
    .from(taskHandoffs)
    .innerJoin(botTasks, eq(taskHandoffs.fromBotTaskId, botTasks.id))
    .where(eq(botTasks.botId, botId))
    .all();

  return NextResponse.json({ handoffs });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return jsonError(404, "Bot not found");

  try {
    const body = await req.json();
    const data = createHandoffSchema.parse(body);

    const fromTask = db
      .select({ id: botTasks.id })
      .from(botTasks)
      .where(eq(botTasks.id, data.fromBotTaskId))
      .get();
    if (!fromTask) return jsonError(404, "Source bot task not found");

    const toTask = db
      .select({ id: botTasks.id })
      .from(botTasks)
      .where(eq(botTasks.id, data.toBotTaskId))
      .get();
    if (!toTask) return jsonError(404, "Target bot task not found");

    const id = crypto.randomUUID();
    db.insert(taskHandoffs)
      .values({
        id,
        fromBotTaskId: data.fromBotTaskId,
        toBotTaskId: data.toBotTaskId,
        contextPayload: JSON.stringify(data.contextPayload ?? {}),
      })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "handoff.create",
      metadata: { botId, handoffId: id, from: data.fromBotTaskId, to: data.toBotTaskId },
    });

    return NextResponse.json({ id, ...data }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create handoff");
  }
}
