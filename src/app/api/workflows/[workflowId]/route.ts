export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { updateWorkflowSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const workflow = db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!workflow) return jsonError(404, "Workflow not found");

  return NextResponse.json({
    workflow: {
      ...workflow,
      definition: JSON.parse(workflow.definition || "{}"),
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const workflow = db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!workflow) return jsonError(404, "Workflow not found");

  try {
    const body = await req.json();
    const data = updateWorkflowSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.definition !== undefined)
      updates.definition = JSON.stringify(data.definition);

    db.update(workflows)
      .set(updates)
      .where(eq(workflows.id, workflowId))
      .run();

    const updated = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "workflow.update",
      metadata: { workflowId },
    });

    return NextResponse.json({
      workflow: updated
        ? { ...updated, definition: JSON.parse(updated.definition || "{}") }
        : null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update workflow");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const workflow = db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!workflow) return jsonError(404, "Workflow not found");

  db.delete(workflows).where(eq(workflows.id, workflowId)).run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "workflow.delete",
    metadata: { workflowId },
  });

  return NextResponse.json({ success: true });
}
