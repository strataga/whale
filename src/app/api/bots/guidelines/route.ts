import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { botGuidelines } from "@/lib/db/schema";
import { createBotGuidelineSchema } from "@/lib/validators";
import { checkRole, getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const guidelines = db
    .select()
    .from(botGuidelines)
    .where(eq(botGuidelines.workspaceId, ctx.workspaceId))
    .orderBy(desc(botGuidelines.createdAt))
    .all();

  return NextResponse.json({ guidelines });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createBotGuidelineSchema.parse(body);

    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(botGuidelines)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        title: data.title,
        content: data.content,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const guideline = db
      .select()
      .from(botGuidelines)
      .where(eq(botGuidelines.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_guideline.create",
      metadata: { guidelineId: id, title: data.title },
    });

    return NextResponse.json({ guideline }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}
