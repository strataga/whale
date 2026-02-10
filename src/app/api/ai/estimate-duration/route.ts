import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { tasks, botTasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const estimateSchema = z.object({
  estimatedMinutes: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  reasoning: z.string(),
  similarTasks: z.array(
    z.object({
      description: z.string(),
      actualMinutes: z.number(),
    }),
  ),
});

/**
 * #25 Predictive Task Duration Estimation — uses history + AI to predict duration.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const body = await req.json();
  const { title, description, priority } = body as {
    title?: string;
    description?: string;
    priority?: string;
  };

  if (!title) {
    return jsonError(400, "title is required");
  }

  // Gather historical completion data
  const completedTasks = db
    .select({
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "done"),
        isNotNull(tasks.updatedAt),
      ),
    )
    .limit(30)
    .all();

  const completedBotTasks = db
    .select({
      startedAt: botTasks.startedAt,
      completedAt: botTasks.completedAt,
    })
    .from(botTasks)
    .where(
      and(
        eq(botTasks.status, "completed"),
        isNotNull(botTasks.startedAt),
        isNotNull(botTasks.completedAt),
      ),
    )
    .limit(30)
    .all();

  const historicalSummary = completedTasks.slice(0, 15).map((t) => ({
    title: t.title,
    priority: t.priority,
    durationMinutes: t.updatedAt && t.createdAt
      ? Math.round((t.updatedAt - t.createdAt) / 60000)
      : null,
  }));

  const botTaskDurations = completedBotTasks
    .filter((t) => t.startedAt && t.completedAt)
    .map((t) => Math.round((t.completedAt! - t.startedAt!) / 60000));

  const avgBotTaskMinutes = botTaskDurations.length > 0
    ? Math.round(botTaskDurations.reduce((a, b) => a + b, 0) / botTaskDurations.length)
    : null;

  try {
    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: estimateSchema,
      prompt: `You are a task duration estimator. Given a new task and historical data, predict how long it will take.

New Task:
- Title: ${title}
- Description: ${description || "None provided"}
- Priority: ${priority || "medium"}

Historical Completed Tasks:
${JSON.stringify(historicalSummary, null, 2)}

Average Bot Task Duration: ${avgBotTaskMinutes ? `${avgBotTaskMinutes} minutes` : "No data"}

Estimate the duration in minutes, provide confidence level, and explain your reasoning. Reference similar historical tasks if applicable.`,
    });

    return NextResponse.json(object);
  } catch {
    return jsonError(500, "AI estimation failed. Check AI provider configuration.");
  }
}
