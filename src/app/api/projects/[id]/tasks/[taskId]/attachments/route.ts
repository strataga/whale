import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { projects, taskAttachments, tasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_TASK = 20;
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

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

  const attachments = db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(desc(taskAttachments.createdAt))
    .all();

  return NextResponse.json({ attachments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params;
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

  // Check max files per task
  const existingCount = db
    .select({ id: taskAttachments.id })
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .all().length;

  if (existingCount >= MAX_FILES_PER_TASK) {
    return jsonError(400, `Maximum ${MAX_FILES_PER_TASK} files per task`);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return jsonError(400, "No file provided");
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError(400, "File too large (max 10 MB)");
    }

    if (file.size === 0) {
      return jsonError(400, "File is empty");
    }

    // Ensure upload directory exists
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    // Generate UUID filename to avoid collisions
    const ext = path.extname(file.name);
    const storedFilename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, storedFilename);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Insert record
    const attachmentId = crypto.randomUUID();
    db.insert(taskAttachments)
      .values({
        id: attachmentId,
        taskId,
        filename: storedFilename,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        uploadedBy: ctx.userId,
      })
      .run();

    const created = db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "task.attachment.upload",
      metadata: { projectId: id, taskId, attachmentId, originalName: file.name },
    });

    return NextResponse.json({ attachment: created }, { status: 201 });
  } catch {
    return jsonError(500, "Failed to upload attachment");
  }
}
