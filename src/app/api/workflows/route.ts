export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createWorkflowSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rows = db
    .select()
    .from(workflows)
    .where(eq(workflows.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({
    workflows: rows.map((w) => ({
      ...w,
      definition: JSON.parse(w.definition || "{}"),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  try {
    const body = await req.json();
    const data = createWorkflowSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(workflows)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        definition: JSON.stringify(data.definition),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const workflow = db.select().from(workflows).where(eq(workflows.id, id)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "workflow.create",
      metadata: { workflowId: id },
    });

    return NextResponse.json(
      {
        workflow: workflow
          ? { ...workflow, definition: JSON.parse(workflow.definition || "{}") }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create workflow");
  }
}
