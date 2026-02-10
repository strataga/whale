import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { buildHubAgentCard } from "@/lib/server/agent-card";

export const runtime = "nodejs";

/**
 * GET /.well-known/agent.json
 *
 * Returns the hub-level Agent Card for this Whale instance.
 * Uses the first workspace (single-tenant default) unless a
 * workspaceId query parameter is provided.
 */
export function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceIdParam = url.searchParams.get("workspaceId");

    let workspace: { id: string } | undefined;

    if (workspaceIdParam) {
      workspace = db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceIdParam))
        .get();
    } else {
      // Default: use the first workspace (single-tenant)
      workspace = db
        .select({ id: workspaces.id })
        .from(workspaces)
        .limit(1)
        .get();
    }

    if (!workspace) {
      return NextResponse.json(
        { error: "No workspace found" },
        { status: 404 },
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ?? `${url.protocol}//${url.host}`;

    const card = buildHubAgentCard(db, workspace.id, baseUrl);

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
