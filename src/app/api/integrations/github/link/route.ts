import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { githubLinks, projects, tasks } from "@/lib/db/schema";
import { createGithubLinkSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  // Get all github links for tasks in workspace projects
  const workspaceProjects = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, ctx.workspaceId))
    .all();

  const projectIds = workspaceProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    return NextResponse.json({ links: [] });
  }

  const allLinks: any[] = [];
  for (const projectId of projectIds) {
    const projectTasks = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .all();

    for (const task of projectTasks) {
      const links = db
        .select()
        .from(githubLinks)
        .where(eq(githubLinks.taskId, task.id))
        .all();
      allLinks.push(...links);
    }
  }

  return NextResponse.json({ links: allLinks });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createGithubLinkSchema.parse(body);

    // Verify the task exists and belongs to a workspace project
    const task = db.select({ id: tasks.id, projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, data.taskId)).get();
    if (!task) return jsonError(404, "Task not found");

    const project = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, task.projectId!))
      .get();

    if (!project) return jsonError(404, "Project not found");

    const id = crypto.randomUUID();

    db.insert(githubLinks)
      .values({
        id,
        taskId: data.taskId,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
        issueNumber: data.issueNumber ?? null,
        prNumber: data.prNumber ?? null,
      })
      .run();

    const link = db.select().from(githubLinks).where(eq(githubLinks.id, id)).get();

    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create GitHub link");
  }
}
