"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { useCRPC } from "@/lib/convex/crpc";
import DailyPlanClient from "./daily-plan-client";

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

export default function ProjectPlanPage() {
  const { id } = useParams<{ id: string }>();
  const crpc = useCRPC();

  const { data: project, isPending: projectPending } =
    crpc.projects.get.useQuery({ id });
  const { data: openTasks, isPending: tasksPending } =
    crpc.tasks.list.useQuery({ projectId: id });

  const isPending = projectPending || tasksPending;

  const plan = useMemo(() => {
    if (!openTasks) return { mustDo: [], niceToDo: [], finishThis: [] };

    // Filter out done tasks client-side
    const notDone = openTasks.filter((t: any) => t.status !== "done");

    const sorted = [...notDone].sort((a, b) => {
      const p = priorityScore(b.priority) - priorityScore(a.priority);
      if (p !== 0) return p;

      const aDue = a.dueDate ?? Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ?? Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;

      return (b._creationTime ?? 0) - (a._creationTime ?? 0);
    });

    const mustDo = sorted.slice(0, 3).map((t) => ({
      id: t._id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));
    const niceToDo = sorted.slice(3, 5).map((t) => ({
      id: t._id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));
    const finishThis = sorted.slice(5, 6).map((t) => ({
      id: t._id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));

    return { mustDo, niceToDo, finishThis };
  }, [openTasks]);

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Daily plan</p>
            <div className="mt-2 h-8 w-48 animate-pulse rounded bg-muted" />
            <p className="mt-1 text-sm text-muted-foreground">
              3 must-do, 2 nice-to-do, 1 finish-this.
            </p>
          </div>
          <div className="h-[44px] w-[140px] animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-2xl border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">Project not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The project could not be found.
        </p>
      </div>
    );
  }

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
          href={`/dashboard/projects/${project._id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to project
        </Link>
      </div>

      <DailyPlanClient
        projectId={project._id}
        initialPlan={plan}
      />
    </div>
  );
}
