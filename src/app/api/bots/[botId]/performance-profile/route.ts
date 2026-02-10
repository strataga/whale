import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botTasks, bots } from "@/lib/db/schema";

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
  const allTasks = db
    .select()
    .from(botTasks)
    .where(eq(botTasks.botId, botId))
    .all();
  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.status === "completed").length;
  const failed = allTasks.filter((t) => t.status === "failed").length;
  const pending = allTasks.filter((t) => t.status === "pending").length;
  const running = allTasks.filter((t) => t.status === "running").length;
  // Compute average duration for completed tasks with both startedAt and completedAt
  const durationsMs = allTasks
    .filter((t) => t.status === "completed" && t.startedAt && t.completedAt)
    .map((t) => t.completedAt! - t.startedAt!);
  const avgDurationMs =
    durationsMs.length > 0
      ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
      : null;
  const successRate =
    total > 0 ? Math.round((completed / total) * 10000) / 100 : null;
  return NextResponse.json({
    botId,
    total,
    completed,
    failed,
    pending,
    running,
    avgDurationMs,
    successRate,
  });
}
