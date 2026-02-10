import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/server/auth-context";
import {
  getAgent,
  updateAgent,
  deleteAgent,
} from "@/lib/server/agent-registry";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    type: z.enum(["local", "external", "hybrid"]).optional(),
    description: z.string().trim().max(5000).optional(),
    url: z.string().url().max(2000).nullable().optional(),
    status: z.string().trim().max(50).optional(),
    reputation: z.number().int().min(0).max(100).optional(),
    protocolVersion: z.string().trim().max(20).optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
    securitySchemes: z.record(z.string(), z.unknown()).optional(),
    verified: z.number().int().min(0).max(1).optional(),
    did: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/agents/:agentId
 *
 * Get agent details including skills.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = getAgent(db, agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify the agent belongs to the user's workspace
  if (agent.workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

/**
 * PATCH /api/agents/:agentId
 *
 * Update an agent's fields.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the agent exists and belongs to workspace
  const existing = getAgent(db, agentId);
  if (!existing || existing.workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
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

  try {
    const data = updateAgentSchema.parse(body);

    const updated = updateAgent(db, agentId, {
      name: data.name,
      type: data.type,
      description: data.description,
      url: data.url ?? undefined,
      status: data.status,
      reputation: data.reputation,
      protocolVersion: data.protocolVersion,
      capabilities: data.capabilities,
      securitySchemes: data.securitySchemes,
      verified: data.verified,
      did: data.did ?? undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update agent" },
        { status: 500 },
      );
    }

    // Re-fetch with skills
    const agent = getAgent(db, agentId);

    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/agents/:agentId
 *
 * Soft-delete an agent.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the agent exists and belongs to workspace
  const existing = getAgent(db, agentId);
  if (!existing || existing.workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  deleteAgent(db, agentId);

  return NextResponse.json({ ok: true });
}
