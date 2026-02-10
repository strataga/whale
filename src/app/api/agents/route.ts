import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { agents, agentSkills } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createAgent } from "@/lib/server/agent-registry";
import { discoverAgent } from "@/lib/server/agent-discovery";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const createAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(["local", "external", "hybrid"]).optional(),
    description: z.string().trim().max(5000).optional(),
    url: z.string().url().max(2000).optional(),
    botId: z.string().uuid().optional(),
    protocolVersion: z.string().trim().max(20).optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
    securitySchemes: z.record(z.string(), z.unknown()).optional(),
    did: z.string().trim().max(500).optional(),
  })
  .strict();

const discoverAgentSchema = z
  .object({
    discoverUrl: z.string().url().max(2000),
  })
  .strict();

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/agents
 *
 * List all agents in the workspace. Supports filtering by type.
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");

  const allRows = db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.workspaceId, ctx.workspaceId),
        isNull(agents.deletedAt),
      ),
    )
    .all();

  let rows = allRows;

  if (typeFilter && ["local", "external", "hybrid"].includes(typeFilter)) {
    rows = rows.filter(
      (a: typeof agents.$inferSelect) => a.type === typeFilter,
    );
  }

  // Attach skills to each agent
  const result = rows.map((agent: typeof agents.$inferSelect) => {
    const skills = db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, agent.id))
      .all();

    return { ...agent, skills };
  });

  return NextResponse.json({ agents: result });
}

/**
 * POST /api/agents
 *
 * Create a new agent or discover an external agent by URL.
 *
 * If `discoverUrl` is provided in the body, discovers the agent from
 * its Agent Card endpoint instead of creating manually.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // Check if this is a discovery request
  const bodyObj = body as Record<string, unknown>;
  if (bodyObj && typeof bodyObj === "object" && "discoverUrl" in bodyObj) {
    try {
      const data = discoverAgentSchema.parse(body);
      const result = await discoverAgent(db, ctx.workspaceId, data.discoverUrl);

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const agent = db
        .select()
        .from(agents)
        .where(eq(agents.id, result.agentId))
        .get();

      const skills = agent
        ? db
            .select()
            .from(agentSkills)
            .where(eq(agentSkills.agentId, agent.id))
            .all()
        : [];

      return NextResponse.json(
        { agent: agent ? { ...agent, skills } : null },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid request body", details: err.issues },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Failed to discover agent" },
        { status: 500 },
      );
    }
  }

  // Regular agent creation
  try {
    const data = createAgentSchema.parse(body);

    const agent = createAgent(db, ctx.workspaceId, {
      name: data.name,
      type: data.type,
      description: data.description,
      url: data.url,
      botId: data.botId,
      protocolVersion: data.protocolVersion,
      capabilities: data.capabilities,
      securitySchemes: data.securitySchemes,
      did: data.did,
    });

    const skills = db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, agent.id))
      .all();

    return NextResponse.json(
      { agent: { ...agent, skills } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 },
    );
  }
}
