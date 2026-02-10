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
    .select({ id: schema.agents.id })
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

  const skills = db
    .select({
      skillId: schema.agentSkills.skillId,
      name: schema.agentSkills.name,
      description: schema.agentSkills.description,
      tags: schema.agentSkills.tags,
      priceCents: schema.agentSkills.priceCents,
      pricingModel: schema.agentSkills.pricingModel,
    })
    .from(schema.agentSkills)
    .where(eq(schema.agentSkills.agentId, agent.id))
    .all();

  return Response.json({
    skills: skills.map((s) => ({ ...s, tags: JSON.parse(s.tags) })),
  });
}
