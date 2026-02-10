export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

interface TimelineEntry {
  type: "event" | "comment" | "approval";
  timestamp: number;
  data: Record<string, unknown>;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id: projectId, taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify task belongs to project
  const task = db
    .select()
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.id, taskId),
        eq(schema.tasks.projectId, projectId),
      ),
    )
    .get();

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const timeline: TimelineEntry[] = [];

  // Bot task events
  const botTasksList = db
    .select({ id: schema.botTasks.id })
    .from(schema.botTasks)
    .where(eq(schema.botTasks.taskId, taskId))
    .all();

  for (const bt of botTasksList) {
    const events = db
      .select()
      .from(schema.botTaskEvents)
      .where(eq(schema.botTaskEvents.botTaskId, bt.id))
      .all();

    for (const event of events) {
      timeline.push({
        type: "event",
        timestamp: event.createdAt,
        data: {
          botTaskId: bt.id,
          event: event.event,
          metadata: JSON.parse(event.metadata),
        },
      });
    }
  }

  // Task comments
  const comments = db
    .select()
    .from(schema.taskComments)
    .where(eq(schema.taskComments.taskId, taskId))
    .all();

  for (const comment of comments) {
    timeline.push({
      type: "comment",
      timestamp: comment.createdAt,
      data: {
        commentId: comment.id,
        authorId: comment.authorId,
        authorType: comment.authorType,
        body: comment.body,
      },
    });
  }

  // Approval gates
  const approvals = db
    .select()
    .from(schema.approvalGates)
    .where(eq(schema.approvalGates.taskId, taskId))
    .all();

  for (const gate of approvals) {
    timeline.push({
      type: "approval",
      timestamp: gate.createdAt,
      data: {
        gateId: gate.id,
        status: gate.status,
        requiredRole: gate.requiredRole,
        reviewedBy: gate.reviewedBy,
        reviewNote: gate.reviewNote,
      },
    });
  }

  // Sort chronologically
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  return NextResponse.json({ taskId, timeline });
}
