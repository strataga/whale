import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { agentThreads, projects, tasks } from "@/lib/db/schema";
import { createAgentThreadSchema } from "@/lib/validators";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  // Get threads linked to workspace tasks, plus unlinked threads
  const workspaceProjects = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, ctx.workspaceId))
    .all();

  const projectIds = workspaceProjects.map((p) => p.id);

  const workspaceTasks = projectIds.length > 0
    ? db
        .select({ id: tasks.id, projectId: tasks.projectId })
        .from(tasks)
        .all()
        .filter((t) => t.projectId != null && projectIds.includes(t.projectId))
    : [];

  const taskIds = new Set(workspaceTasks.map((t) => t.id));

  const threads = db
    .select()
    .from(agentThreads)
    .orderBy(desc(agentThreads.createdAt))
    .all()
    .filter((t) => !t.taskId || taskIds.has(t.taskId));

  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  try {
    const body = await req.json();
    const data = createAgentThreadSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(agentThreads)
      .values({
        id,
        taskId: data.taskId ?? null,
        subject: data.subject,
      })
      .run();

    const thread = db.select().from(agentThreads).where(eq(agentThreads.id, id)).get();

    return NextResponse.json({ thread }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create thread");
  }
}
