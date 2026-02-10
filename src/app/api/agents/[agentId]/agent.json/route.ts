import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildAgentCard } from "@/lib/server/agent-card";

export const runtime = "nodejs";

/**
 * GET /api/agents/:agentId/agent.json
 *
 * Returns the A2A Agent Card for a specific agent.
 * This is the per-agent discovery endpoint.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  try {
    const card = buildAgentCard(db, agentId);

    if (!card) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(card, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to build agent card" },
      { status: 500 },
    );
  }
}
