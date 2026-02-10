import { eq, and, isNull, desc } from "drizzle-orm";

import * as schema from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

export function assignTaskToAgent(
  db: AnyDb,
  taskId: string,
  agentId: string,
): { ok: true; botTaskId?: string } | { ok: false; error: string } {
  const agent = db
    .select()
    .from(schema.agents)
    .where(and(eq(schema.agents.id, agentId), isNull(schema.agents.deletedAt)))
    .get();

  if (!agent) {
    return { ok: false, error: "Agent not found" };
  }

  const now = Date.now();

  if (agent.type === "local") {
    if (!agent.botId) {
      return { ok: false, error: "Local agent has no linked bot" };
    }

    const botTaskId = crypto.randomUUID();

    db.insert(schema.botTasks)
      .values({
        id: botTaskId,
        botId: agent.botId,
        taskId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.update(schema.tasks)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(schema.tasks.id, taskId))
      .run();

    return { ok: true, botTaskId };
  }

  // external or hybrid — A2A delegation happens via the gateway
  db.update(schema.tasks)
    .set({ status: "negotiating", updatedAt: now })
    .where(eq(schema.tasks.id, taskId))
    .run();

  return { ok: true };
}

export function findBestAgent(
  db: AnyDb,
  workspaceId: string,
  skillTag: string,
): string | null {
  const rows = db
    .select({ agentId: schema.agents.id })
    .from(schema.agents)
    .innerJoin(
      schema.agentSkills,
      eq(schema.agentSkills.agentId, schema.agents.id),
    )
    .where(
      and(
        eq(schema.agents.workspaceId, workspaceId),
        isNull(schema.agents.deletedAt),
      ),
    )
    .orderBy(desc(schema.agents.reputation))
    .all();

  for (const row of rows) {
    const skills = db
      .select({ tags: schema.agentSkills.tags })
      .from(schema.agentSkills)
      .where(eq(schema.agentSkills.agentId, row.agentId))
      .all();

    for (const skill of skills) {
      try {
        const tags: string[] = JSON.parse(skill.tags);
        if (tags.includes(skillTag)) {
          return row.agentId;
        }
      } catch {
        // malformed tags — skip
      }
    }
  }

  return null;
}

export function getAgentForBotTask(
  db: AnyDb,
  botTaskId: string,
): { agentId: string; type: string } | null {
  const botTask = db
    .select({ botId: schema.botTasks.botId })
    .from(schema.botTasks)
    .where(eq(schema.botTasks.id, botTaskId))
    .get();

  if (!botTask) return null;

  const agent = db
    .select({ id: schema.agents.id, type: schema.agents.type })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.botId, botTask.botId),
        isNull(schema.agents.deletedAt),
      ),
    )
    .get();

  if (!agent) return null;

  return { agentId: agent.id, type: agent.type };
}
