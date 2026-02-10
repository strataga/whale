import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { bots, milestones, projects, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const riskScanSchema = z.object({
  risks: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high", "critical"]),
      category: z.string(),
      description: z.string(),
      recommendation: z.string(),
    }),
  ),
  overallHealth: z.enum(["good", "warning", "critical"]),
  summary: z.string(),
});

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const now = Date.now();

  const unassignedNearDue = db
    .select({ title: tasks.title, dueDate: tasks.dueDate })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        sql`${tasks.assigneeId} IS NULL AND ${tasks.status} != 'done' AND ${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} < ${now + 3 * 24 * 60 * 60 * 1000}`,
      ),
    )
    .all();

  const overdueMilestones = db
    .select({ name: milestones.name, dueDate: milestones.dueDate })
    .from(milestones)
    .innerJoin(projects, eq(milestones.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        sql`${milestones.dueDate} IS NOT NULL AND ${milestones.dueDate} < ${now}`,
      ),
    )
    .all();

  const errorBots = db
    .select({ name: bots.name, statusReason: bots.statusReason })
    .from(bots)
    .where(and(eq(bots.workspaceId, ctx.workspaceId), eq(bots.status, "error")))
    .all();

  const overdueTasks = db
    .select({ title: tasks.title, dueDate: tasks.dueDate, status: tasks.status })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        sql`${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} < ${now} AND ${tasks.status} != 'done'`,
      ),
    )
    .all();

  try {
    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: riskScanSchema,
      prompt: `Analyze the following project data for risks and provide a health assessment:

Unassigned tasks due within 3 days: ${unassignedNearDue.length}
${unassignedNearDue.map((t) => `  - ${t.title} (due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"})`).join("\n") || "  None"}

Overdue milestones: ${overdueMilestones.length}
${overdueMilestones.map((m) => `  - ${m.name} (was due: ${m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "N/A"})`).join("\n") || "  None"}

Bots in error state: ${errorBots.length}
${errorBots.map((b) => `  - ${b.name}: ${b.statusReason ?? "unknown"}`).join("\n") || "  None"}

Overdue tasks: ${overdueTasks.length}
${overdueTasks.map((t) => `  - ${t.title} (due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"}, status: ${t.status})`).join("\n") || "  None"}

Identify specific risks with severity, categorize them, and give actionable recommendations. Assess overall project health.`,
    });

    return NextResponse.json({ scan: object });
  } catch {
    return jsonError(500, "AI risk scan failed. Check AI provider configuration.");
  }
}
