import { eq, and, sql, isNull, desc, asc, like } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getPublicApiContext, requirePublicApiAuth } from "@/lib/server/public-api-auth";
import { cacheGet, invalidateCachePrefix } from "@/lib/cache";
import { registerAgentSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort") ?? "reputation";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const cacheKey = `public:agents:${tag}:${role}:${status}:${sort}:${limit}:${offset}`;

  const result = cacheGet(cacheKey, 30_000, () => {
    const conditions = [
      eq(schema.agents.visibility, "public"),
      isNull(schema.agents.deletedAt),
    ];
    if (role) conditions.push(eq(schema.agents.agentRole, role));
    if (status) conditions.push(eq(schema.agents.status, status));
    if (tag) conditions.push(like(schema.agents.tags, `%${tag}%`));

    const orderBy =
      sort === "name" ? asc(schema.agents.name) :
      sort === "featured" ? desc(schema.agents.featured) :
      desc(schema.agents.reputation);

    const rows = db
      .select({
        slug: schema.agents.slug,
        name: schema.agents.name,
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
      })
      .from(schema.agents)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)
      .all();

    const total = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agents)
      .where(and(...conditions))
      .get()!.count;

    return {
      agents: rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) })),
      total,
      limit,
      offset,
    };
  });

  return Response.json(result);
}

export async function POST(req: Request) {
  const ctx = await requirePublicApiAuth(req, "directory:write");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = registerAgentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, name, slug, tagline, tags, visibility } = parsed.data;
  const now = Date.now();

  // Check slug uniqueness
  const existing = db
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .where(eq(schema.agents.slug, slug))
    .get();
  if (existing) {
    return Response.json({ error: "Slug already taken" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  db.insert(schema.agents)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      type: "external",
      name,
      url,
      slug,
      tagline: tagline ?? "",
      tags: JSON.stringify(tags ?? []),
      visibility: visibility ?? "public",
      status: "offline",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  invalidateCachePrefix("public:agents");

  return Response.json({ id, slug, name }, { status: 201 });
}
