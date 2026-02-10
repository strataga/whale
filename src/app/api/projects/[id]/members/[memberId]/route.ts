export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { projectMembers, projects } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id: projectId, memberId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const member = db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.id, memberId),
        eq(projectMembers.projectId, projectId),
      ),
    )
    .get();

  if (!member) return jsonError(404, "Member not found");

  db.delete(projectMembers).where(eq(projectMembers.id, memberId)).run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "project_member.remove",
    metadata: { projectId, memberId, removedUserId: member.userId },
  });

  return NextResponse.json({ success: true });
}
