import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { updateTeamMemberSchema } from "@/lib/validators";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, memberId } = await params;

  // Verify team
  const team = db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(and(eq(schema.teams.id, teamId), eq(schema.teams.workspaceId, ctx.workspaceId)))
    .get();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateTeamMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  db.update(schema.teamMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(schema.teamMembers.id, memberId), eq(schema.teamMembers.teamId, teamId)))
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, memberId } = await params;

  const team = db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(and(eq(schema.teams.id, teamId), eq(schema.teams.workspaceId, ctx.workspaceId)))
    .get();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  db.update(schema.teamMembers)
    .set({ removedAt: Date.now() })
    .where(and(eq(schema.teamMembers.id, memberId), eq(schema.teamMembers.teamId, teamId)))
    .run();

  return NextResponse.json({ ok: true });
}
