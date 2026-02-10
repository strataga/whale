import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, tasks, timeEntries, users } from "@/lib/db/schema";
import { createTimeEntrySchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();
  if (!project) return jsonError(404, "Project not found");

  const task = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
    .get();
  if (!task) return jsonError(404, "Task not found");

  const entries = db
    .select({
      id: timeEntries.id,
      minutes: timeEntries.minutes,
      note: timeEntries.note,
      userId: timeEntries.userId,
      userName: users.name,
      botId: timeEntries.botId,
      createdAt: timeEntries.createdAt,
    })
    .from(timeEntries)
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .where(eq(timeEntries.taskId, taskId))
    .orderBy(desc(timeEntries.createdAt))
    .all();

  const totalRow = db
    .select({ total: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number) })
    .from(timeEntries)
    .where(eq(timeEntries.taskId, taskId))
    .get();

  return NextResponse.json({ entries, totalMinutes: totalRow?.total ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`time:create:${ctx.userId}`, { limit: 120, windowMs: 60_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ctx.workspaceId)))
    .get();
  if (!project) return jsonError(404, "Project not found");

  const task = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
    .get();
  if (!task) return jsonError(404, "Task not found");

  try {
    const body = await req.json();
    const data = createTimeEntrySchema.parse(body);

    const entryId = crypto.randomUUID();
    db.insert(timeEntries)
      .values({
        id: entryId,
        taskId,
        userId: ctx.userId,
        minutes: data.minutes,
        note: data.note ?? "",
      })
      .run();

    const created = db.select().from(timeEntries).where(eq(timeEntries.id, entryId)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "time.log",
      metadata: { projectId: id, taskId, entryId, minutes: data.minutes },
    });

    return NextResponse.json({ entry: created }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to log time");
  }
}
