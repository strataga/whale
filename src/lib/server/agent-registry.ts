import { eq, and, like, isNull } from "drizzle-orm";
import { agents, agentSkills, bots, botSkills } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentType = "local" | "external" | "hybrid";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

interface CreateAgentData {
  name: string;
  type?: AgentType;
  description?: string;
  url?: string;
  botId?: string;
  protocolVersion?: string;
  capabilities?: Record<string, unknown>;
  securitySchemes?: Record<string, unknown>;
  did?: string;
}

interface UpdateAgentData {
  name?: string;
  type?: AgentType;
  description?: string;
  url?: string;
  status?: string;
  reputation?: number;
  protocolVersion?: string;
  capabilities?: Record<string, unknown>;
  securitySchemes?: Record<string, unknown>;
  verified?: number;
  did?: string;
  agentCardCache?: string;
  agentCardCachedAt?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createAgent(db: AnyDb, workspaceId: string, data: CreateAgentData) {
  const now = Date.now();
  const id = crypto.randomUUID();

  let name = data.name;
  let status = "offline";

  if ((data.type === "local" || !data.type) && data.botId) {
    const bot = db.select().from(bots).where(eq(bots.id, data.botId)).get();
    if (bot) {
      name = name || bot.name;
      status = bot.status;
    }
  }

  db.insert(agents)
    .values({
      id,
      workspaceId,
      type: data.type ?? "local",
      name,
      description: data.description ?? "",
      url: data.url ?? null,
      botId: data.botId ?? null,
      protocolVersion: data.protocolVersion ?? "0.3",
      capabilities: data.capabilities ? JSON.stringify(data.capabilities) : "{}",
      securitySchemes: data.securitySchemes ? JSON.stringify(data.securitySchemes) : "{}",
      did: data.did ?? null,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db.select().from(agents).where(eq(agents.id, id)).get()!;
}

export function getAgent(db: AnyDb, agentId: string) {
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
    .get();

  if (!agent) return null;

  const skills = db
    .select()
    .from(agentSkills)
    .where(eq(agentSkills.agentId, agentId))
    .all();

  return { ...agent, skills };
}

export function findAgentsBySkill(db: AnyDb, workspaceId: string, tag: string) {
  const matchingSkills = db
    .select({ agentId: agentSkills.agentId })
    .from(agentSkills)
    .where(like(agentSkills.tags, `%${tag}%`))
    .all();

  const agentIds = [...new Set(matchingSkills.map((s: { agentId: string }) => s.agentId))];
  if (agentIds.length === 0) return [];

  return db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.workspaceId, workspaceId),
        isNull(agents.deletedAt),
      ),
    )
    .all()
    .filter((a: { id: string }) => agentIds.includes(a.id));
}

export function findAgentsByType(db: AnyDb, workspaceId: string, type: AgentType) {
  return db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.workspaceId, workspaceId),
        eq(agents.type, type),
        isNull(agents.deletedAt),
      ),
    )
    .all();
}

export function updateAgent(db: AnyDb, agentId: string, data: UpdateAgentData) {
  const set: Record<string, unknown> = { updatedAt: Date.now() };

  if (data.name !== undefined) set.name = data.name;
  if (data.type !== undefined) set.type = data.type;
  if (data.description !== undefined) set.description = data.description;
  if (data.url !== undefined) set.url = data.url;
  if (data.status !== undefined) set.status = data.status;
  if (data.reputation !== undefined) set.reputation = data.reputation;
  if (data.protocolVersion !== undefined) set.protocolVersion = data.protocolVersion;
  if (data.capabilities !== undefined) set.capabilities = JSON.stringify(data.capabilities);
  if (data.securitySchemes !== undefined) set.securitySchemes = JSON.stringify(data.securitySchemes);
  if (data.verified !== undefined) set.verified = data.verified;
  if (data.did !== undefined) set.did = data.did;
  if (data.agentCardCache !== undefined) set.agentCardCache = data.agentCardCache;
  if (data.agentCardCachedAt !== undefined) set.agentCardCachedAt = data.agentCardCachedAt;

  db.update(agents).set(set).where(eq(agents.id, agentId)).run();

  return db.select().from(agents).where(eq(agents.id, agentId)).get() ?? null;
}

export function deleteAgent(db: AnyDb, agentId: string) {
  db.update(agents)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(agents.id, agentId))
    .run();
}

export function createAgentFromBot(db: AnyDb, workspaceId: string, botId: string) {
  const bot = db.select().from(bots).where(eq(bots.id, botId)).get();
  if (!bot) return null;

  const agent = createAgent(db, workspaceId, {
    name: bot.name,
    type: "local",
    botId,
  });

  migrateBotsSkillsToAgent(db, agent.id, botId);

  return getAgent(db, agent.id);
}

export function migrateBotsSkillsToAgent(db: AnyDb, agentId: string, botId: string) {
  const skills = db
    .select()
    .from(botSkills)
    .where(eq(botSkills.botId, botId))
    .all();

  const now = Date.now();

  for (const skill of skills) {
    db.insert(agentSkills)
      .values({
        id: crypto.randomUUID(),
        agentId,
        skillId: skill.id,
        name: skill.skillName,
        description: "",
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  return skills.length;
}

export function updateAgentReputation(db: AnyDb, agentId: string, delta: number) {
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) return null;

  const newReputation = clamp(agent.reputation + delta, 0, 100);

  db.update(agents)
    .set({ reputation: newReputation, updatedAt: Date.now() })
    .where(eq(agents.id, agentId))
    .run();

  return newReputation;
}
