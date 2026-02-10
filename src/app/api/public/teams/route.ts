import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getPublicApiContext } from "@/lib/server/public-api-auth";

export async function GET(req: Request) {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;

  const teams = db
    .select({
      slug: schema.teams.slug,
      name: schema.teams.name,
      description: schema.teams.description,
      avatar: schema.teams.avatar,
      visibility: schema.teams.visibility,
      createdAt: schema.teams.createdAt,
    })
    .from(schema.teams)
    .where(
      and(eq(schema.teams.visibility, "public"), isNull(schema.teams.deletedAt)),
    )
    .all();

  return Response.json({ teams });
}
