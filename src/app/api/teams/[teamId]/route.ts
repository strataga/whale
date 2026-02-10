import { NextResponse } from "next/server";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { updateTeamSchema } from "@/lib/validators";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await params;

  const team = db
    .select()
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.id, teamId),
        eq(schema.teams.workspaceId, ctx.workspaceId),
        isNull(schema.teams.deletedAt),
      ),
    )
    .get();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const members = db
    .select()
    .from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.teamId, teamId), isNull(schema.teamMembers.removedAt)))
    .all();

  return NextResponse.json({ ...team, members });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await params;

  const team = db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.id, teamId),
        eq(schema.teams.workspaceId, ctx.workspaceId),
        isNull(schema.teams.deletedAt),
      ),
    )
    .get();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  db.update(schema.teams)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(schema.teams.id, teamId))
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });
  const { teamId } = await params;

  const team = db
    .select({ id: schema.teams.id, isDefault: schema.teams.isDefault })
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.id, teamId),
        eq(schema.teams.workspaceId, ctx.workspaceId),
        isNull(schema.teams.deletedAt),
      ),
    )
    .get();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.isDefault) {
    return NextResponse.json({ error: "Cannot delete default team" }, { status: 400 });
  }

  db.update(schema.teams)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(schema.teams.id, teamId))
    .run();

  return NextResponse.json({ ok: true });
}
