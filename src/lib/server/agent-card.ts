import { eq, and, isNull } from "drizzle-orm";

import { agents, agentSkills } from "@/lib/db/schema";
import type {
  A2AAgentCard,
  A2AAgentSkill,
  A2ACapabilities,
  A2ASecurityScheme,
  A2ASkillPrice,
} from "@/types/a2a";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

// ── Helpers ──

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapSkillRow(row: typeof agentSkills.$inferSelect): A2AAgentSkill {
  const skill: A2AAgentSkill = {
    id: row.skillId,
    name: row.name,
    description: row.description,
  };

  const inputModes = parseJson<string[]>(row.inputModes, []);
  if (inputModes.length > 0) skill.inputModes = inputModes;

  const outputModes = parseJson<string[]>(row.outputModes, []);
  if (outputModes.length > 0) skill.outputModes = outputModes;

  const tags = parseJson<string[]>(row.tags, []);
  if (tags.length > 0) skill.tags = tags;

  const examples = parseJson<string[]>(row.examples, []);
  if (examples.length > 0) skill.examples = examples;

  if (row.priceCents != null) {
    skill.price = {
      amount: row.priceCents,
      currency: "USD",
      model: (row.pricingModel ?? "free") as A2ASkillPrice["model"],
    };
  }

  return skill;
}

// ── Public API ──

export function buildAgentCard(db: AnyDb, agentId: string): A2AAgentCard | null {
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
    .get();

  if (!agent) return null;

  const skillRows = db
    .select()
    .from(agentSkills)
    .where(eq(agentSkills.agentId, agentId))
    .all();

  const capabilities = parseJson<A2ACapabilities>(agent.capabilities, {});
  const securitySchemes = parseJson<Record<string, A2ASecurityScheme>>(
    agent.securitySchemes,
    {},
  );

  const url =
    agent.url ??
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/a2a/agents/${agent.id}`;

  const card: A2AAgentCard = {
    name: agent.name,
    description: agent.description,
    url,
    version: "1.0.0",
    protocolVersion: agent.protocolVersion,
    capabilities,
    skills: skillRows.map(mapSkillRow),
  };

  if (Object.keys(securitySchemes).length > 0) {
    card.securitySchemes = securitySchemes;
  }

  return card;
}

export function buildHubAgentCard(
  db: AnyDb,
  workspaceId: string,
  baseUrl: string,
): A2AAgentCard {
  const localAgents = db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.workspaceId, workspaceId),
        eq(agents.type, "local"),
        isNull(agents.deletedAt),
      ),
    )
    .all();

  const agentIds = localAgents.map((a: { id: string }) => a.id);

  const allSkills: A2AAgentSkill[] = [];
  for (const id of agentIds) {
    const skillRows = db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, id))
      .all();
    allSkills.push(...skillRows.map(mapSkillRow));
  }

  return {
    name: "Whale Hub",
    description:
      "Aggregated agent card for all locally-hosted agents in this Whale workspace.",
    url: baseUrl,
    version: "1.0.0",
    protocolVersion: "0.3",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: allSkills,
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain", "application/json"],
  };
}
