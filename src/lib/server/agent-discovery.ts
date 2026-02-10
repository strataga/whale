import { eq, and, isNull } from "drizzle-orm";

import { agents, agentSkills } from "@/lib/db/schema";
import type { A2AAgentCard, A2AAgentSkill } from "@/types/a2a";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

const AGENT_CARD_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUrl(url: string): string {
  // Ensure the URL ends without trailing slash
  return url.replace(/\/+$/, "");
}

function isValidAgentCard(card: unknown): card is A2AAgentCard {
  if (!card || typeof card !== "object") return false;

  const c = card as Record<string, unknown>;

  if (typeof c.name !== "string" || !c.name) return false;
  if (typeof c.description !== "string") return false;
  if (typeof c.url !== "string" || !c.url) return false;
  if (typeof c.version !== "string") return false;
  if (typeof c.protocolVersion !== "string") return false;
  if (!Array.isArray(c.skills)) return false;

  return true;
}

function storeSkills(db: AnyDb, agentId: string, skills: A2AAgentSkill[]) {
  const now = Date.now();

  // Remove existing skills
  db.delete(agentSkills).where(eq(agentSkills.agentId, agentId)).run();

  for (const skill of skills) {
    db.insert(agentSkills)
      .values({
        id: crypto.randomUUID(),
        agentId,
        skillId: skill.id,
        name: skill.name,
        description: skill.description ?? "",
        inputModes: JSON.stringify(skill.inputModes ?? []),
        outputModes: JSON.stringify(skill.outputModes ?? []),
        tags: JSON.stringify(skill.tags ?? []),
        examples: JSON.stringify(skill.examples ?? []),
        priceCents: skill.price?.amount ?? null,
        pricingModel: skill.price?.model ?? "free",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover an external agent by fetching its Agent Card from
 * `<url>/.well-known/agent.json`. Validates the card structure and
 * stores the agent in the registry.
 */
export async function discoverAgent(
  db: AnyDb,
  workspaceId: string,
  url: string,
): Promise<{ agentId: string } | { error: string }> {
  const baseUrl = normalizeUrl(url);
  const agentCardUrl = `${baseUrl}/.well-known/agent.json`;

  let response: Response;
  try {
    response = await fetch(agentCardUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Failed to fetch agent card from ${agentCardUrl}: ${message}` };
  }

  if (!response.ok) {
    return {
      error: `Agent card endpoint returned status ${response.status}`,
    };
  }

  let card: unknown;
  try {
    card = await response.json();
  } catch {
    return { error: "Failed to parse agent card JSON" };
  }

  if (!isValidAgentCard(card)) {
    return { error: "Invalid agent card structure" };
  }

  // Check if an agent with this URL already exists
  const existing = db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.workspaceId, workspaceId),
        eq(agents.url, card.url),
        isNull(agents.deletedAt),
      ),
    )
    .get();

  const now = Date.now();

  if (existing) {
    // Update existing agent
    db.update(agents)
      .set({
        name: card.name,
        description: card.description,
        protocolVersion: card.protocolVersion,
        capabilities: JSON.stringify(card.capabilities ?? {}),
        securitySchemes: card.securitySchemes
          ? JSON.stringify(card.securitySchemes)
          : "{}",
        agentCardCache: JSON.stringify(card),
        agentCardCachedAt: now,
        status: "online",
        updatedAt: now,
      })
      .where(eq(agents.id, existing.id))
      .run();

    storeSkills(db, existing.id, card.skills);

    return { agentId: existing.id };
  }

  // Create new external agent
  const agentId = crypto.randomUUID();

  db.insert(agents)
    .values({
      id: agentId,
      workspaceId,
      type: "external",
      name: card.name,
      description: card.description,
      url: card.url,
      protocolVersion: card.protocolVersion,
      capabilities: JSON.stringify(card.capabilities ?? {}),
      securitySchemes: card.securitySchemes
        ? JSON.stringify(card.securitySchemes)
        : "{}",
      agentCardCache: JSON.stringify(card),
      agentCardCachedAt: now,
      status: "online",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  storeSkills(db, agentId, card.skills);

  return { agentId };
}

/**
 * Re-fetch and update the cached Agent Card for an agent.
 * Returns true if the refresh succeeded, false otherwise.
 */
export async function refreshAgentCard(
  db: AnyDb,
  agentId: string,
): Promise<boolean> {
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
    .get();

  if (!agent) return false;
  if (!agent.url) return false;

  // Check if the cache is still fresh
  if (
    agent.agentCardCachedAt &&
    Date.now() - agent.agentCardCachedAt < AGENT_CARD_TTL_MS
  ) {
    return true; // Cache is still valid
  }

  const baseUrl = normalizeUrl(agent.url);
  const agentCardUrl = `${baseUrl}/.well-known/agent.json`;

  let response: Response;
  try {
    response = await fetch(agentCardUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return false;
  }

  if (!response.ok) return false;

  let card: unknown;
  try {
    card = await response.json();
  } catch {
    return false;
  }

  if (!isValidAgentCard(card)) return false;

  const now = Date.now();

  db.update(agents)
    .set({
      name: card.name,
      description: card.description,
      protocolVersion: card.protocolVersion,
      capabilities: JSON.stringify(card.capabilities ?? {}),
      securitySchemes: card.securitySchemes
        ? JSON.stringify(card.securitySchemes)
        : "{}",
      agentCardCache: JSON.stringify(card),
      agentCardCachedAt: now,
      updatedAt: now,
    })
    .where(eq(agents.id, agentId))
    .run();

  storeSkills(db, agentId, card.skills);

  return true;
}
