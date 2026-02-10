"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { CalendarView } from "@/components/projects/calendar-view";
import { useCRPC } from "@/lib/convex/crpc";

export default function ProjectCalendarPage() {
  const { id } = useParams<{ id: string }>();
  const crpc = useCRPC();

  const { data: project, isPending: projectPending } =
    crpc.projects.get.useQuery({ id });
  const { data: rawTasks, isPending: tasksPending } =
    crpc.tasks.list.useQuery({ projectId: id });
  const { data: rawMilestones, isPending: milestonesPending } =
    crpc.milestones.list.useQuery({ projectId: id });

  const isPending = projectPending || tasksPending || milestonesPending;

  const taskList = useMemo(() => {
    if (!rawTasks) return [];
    return rawTasks.map((t: any) => ({
      id: t._id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
    }));
  }, [rawTasks]);

  const milestoneList = useMemo(() => {
    if (!rawMilestones) return [];
    return rawMilestones.map((m: any) => ({
      id: m._id,
      title: m.name,
      dueDate: m.dueDate ?? null,
    }));
  }, [rawMilestones]);

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-[500px] animate-pulse rounded-2xl border border-border bg-muted" />
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{project.name} &mdash; Calendar</h2>
      </div>
      <CalendarView
        projectId={id}
        tasks={taskList}
        milestones={milestoneList}
      />
    </div>
  );
}
