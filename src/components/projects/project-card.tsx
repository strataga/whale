import Link from "next/link";

import type { Project } from "@/types";
import { cn } from "@/lib/utils";

function statusStyles(status?: string | null) {
  switch (status) {
    case "active":
      return "border-primary/30 bg-primary/10 text-primary";
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "archived":
      return "border-border bg-muted text-muted-foreground";
    case "draft":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function ProjectCard({
  project,
  taskCount,
}: {
  project: Pick<Project, "id" | "name" | "description" | "status">;
  taskCount: number;
}) {
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {project.name}
          </div>
          {project.description ? (
            <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {project.description}
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              No description yet.
            </div>
          )}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-xs font-semibold",
            statusStyles(project.status),
          )}
        >
          {project.status ?? "draft"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{taskCount} tasks</span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          Open →
        </span>
      </div>
    </Link>
  );
}

