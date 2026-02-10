import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { reorderTasksSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  try {
    const body = await req.json();
    const data = reorderTasksSchema.parse(body);

    for (const item of data.items) {
      const updates: Record<string, unknown> = {
        position: item.position,
        updatedAt: Date.now(),
      };
      if (item.status !== undefined) {
        updates.status = item.status;
      }

      db.update(tasks)
        .set(updates)
        .where(and(eq(tasks.id, item.taskId), eq(tasks.projectId, projectId)))
        .run();
    }

    return NextResponse.json({ reordered: data.items.length });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to reorder tasks");
  }
}
