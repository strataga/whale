import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, taskAttachments, tasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; taskId: string; attachmentId: string }>;
  },
) {
  const { id, taskId, attachmentId } = await params;
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

  const attachment = db
    .select()
    .from(taskAttachments)
    .where(
      and(
        eq(taskAttachments.id, attachmentId),
        eq(taskAttachments.taskId, taskId),
      ),
    )
    .get();
  if (!attachment) return jsonError(404, "Attachment not found");

  const filePath = path.join(UPLOAD_DIR, attachment.filename);
  if (!fs.existsSync(filePath)) {
    return jsonError(404, "File not found on disk");
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
      "Content-Length": String(attachment.sizeBytes),
    },
  });
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; taskId: string; attachmentId: string }>;
  },
) {
  const { id, taskId, attachmentId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

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

  const attachment = db
    .select()
    .from(taskAttachments)
    .where(
      and(
        eq(taskAttachments.id, attachmentId),
        eq(taskAttachments.taskId, taskId),
      ),
    )
    .get();
  if (!attachment) return jsonError(404, "Attachment not found");

  // Delete file from disk (ignore if missing)
  const filePath = path.join(UPLOAD_DIR, attachment.filename);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may already be removed; continue with DB cleanup
  }

  // Delete DB record
  db.delete(taskAttachments)
    .where(eq(taskAttachments.id, attachmentId))
    .run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "task.attachment.delete",
    metadata: {
      projectId: id,
      taskId,
      attachmentId,
      originalName: attachment.originalName,
    },
  });

  return NextResponse.json({ ok: true });
}
