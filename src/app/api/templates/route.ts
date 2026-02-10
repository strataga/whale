import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { taskTemplates } from "@/lib/db/schema";
import { createTaskTemplateSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const templates = db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`templates:create:${ctx.userId}`, { limit: 30, windowMs: 60_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createTaskTemplateSchema.parse(body);

    const id = crypto.randomUUID();
    db.insert(taskTemplates)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        titlePattern: data.titlePattern ?? "",
        description: data.description ?? "",
        priority: data.priority ?? "medium",
        tags: JSON.stringify(data.tags ?? []),
        subtaskTitles: JSON.stringify(data.subtaskTitles ?? []),
      })
      .run();

    const created = db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "template.create",
      metadata: { templateId: id, name: data.name },
    });

    return NextResponse.json({ template: created }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create template");
  }
}
