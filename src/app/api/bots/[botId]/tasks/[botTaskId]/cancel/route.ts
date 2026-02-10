import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { bots, botTasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { cancelBotTaskSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; botTaskId: string }> },
) {
  const { botId, botTaskId } = await params;
  const auth = await getAuthContext();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = db
    .select()
    .from(botTasks)
    .where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId)))
    .get();

  if (!existing)
    return NextResponse.json({ error: "Bot task not found" }, { status: 404 });

  if (
    existing.status === "completed" ||
    existing.status === "failed" ||
    existing.status === "cancelled"
  ) {
    return NextResponse.json(
      { error: "Cannot cancel a task that is already " + existing.status },
      { status: 409 },
    );
  }

  let reason: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = cancelBotTaskSchema.parse(body);
    reason = parsed.reason;
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 },
      );
  }

  const now = Date.now();

  db.update(botTasks)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: auth.userId,
      updatedAt: now,
    })
    .where(eq(botTasks.id, botTaskId))
    .run();

  // Clear currentBotTaskId if this was the active task
  db.update(bots)
    .set({ currentBotTaskId: null, updatedAt: now })
    .where(and(eq(bots.id, botId), eq(bots.currentBotTaskId, botTaskId)))
    .run();

  logAudit({
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    action: "bot_task.cancel",
    metadata: { botId, botTaskId, reason },
  });

  return NextResponse.json({ ok: true, cancelledAt: now });
}
