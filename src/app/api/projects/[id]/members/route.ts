export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { projectMembers, projects, users } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { addProjectMemberSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  const members = db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      role: projectMembers.role,
      userName: users.name,
      userEmail: users.email,
      createdAt: projectMembers.createdAt,
    })
    .from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .all();

  return NextResponse.json({ members });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .get();

  if (!project) return jsonError(404, "Project not found");

  try {
    const body = await req.json();
    const data = addProjectMemberSchema.parse(body);

    const user = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, data.userId), eq(users.workspaceId, ctx.workspaceId)))
      .get();

    if (!user) return jsonError(404, "User not found in workspace");

    const existing = db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, data.userId),
        ),
      )
      .get();

    if (existing) return jsonError(409, "User is already a member of this project");

    const id = crypto.randomUUID();

    db.insert(projectMembers)
      .values({
        id,
        projectId,
        userId: data.userId,
        role: data.role ?? "member",
      })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "project_member.add",
      metadata: { projectId, memberId: data.userId },
    });

    return NextResponse.json(
      { id, userId: data.userId, role: data.role ?? "member" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to add project member");
  }
}
