import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, taskComments, taskMentions, tasks, users } from "@/lib/db/schema";
import { createTaskCommentSchema } from "@/lib/validators";
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

  const comments = db
    .select({
      id: taskComments.id,
      body: taskComments.body,
      authorType: taskComments.authorType,
      authorId: taskComments.authorId,
      authorName: users.name,
      authorEmail: users.email,
      createdAt: taskComments.createdAt,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.authorId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(desc(taskComments.createdAt))
    .all();

  return NextResponse.json({ comments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`comments:create:${ctx.userId}`, { limit: 60, windowMs: 60_000 });
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
    const data = createTaskCommentSchema.parse(body);

    const commentId = crypto.randomUUID();
    db.insert(taskComments)
      .values({
        id: commentId,
        taskId,
        authorId: ctx.userId,
        authorType: "user",
        body: data.body,
      })
      .run();

    const created = db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, commentId))
      .get();

    // Extract @mentions (match @word or @email patterns)
    const mentionPattern = /@([\w.+-]+@[\w.-]+\.\w+|[\w.-]+)/g;
    const mentions = [...data.body.matchAll(mentionPattern)].map((m) => m[1]!);
    if (mentions.length > 0) {
      const mentionedUsers = db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.workspaceId, ctx.workspaceId))
        .all();

      for (const mention of mentions) {
        const match = mentionedUsers.find(
          (u) =>
            u.email === mention ||
            u.name?.toLowerCase() === mention.toLowerCase(),
        );
        if (match) {
          db.insert(taskMentions)
            .values({ taskId, userId: match.id })
            .run();
        }
      }
    }

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "comment.create",
      metadata: { projectId: id, taskId, commentId },
    });

    return NextResponse.json({ comment: created }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create comment");
  }
}
