import { NextResponse } from "next/server";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export async function GET(req: Request) {
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = db
    .select({
      teamId: schema.teamMembers.teamId,
      role: schema.teamMembers.role,
      joinedAt: schema.teamMembers.joinedAt,
      teamName: schema.teams.name,
      teamSlug: schema.teams.slug,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
    .where(
      and(
        eq(schema.teamMembers.botId, botCtx.botId),
        isNull(schema.teamMembers.removedAt),
        isNull(schema.teams.deletedAt),
      ),
    )
    .all();

  return NextResponse.json({ teams: memberships });
}
