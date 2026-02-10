import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { updateTeamCollaborationSchema } from "@/lib/validators";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; collabId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collabId } = await params;

  const body = await req.json();
  const parsed = updateTeamCollaborationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (parsed.data.scope !== undefined) updates.scope = parsed.data.scope;
  if (parsed.data.direction !== undefined) updates.direction = parsed.data.direction;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active ? 1 : 0;

  db.update(schema.teamCollaborations)
    .set(updates)
    .where(
      and(
        eq(schema.teamCollaborations.id, collabId),
        eq(schema.teamCollaborations.workspaceId, ctx.workspaceId),
      ),
    )
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; collabId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { collabId } = await params;

  db.delete(schema.teamCollaborations)
    .where(
      and(
        eq(schema.teamCollaborations.id, collabId),
        eq(schema.teamCollaborations.workspaceId, ctx.workspaceId),
      ),
    )
    .run();

  return NextResponse.json({ ok: true });
}
