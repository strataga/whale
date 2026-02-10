export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function POST(
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

  const now = Date.now();
  const workflowId = crypto.randomUUID();

  db.insert(schema.workflows)
    .values({
      id: workflowId,
      workspaceId: ctx.workspaceId,
      name: `${template.name} (instance)`,
      definition: template.workflowDefinition,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ workflowId }, { status: 201 });
}
