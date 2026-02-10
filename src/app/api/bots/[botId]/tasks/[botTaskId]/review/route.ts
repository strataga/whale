import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { botTasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { reviewBotTaskSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ botId: string; botTaskId: string }> }) {
  const { botId, botTaskId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = db.select().from(botTasks).where(and(eq(botTasks.id, botTaskId), eq(botTasks.botId, botId))).get();
  if (!existing) return NextResponse.json({ error: "Bot task not found" }, { status: 404 });
  try {
    const body = await req.json();
    const data = reviewBotTaskSchema.parse(body);
    const now = Date.now();
    db.update(botTasks).set({ reviewStatus: data.reviewStatus, reviewedBy: auth.userId, reviewedAt: now, updatedAt: now }).where(eq(botTasks.id, botTaskId)).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "bot_task.review", metadata: { botId, botTaskId, reviewStatus: data.reviewStatus } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
