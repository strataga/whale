import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { requireAuthContext } from "@/lib/server/auth-context";

import DailyPlanClient from "./daily-plan-client";

export const runtime = "nodejs";

function priorityScore(priority?: string | null) {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export default async function ProjectPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspaceId } = await requireAuthContext();

  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .get();

  if (!project) notFound();

  const openTasks = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, project.id), ne(tasks.status, "done")))
    .all();

  const sorted = [...openTasks].sort((a, b) => {
    const p = priorityScore(b.priority) - priorityScore(a.priority);
    if (p !== 0) return p;

    const aDue = a.dueDate ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ?? Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });

  const mustDo = sorted.slice(0, 3);
  const niceToDo = sorted.slice(3, 5);
  const finishThis = sorted.slice(5, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Daily plan</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            3 must-do, 2 nice-to-do, 1 finish-this.
          </p>
        </div>

        <Link
          href={`/dashboard/projects/${project.id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to project
        </Link>
      </div>

      <DailyPlanClient
        projectId={project.id}
        initialPlan={{
          mustDo: mustDo.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
          niceToDo: niceToDo.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
          finishThis: finishThis.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
        }}
      />
    </div>
  );
}

