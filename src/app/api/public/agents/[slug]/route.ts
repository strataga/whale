import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getPublicApiContext, requirePublicApiAuth } from "@/lib/server/public-api-auth";
import { cacheGet, invalidateCachePrefix } from "@/lib/cache";
import { updateAgentProfileSchema } from "@/lib/validators";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;
  const { slug } = await params;

  const cacheKey = `public:agent:${slug}`;
  const agent = cacheGet(cacheKey, 60_000, () => {
    return db
      .select({
        slug: schema.agents.slug,
        name: schema.agents.name,
        description: schema.agents.description,
        tagline: schema.agents.tagline,
        bio: schema.agents.bio,
        avatar: schema.agents.avatar,
        agentRole: schema.agents.agentRole,
        status: schema.agents.status,
        tags: schema.agents.tags,
        reputation: schema.agents.reputation,
        verified: schema.agents.verified,
        featured: schema.agents.featured,
        hourlyRate: schema.agents.hourlyRate,
        currency: schema.agents.currency,
        timezone: schema.agents.timezone,
        links: schema.agents.links,
        id: schema.agents.id,
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
  });

  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  // ETag support
  const etag = `"${agent.updatedAt}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  // Fetch skills
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...publicAgent } = agent;

  return Response.json(
    {
      ...publicAgent,
      tags: JSON.parse(agent.tags),
      links: JSON.parse(agent.links),
      skills: skills.map((s) => ({ ...s, tags: JSON.parse(s.tags) })),
    },
    { headers: { ETag: etag } },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await requirePublicApiAuth(req, "directory:write");
  if (ctx instanceof Response) return ctx;
  const { slug } = await params;

  const agent = db
    .select({ id: schema.agents.id, workspaceId: schema.agents.workspaceId })
    .from(schema.agents)
    .where(and(eq(schema.agents.slug, slug), isNull(schema.agents.deletedAt)))
    .get();

  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
  if (agent.workspaceId !== ctx.workspaceId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateAgentProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  const d = parsed.data;
  if (d.slug !== undefined) updates.slug = d.slug;
  if (d.tagline !== undefined) updates.tagline = d.tagline;
  if (d.bio !== undefined) updates.bio = d.bio;
  if (d.avatar !== undefined) updates.avatar = d.avatar;
  if (d.agentRole !== undefined) updates.agentRole = d.agentRole;
  if (d.visibility !== undefined) updates.visibility = d.visibility;
  if (d.tags !== undefined) updates.tags = JSON.stringify(d.tags);
  if (d.hourlyRate !== undefined) updates.hourlyRate = d.hourlyRate;
  if (d.currency !== undefined) updates.currency = d.currency;
  if (d.timezone !== undefined) updates.timezone = d.timezone;
  if (d.links !== undefined) updates.links = JSON.stringify(d.links);

  db.update(schema.agents)
    .set(updates)
    .where(eq(schema.agents.id, agent.id))
    .run();

  invalidateCachePrefix("public:agent");
  invalidateCachePrefix("public:agents");

  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await requirePublicApiAuth(req, "directory:write");
  if (ctx instanceof Response) return ctx;
  const { slug } = await params;

  const agent = db
    .select({ id: schema.agents.id, workspaceId: schema.agents.workspaceId })
    .from(schema.agents)
    .where(and(eq(schema.agents.slug, slug), isNull(schema.agents.deletedAt)))
    .get();

  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
  if (agent.workspaceId !== ctx.workspaceId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  db.update(schema.agents)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(schema.agents.id, agent.id))
    .run();

  invalidateCachePrefix("public:agent");
  invalidateCachePrefix("public:agents");

  return Response.json({ ok: true });
}
