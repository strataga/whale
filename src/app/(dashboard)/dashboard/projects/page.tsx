"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

import { ProjectCard } from "@/components/projects/project-card";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

const DEFAULT_LIMIT = 12;

export default function ProjectsPage() {
  const crpc = useCRPC();
  const [page, setPage] = useState(1);

  const { data: allProjects, isPending: projectsPending } =
    crpc.projects.list.useQuery({});
  const { data: allTasks, isPending: tasksPending } =
    crpc.tasks.list.useQuery({ limit: 200 });

  const isPending = projectsPending || tasksPending;

  const taskCountByProjectId = useMemo(() => {
    const map = new Map<string, number>();
    if (!allTasks) return map;
    for (const t of allTasks) {
      if (t.projectId) {
        const key = t.projectId as string;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [allTasks]);

  const total = allProjects?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_LIMIT));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * DEFAULT_LIMIT;

  const pagedProjects = useMemo(() => {
    if (!allProjects) return [];
    // Sort by _creationTime descending (most recently updated first)
    const sorted = [...allProjects].sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0),
    );
    return sorted.slice(offset, offset + DEFAULT_LIMIT);
  }, [allProjects, offset]);

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you&apos;re working on, in one place.
            </p>
          </div>
          <div className="h-[44px] w-[120px] animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[130px] animate-pulse rounded-2xl border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you&apos;re working on, in one place.
          </p>
        </div>

        <Link
          href="/dashboard/projects/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          New Project
        </Link>
      </div>

      {pagedProjects.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pagedProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={{
                id: project._id,
                name: project.name,
                description: project.description,
                status: project.status,
              }}
              taskCount={taskCountByProjectId.get(project._id) ?? 0}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <h3 className="text-sm font-semibold">No projects yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first project manually or start with an AI-assisted intake.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/projects/new"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Create a project
            </Link>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(
              "inline-flex min-h-[36px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              safePage <= 1
                ? "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            Previous
          </button>
          <span className="inline-flex min-h-[36px] items-center justify-center px-3 text-sm text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={cn(
              "inline-flex min-h-[36px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              safePage >= totalPages
                ? "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
