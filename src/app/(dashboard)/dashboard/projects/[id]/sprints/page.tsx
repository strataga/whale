"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { SprintBoard } from "@/components/projects/sprint-board";
import { useCRPC } from "@/lib/convex/crpc";

export default function SprintsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const crpc = useCRPC();
  const projectQuery = crpc.projects.get.useQuery({ id: projectId });

  if (projectQuery.isPending) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!projectQuery.data) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard/projects" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground">Sprints</span>
        </nav>
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          Project not found.
        </div>
      </div>
    );
  }

  const projectName = projectQuery.data.name;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/projects" className="hover:text-foreground">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="hover:text-foreground"
        >
          {projectName ?? "Project"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Sprints</span>
      </nav>

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Sprint Planning
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize tasks into time-boxed sprints. Move tasks between the backlog
          and active sprints.
        </p>
      </div>

      <SprintBoard projectId={projectId} />
    </div>
  );
}
