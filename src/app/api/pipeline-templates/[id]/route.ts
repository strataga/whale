export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const template = db
    .select()
    .from(schema.pipelineTemplates)
    .where(
      and(
        eq(schema.pipelineTemplates.id, id),
        eq(schema.pipelineTemplates.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({
    template: {
      ...template,
      workflowDefinition: JSON.parse(template.workflowDefinition),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const template = db
    .select()
    .from(schema.pipelineTemplates)
    .where(
      and(
        eq(schema.pipelineTemplates.id, id),
        eq(schema.pipelineTemplates.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  db.delete(schema.pipelineTemplates)
    .where(eq(schema.pipelineTemplates.id, id))
    .run();

  return NextResponse.json({ success: true });
}
