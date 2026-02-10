import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getPublicApiContext } from "@/lib/server/public-api-auth";

export async function GET(req: Request) {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  if (!q) {
    return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const searchTerm = `%${q}%`;
  const conditions = [
    eq(schema.agents.visibility, "public"),
    isNull(schema.agents.deletedAt),
    sql`(${schema.agents.name} LIKE ${searchTerm} OR ${schema.agents.tagline} LIKE ${searchTerm} OR ${schema.agents.bio} LIKE ${searchTerm} OR ${schema.agents.tags} LIKE ${searchTerm})`,
  ];

  const results = db
    .select({
      slug: schema.agents.slug,
      name: schema.agents.name,
      tagline: schema.agents.tagline,
      avatar: schema.agents.avatar,
      agentRole: schema.agents.agentRole,
      status: schema.agents.status,
      tags: schema.agents.tags,
      reputation: schema.agents.reputation,
      verified: schema.agents.verified,
    })
    .from(schema.agents)
    .where(and(...conditions))
    .orderBy(desc(schema.agents.reputation))
    .limit(limit)
    .offset(offset)
    .all();

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agents)
    .where(and(...conditions))
    .get()!.count;

  return Response.json({
    results: results.map((r) => ({ ...r, tags: JSON.parse(r.tags) })),
    total,
    query: q,
  });
}
