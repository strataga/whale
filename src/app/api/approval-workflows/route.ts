export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { approvalWorkflows } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createApprovalWorkflowSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const workflows = db
    .select()
    .from(approvalWorkflows)
    .where(eq(approvalWorkflows.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({
    workflows: workflows.map((w) => ({
      ...w,
      stages: JSON.parse(w.stages || "[]"),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createApprovalWorkflowSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(approvalWorkflows)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        stages: JSON.stringify(data.stages),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const workflow = db
      .select()
      .from(approvalWorkflows)
      .where(eq(approvalWorkflows.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "approval_workflow.create",
      metadata: { workflowId: id },
    });

    return NextResponse.json(
      {
        workflow: workflow
          ? { ...workflow, stages: JSON.parse(workflow.stages || "[]") }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create approval workflow");
  }
}
