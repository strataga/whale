import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";

import { Pagination } from "@/components/ui/pagination";
import { ProjectCard } from "@/components/projects/project-card";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { requireAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 12;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const { workspaceId } = await requireAuthContext();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(params.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const totalResult = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .get();

  const total = totalResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const allProjects = db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();

  const projectIds = allProjects.map((p) => p.id);

  const taskCounts = projectIds.length
    ? db
        .select({
          projectId: tasks.projectId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(tasks)
        .where(inArray(tasks.projectId, projectIds))
        .groupBy(tasks.projectId)
        .all()
    : [];

  const taskCountByProjectId = new Map(taskCounts.map((r) => [r.projectId, r.count]));

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

      {allProjects.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              taskCount={taskCountByProjectId.get(project.id) ?? 0}
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

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/dashboard/projects"
      />
    </div>
  );
}

