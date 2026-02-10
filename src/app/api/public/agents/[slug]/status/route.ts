import { eq, and, isNull } from "drizzle-orm";
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

  const agent = db
    .select({
      slug: schema.agents.slug,
      status: schema.agents.status,
      botId: schema.agents.botId,
      updatedAt: schema.agents.updatedAt,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.slug, slug),
        eq(schema.agents.visibility, "public"),
        isNull(schema.agents.deletedAt),
      ),
    )
    .get();

  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });

  let lastSeenAt: number | null = null;
  if (agent.botId) {
    const bot = db
      .select({ lastSeenAt: schema.bots.lastSeenAt })
      .from(schema.bots)
      .where(eq(schema.bots.id, agent.botId))
      .get();
    lastSeenAt = bot?.lastSeenAt ?? null;
  }

  return Response.json({
    slug: agent.slug,
    status: agent.status,
    lastSeenAt,
    updatedAt: agent.updatedAt,
  });
}
