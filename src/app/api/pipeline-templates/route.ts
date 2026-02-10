export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createPipelineTemplateSchema } from "@/lib/validators";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = db
    .select()
    .from(schema.pipelineTemplates)
    .where(eq(schema.pipelineTemplates.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({
    templates: templates.map((t) => ({
      ...t,
      workflowDefinition: JSON.parse(t.workflowDefinition),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createPipelineTemplateSchema.parse(body);
    const now = Date.now();

    const id = crypto.randomUUID();
    db.insert(schema.pipelineTemplates)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        description: data.description ?? "",
        category: data.category ?? "general",
        workflowDefinition: JSON.stringify(data.workflowDefinition),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const template = db
      .select()
      .from(schema.pipelineTemplates)
      .where(eq(schema.pipelineTemplates.id, id))
      .get();

    return NextResponse.json(
      {
        template: template
          ? { ...template, workflowDefinition: JSON.parse(template.workflowDefinition) }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create pipeline template" }, { status: 500 });
  }
}
