import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getPublicApiContext } from "@/lib/server/public-api-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;
  const { slug } = await params;

  const team = db
    .select({
      slug: schema.teams.slug,
      name: schema.teams.name,
      description: schema.teams.description,
      avatar: schema.teams.avatar,
      visibility: schema.teams.visibility,
      id: schema.teams.id,
      createdAt: schema.teams.createdAt,
    })
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.slug, slug),
        eq(schema.teams.visibility, "public"),
        isNull(schema.teams.deletedAt),
      ),
    )
    .get();

  if (!team) return Response.json({ error: "Team not found" }, { status: 404 });

  const memberCount = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.teamId, team.id), isNull(schema.teamMembers.removedAt)))
    .get()!.count;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...publicTeam } = team;

  return Response.json({ ...publicTeam, memberCount });
}
