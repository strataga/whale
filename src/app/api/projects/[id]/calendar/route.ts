import { NextResponse } from "next/server";
import { and, eq, gte, lte, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { milestones, projects, sprints, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from") ?? "0");
  const to = Number(url.searchParams.get("to") ?? String(Date.now() + 30 * 86400000));

  const calendarTasks = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        gte(tasks.dueDate, from),
        lte(tasks.dueDate, to),
      ),
    )
    .all();

  const calendarMilestones = db
    .select()
    .from(milestones)
    .where(
      and(
        eq(milestones.projectId, projectId),
        gte(milestones.dueDate, from),
        lte(milestones.dueDate, to),
      ),
    )
    .all();

  const calendarSprints = db
    .select()
    .from(sprints)
    .where(
      and(
        eq(sprints.projectId, projectId),
        or(
          and(gte(sprints.startDate, from), lte(sprints.startDate, to)),
          and(gte(sprints.endDate, from), lte(sprints.endDate, to)),
          and(lte(sprints.startDate, from), gte(sprints.endDate, to)),
        ),
      ),
    )
    .all();

  return NextResponse.json({
    tasks: calendarTasks,
    milestones: calendarMilestones,
    sprints: calendarSprints,
  });
}
