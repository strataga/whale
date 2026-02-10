import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requirePublicApiAuth } from "@/lib/server/public-api-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await requirePublicApiAuth(req, "directory:write");
  if (ctx instanceof Response) return ctx;
  const { slug } = await params;

  const body = await req.json();
  const status = body.status as string;
  if (!["idle", "working", "offline"].includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const agent = db
    .select({ id: schema.agents.id, workspaceId: schema.agents.workspaceId })
    .from(schema.agents)
    .where(and(eq(schema.agents.slug, slug), isNull(schema.agents.deletedAt)))
    .get();

  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
  if (agent.workspaceId !== ctx.workspaceId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  db.update(schema.agents)
    .set({ status, updatedAt: now })
    .where(eq(schema.agents.id, agent.id))
    .run();

  return Response.json({ slug, status, updatedAt: now });
}
