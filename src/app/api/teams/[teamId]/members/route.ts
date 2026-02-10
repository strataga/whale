import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { addTeamMemberSchema } from "@/lib/validators";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await params;

  // Verify team belongs to workspace
  const team = db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(
      and(eq(schema.teams.id, teamId), eq(schema.teams.workspaceId, ctx.workspaceId)),
    )
    .get();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const members = db
    .select()
    .from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.teamId, teamId), isNull(schema.teamMembers.removedAt)))
    .all();

  return NextResponse.json({ members });
}

export async function POST(
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
  const parsed = addTeamMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  db.insert(schema.teamMembers)
    .values({
      id,
      teamId,
      memberType: parsed.data.memberType,
      userId: parsed.data.userId ?? null,
      botId: parsed.data.botId ?? null,
      role: parsed.data.role ?? "member",
      joinedAt: now,
    })
    .run();

  return NextResponse.json({ id }, { status: 201 });
}
