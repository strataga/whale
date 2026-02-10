import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requirePublicApiAuth } from "@/lib/server/public-api-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requirePublicApiAuth(req, "tasks:read");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const task = db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      sourceAgentId: schema.tasks.sourceAgentId,
      createdAt: schema.tasks.createdAt,
      updatedAt: schema.tasks.updatedAt,
    })
    .from(schema.tasks)
    .where(eq(schema.tasks.id, id))
    .get();

  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  // Get agent name if available
  let assignedAgent: string | null = null;
  if (task.sourceAgentId) {
    const agent = db
      .select({ name: schema.agents.name, slug: schema.agents.slug })
      .from(schema.agents)
      .where(eq(schema.agents.id, task.sourceAgentId))
      .get();
    assignedAgent = agent?.slug ?? null;
  }

  return Response.json({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignedAgent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  });
}
