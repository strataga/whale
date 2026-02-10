import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createTeamSchema } from "@/lib/validators";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = db
    .select()
    .from(schema.teams)
    .where(and(eq(schema.teams.workspaceId, ctx.workspaceId), isNull(schema.teams.deletedAt)))
    .all();

  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, slug, description, visibility } = parsed.data;
  const now = Date.now();

  // Check slug uniqueness within workspace
  const existing = db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(and(eq(schema.teams.workspaceId, ctx.workspaceId), eq(schema.teams.slug, slug)))
    .get();
  if (existing) {
    return NextResponse.json({ error: "Team slug already exists" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  db.insert(schema.teams)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      name,
      slug,
      description: description ?? "",
      visibility: visibility ?? "private",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Auto-add creator as lead
  db.insert(schema.teamMembers)
    .values({
      teamId: id,
      memberType: "user",
      userId: ctx.userId,
      role: "lead",
      joinedAt: now,
    })
    .run();

  return NextResponse.json({ id, slug, name }, { status: 201 });
}
