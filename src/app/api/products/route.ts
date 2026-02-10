export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentProducts, agents } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * GET /api/products
 * List active products. Optionally filter by agentId query param.
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");

  // Build conditions: active products for agents in this workspace
  const workspaceAgents = db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.workspaceId, ctx.workspaceId))
    .all()
    .map((a) => a.id);

  if (workspaceAgents.length === 0) {
    return NextResponse.json({ products: [] });
  }

  let rows = db
    .select()
    .from(agentProducts)
    .where(eq(agentProducts.active, 1))
    .all();

  // Filter to workspace agents
  rows = rows.filter((r) => workspaceAgents.includes(r.agentId));

  // Filter by agentId if specified
  if (agentId) {
    rows = rows.filter((r) => r.agentId === agentId);
  }

  return NextResponse.json({ products: rows });
}

/**
 * POST /api/products
 * Create a new product in the ACP catalog.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const { agentId, skillId, name, description, priceCents, currency, pricingModel } = body as {
    agentId?: string;
    skillId?: string;
    name?: string;
    description?: string;
    priceCents?: number;
    currency?: string;
    pricingModel?: string;
  };

  if (!agentId || typeof agentId !== "string") {
    return jsonError(400, "agentId is required");
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return jsonError(400, "name is required");
  }
  if (priceCents === undefined || typeof priceCents !== "number" || priceCents < 0) {
    return jsonError(400, "priceCents must be a non-negative number");
  }

  // Verify the agent belongs to this workspace
  const agent = db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, ctx.workspaceId)))
    .get();

  if (!agent) return jsonError(404, "Agent not found in workspace");

  const validPricingModels = ["per_task", "per_minute", "flat", "subscription"];
  const model = pricingModel ?? "per_task";
  if (!validPricingModels.includes(model)) {
    return jsonError(400, `pricingModel must be one of: ${validPricingModels.join(", ")}`);
  }

  const id = crypto.randomUUID();
  db.insert(agentProducts)
    .values({
      id,
      agentId,
      skillId: skillId ?? null,
      name: name.trim(),
      description: description?.trim() ?? "",
      priceCents,
      currency: currency ?? "USD",
      pricingModel: model,
    })
    .run();

  const product = db.select().from(agentProducts).where(eq(agentProducts.id, id)).get();

  return NextResponse.json({ product }, { status: 201 });
}
