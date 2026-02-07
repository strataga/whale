import { NextResponse } from "next/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { createProjectSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") ?? "12", 10) || 12));
  const offset = (page - 1) * limit;

  const totalResult = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(projects)
    .where(eq(projects.workspaceId, ctx.workspaceId))
    .get();

  const total = totalResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows = db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, ctx.workspaceId))
    .orderBy(desc(projects.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();

  const ids = rows.map((p) => p.id);
  const counts = ids.length
    ? db
        .select({
          projectId: tasks.projectId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(tasks)
        .where(inArray(tasks.projectId, ids))
        .groupBy(tasks.projectId)
        .all()
    : [];

  const countByProjectId = new Map(counts.map((c) => [c.projectId, c.count]));

  return NextResponse.json({
    projects: rows.map((p) => ({
      ...p,
      taskCount: countByProjectId.get(p.id) ?? 0,
    })),
    pagination: { page, limit, total, totalPages },
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`projects:create:${ctx.userId}`, { limit: 10, windowMs: 60_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createProjectSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(projects)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        description: data.description ?? "",
        status: "active",
      })
      .run();

    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "project.create",
      metadata: { projectId: id, name: data.name },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create project");
  }
}

