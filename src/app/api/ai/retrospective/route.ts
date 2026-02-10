import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { botTasks, bots, projects, tasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const retrospectiveSchema = z.object({
  summary: z.string(),
  tasksCompleted: z.number(),
  tasksSlipped: z.array(z.object({ title: z.string(), reason: z.string() })),
  botProductivity: z.array(z.object({ botName: z.string(), tasksCompleted: z.number(), avgMinutes: z.number() })),
  velocityTrend: z.string(),
  recommendations: z.array(z.string()),
});

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const body = await req.json().catch(() => ({}));
  const daysBack = (body as { days?: number }).days ?? 7;
  const since = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  const completedTasks = db
    .select({ title: tasks.title, priority: tasks.priority, updatedAt: tasks.updatedAt })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        eq(tasks.status, "done"),
        gte(tasks.updatedAt, since),
      ),
    )
    .all();

  const overdueTasks = db
    .select({ title: tasks.title, dueDate: tasks.dueDate, status: tasks.status })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        sql`${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} < ${Date.now()} AND ${tasks.status} != 'done'`,
      ),
    )
    .all();

  const botTaskStats = db
    .select({
      botName: bots.name,
      completed: sql<number>`sum(case when ${botTasks.status} = 'completed' then 1 else 0 end)`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(botTasks)
    .innerJoin(bots, eq(botTasks.botId, bots.id))
    .where(and(eq(bots.workspaceId, ctx.workspaceId), gte(botTasks.createdAt, since)))
    .groupBy(bots.name)
    .all();

  try {
    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: retrospectiveSchema,
      prompt: `Generate a weekly retrospective/sprint summary based on this data:

Period: Last ${daysBack} days

Tasks completed: ${completedTasks.length}
${completedTasks.map((t) => `  - ${t.title} (${t.priority})`).join("\n")}

Overdue/slipped tasks: ${overdueTasks.length}
${overdueTasks.map((t) => `  - ${t.title} (due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"}, status: ${t.status})`).join("\n")}

Bot task stats:
${botTaskStats.map((b) => `  - ${b.botName}: ${b.completed}/${b.total} tasks completed`).join("\n") || "  No bot activity"}

Provide a concise summary, identify what slipped and why, note bot productivity, assess velocity, and give 2-3 actionable recommendations.`,
    });

    return NextResponse.json({ retrospective: object });
  } catch {
    return jsonError(500, "AI retrospective generation failed. Check AI provider configuration.");
  }
}
