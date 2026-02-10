export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sprintId: string }> },
) {
  const { id: projectId, sprintId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify sprint belongs to project
  const sprint = db
    .select()
    .from(schema.sprints)
    .where(
      and(
        eq(schema.sprints.id, sprintId),
        eq(schema.sprints.projectId, projectId),
      ),
    )
    .get();

  if (!sprint) {
    return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
  }

  // Get all tasks in this sprint
  const sprintTaskRows = db
    .select({
      taskId: schema.sprintTasks.taskId,
      status: schema.tasks.status,
      createdAt: schema.sprintTasks.createdAt,
    })
    .from(schema.sprintTasks)
    .innerJoin(schema.tasks, eq(schema.sprintTasks.taskId, schema.tasks.id))
    .where(eq(schema.sprintTasks.sprintId, sprintId))
    .all();

  const totalTasks = sprintTaskRows.length;
  const done = sprintTaskRows.filter((t) => t.status === "done").length;
  const inProgress = sprintTaskRows.filter((t) => t.status === "in_progress").length;
  const todo = sprintTaskRows.filter((t) => t.status === "todo").length;
  const velocity = done;

  // Build a simple burndown: count remaining tasks per day of the sprint
  const burndown: Array<{ date: string; remaining: number }> = [];
  const sprintStart = sprint.startDate;
  const sprintEnd = sprint.endDate;
  const dayMs = 24 * 60 * 60 * 1000;

  // Get task completion dates for tasks in this sprint
  const completedTasks = db
    .select({
      taskId: schema.tasks.id,
      updatedAt: schema.tasks.updatedAt,
    })
    .from(schema.sprintTasks)
    .innerJoin(schema.tasks, eq(schema.sprintTasks.taskId, schema.tasks.id))
    .where(
      and(
        eq(schema.sprintTasks.sprintId, sprintId),
        eq(schema.tasks.status, "done"),
      ),
    )
    .all();

  const completionDates = completedTasks.map((t) => t.updatedAt);
  const now = Date.now();
  const endDate = Math.min(sprintEnd, now);

  for (let day = sprintStart; day <= endDate; day += dayMs) {
    const dateStr = new Date(day).toISOString().split("T")[0];
    const doneByDay = completionDates.filter((d) => d <= day).length;
    burndown.push({ date: dateStr, remaining: totalTasks - doneByDay });
  }

  // Scope changes: tasks added after sprint start
  const scopeChanges = sprintTaskRows.filter((t) => t.createdAt > sprintStart).length;

  return NextResponse.json({
    sprintId,
    totalTasks,
    done,
    inProgress,
    todo,
    velocity,
    scopeChanges,
    burndown,
  });
}
