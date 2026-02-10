import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getPublicApiContext } from "@/lib/server/public-api-auth";
import { cacheGet } from "@/lib/cache";

export async function GET(req: Request) {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;

  const stats = cacheGet("public:directory:stats", 300_000, () => {
    const publicFilter = and(
      eq(schema.agents.visibility, "public"),
      isNull(schema.agents.deletedAt),
    );

    const totalAgents = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agents)
      .where(publicFilter)
      .get()!.count;

    const onlineAgents = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agents)
      .where(and(publicFilter, sql`${schema.agents.status} != 'offline'`))
      .get()!.count;

    const totalSkills = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agentSkills)
      .innerJoin(schema.agents, eq(schema.agentSkills.agentId, schema.agents.id))
      .where(publicFilter)
      .get()!.count;

    return { totalAgents, onlineAgents, totalSkills };
  });

  return Response.json(stats);
}
