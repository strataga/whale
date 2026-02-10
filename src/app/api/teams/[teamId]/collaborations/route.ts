import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq, and, or } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createTeamCollaborationSchema } from "@/lib/validators";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await params;

  const collabs = db
    .select()
    .from(schema.teamCollaborations)
    .where(
      and(
        eq(schema.teamCollaborations.workspaceId, ctx.workspaceId),
        or(
          eq(schema.teamCollaborations.sourceTeamId, teamId),
          eq(schema.teamCollaborations.targetTeamId, teamId),
        ),
      ),
    )
    .all();

  return NextResponse.json({ collaborations: collabs });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await params;

  const body = await req.json();
  const parsed = createTeamCollaborationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  db.insert(schema.teamCollaborations)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      sourceTeamId: teamId,
      targetTeamId: parsed.data.targetTeamId,
      scope: parsed.data.scope ?? "tasks",
      direction: parsed.data.direction ?? "bidirectional",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id }, { status: 201 });
}
