export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { botGroups } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createBotGroupSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const groups = db
    .select()
    .from(botGroups)
    .where(eq(botGroups.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  try {
    const body = await req.json();
    const data = createBotGroupSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(botGroups)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        description: data.description ?? "",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const group = db.select().from(botGroups).where(eq(botGroups.id, id)).get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_group.create",
      metadata: { groupId: id },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create bot group");
  }
}
