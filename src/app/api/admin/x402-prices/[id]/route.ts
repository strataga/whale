import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { x402Prices } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GET /api/admin/x402-prices/[id]
 * Returns a single x402 price. Admin only.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  const price = db
    .select()
    .from(x402Prices)
    .where(
      and(
        eq(x402Prices.id, id),
        eq(x402Prices.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!price) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ price });
}

/**
 * PATCH /api/admin/x402-prices/[id]
 * Updates an x402 price. Admin only.
 * Body: { routePattern?, amountUsdc?, network?, description?, agentSkillId? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  // Verify price exists and belongs to workspace
  const existing = db
    .select()
    .from(x402Prices)
    .where(
      and(
        eq(x402Prices.id, id),
        eq(x402Prices.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (typeof body.routePattern === "string" && body.routePattern.trim()) {
    updates.routePattern = body.routePattern.trim();
  }
  if (typeof body.amountUsdc === "string" && body.amountUsdc.trim()) {
    updates.amountUsdc = body.amountUsdc.trim();
  }
  if (typeof body.network === "string") {
    updates.network = body.network;
  }
  if (typeof body.description === "string") {
    updates.description = body.description;
  }
  if (body.agentSkillId === null || typeof body.agentSkillId === "string") {
    updates.agentSkillId = body.agentSkillId;
  }

  db.update(x402Prices)
    .set(updates)
    .where(eq(x402Prices.id, id))
    .run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "x402_price.update",
    metadata: { priceId: id, updates },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/x402-prices/[id]
 * Deletes an x402 price. Admin only.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  const existing = db
    .select()
    .from(x402Prices)
    .where(
      and(
        eq(x402Prices.id, id),
        eq(x402Prices.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.delete(x402Prices)
    .where(eq(x402Prices.id, id))
    .run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "x402_price.delete",
    metadata: { priceId: id },
  });

  return NextResponse.json({ ok: true });
}
