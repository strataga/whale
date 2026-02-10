import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { bots, botTasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const advisorSchema = z.object({
  insights: z.array(
    z.object({
      botId: z.string(),
      botName: z.string(),
      category: z.enum(["performance", "scaling", "attention", "optimization"]),
      severity: z.enum(["info", "warning", "critical"]),
      message: z.string(),
      recommendation: z.string(),
    }),
  ),
  fleetSummary: z.string(),
});

/**
 * #24 AI Bot Performance Advisor — analyzes bot history and recommends improvements.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const body = await req.json().catch(() => ({}));
  const { botId } = body as { botId?: string };

  const allBots = db
    .select()
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .all();

  const targetBots = botId ? allBots.filter((b) => b.id === botId) : allBots;
  if (targetBots.length === 0) {
    return jsonError(404, botId ? "Bot not found" : "No bots in workspace");
  }

  const botStats = targetBots.map((bot) => {
    const recentTasks = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.botId, bot.id))
      .orderBy(desc(botTasks.createdAt))
      .limit(50)
      .all();

    const completed = recentTasks.filter((t) => t.status === "completed").length;
    const failed = recentTasks.filter((t) => t.status === "failed").length;
    const avgDuration = recentTasks
      .filter((t) => t.startedAt && t.completedAt)
      .map((t) => t.completedAt! - t.startedAt!)
      .reduce((a, b, _i, arr) => a + b / arr.length, 0);

    return {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      capabilities: JSON.parse(bot.capabilities),
      totalRecent: recentTasks.length,
      completed,
      failed,
      pending: recentTasks.filter((t) => t.status === "pending").length,
      avgDurationMs: Math.round(avgDuration),
      failureRate: recentTasks.length > 0 ? (failed / recentTasks.length * 100).toFixed(1) + "%" : "N/A",
    };
  });

  try {
    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: advisorSchema,
      prompt: `You are a bot fleet performance advisor. Analyze the following bot statistics and provide actionable insights.

Bot Statistics (last 50 tasks per bot):
${JSON.stringify(botStats, null, 2)}

For each bot, assess:
- Performance: Is the failure rate acceptable? Is task duration reasonable?
- Scaling: Does this bot need more capacity or fewer assignments?
- Attention: Are there signs of trouble (high failure rate, many pending tasks)?
- Optimization: Can task types be better matched to bot capabilities?

Provide specific, actionable recommendations. Be concise.`,
    });

    return NextResponse.json(object);
  } catch {
    return jsonError(500, "AI advisor analysis failed. Check AI provider configuration.");
  }
}
