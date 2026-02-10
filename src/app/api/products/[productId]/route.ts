export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentProducts, agents } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Helper: verify product belongs to workspace */
function getProductForWorkspace(productId: string, workspaceId: string) {
  const product = db
    .select()
    .from(agentProducts)
    .where(eq(agentProducts.id, productId))
    .get();

  if (!product) return null;

  // Confirm the agent belongs to this workspace
  const agent = db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, product.agentId), eq(agents.workspaceId, workspaceId)))
    .get();

  if (!agent) return null;
  return product;
}

/**
 * GET /api/products/[productId]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const product = getProductForWorkspace(productId, ctx.workspaceId);
  if (!product) return jsonError(404, "Product not found");

  return NextResponse.json({ product });
}

/**
 * PATCH /api/products/[productId]
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const existing = getProductForWorkspace(productId, ctx.workspaceId);
  if (!existing) return jsonError(404, "Product not found");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || (body.name as string).trim().length === 0) {
      return jsonError(400, "name must be a non-empty string");
    }
    updates.name = (body.name as string).trim();
  }

  if (body.description !== undefined) {
    updates.description = String(body.description);
  }

  if (body.priceCents !== undefined) {
    if (typeof body.priceCents !== "number" || body.priceCents < 0) {
      return jsonError(400, "priceCents must be a non-negative number");
    }
    updates.priceCents = body.priceCents;
  }

  if (body.currency !== undefined) {
    updates.currency = String(body.currency);
  }

  if (body.pricingModel !== undefined) {
    const validModels = ["per_task", "per_minute", "flat", "subscription"];
    if (!validModels.includes(body.pricingModel as string)) {
      return jsonError(400, `pricingModel must be one of: ${validModels.join(", ")}`);
    }
    updates.pricingModel = body.pricingModel;
  }

  if (body.active !== undefined) {
    updates.active = body.active ? 1 : 0;
  }

  if (body.skillId !== undefined) {
    updates.skillId = body.skillId;
  }

  db.update(agentProducts).set(updates).where(eq(agentProducts.id, productId)).run();

  const updated = db.select().from(agentProducts).where(eq(agentProducts.id, productId)).get();

  return NextResponse.json({ product: updated });
}

/**
 * DELETE /api/products/[productId]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const existing = getProductForWorkspace(productId, ctx.workspaceId);
  if (!existing) return jsonError(404, "Product not found");

  db.delete(agentProducts).where(eq(agentProducts.id, productId)).run();

  return NextResponse.json({ success: true });
}
