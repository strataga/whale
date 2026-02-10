import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { x402Prices } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GET /api/admin/x402-prices
 * Lists all x402 prices for the workspace. Admin only.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  const prices = db
    .select()
    .from(x402Prices)
    .where(eq(x402Prices.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({ prices });
}

/**
 * POST /api/admin/x402-prices
 * Creates a new x402 price entry. Admin only.
 * Body: { routePattern, amountUsdc, network?, description?, agentSkillId? }
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const routePattern = body.routePattern;
  const amountUsdc = body.amountUsdc;

  if (typeof routePattern !== "string" || !routePattern.trim()) {
    return NextResponse.json({ error: "routePattern is required" }, { status: 400 });
  }
  if (typeof amountUsdc !== "string" || !amountUsdc.trim()) {
    return NextResponse.json({ error: "amountUsdc is required" }, { status: 400 });
  }

  const network = typeof body.network === "string" ? body.network : "base";
  const description = typeof body.description === "string" ? body.description : "";
  const agentSkillId = typeof body.agentSkillId === "string" ? body.agentSkillId : null;

  const id = crypto.randomUUID();
  const now = Date.now();

  db.insert(x402Prices)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      routePattern: routePattern.trim(),
      amountUsdc: amountUsdc.trim(),
      network,
      description,
      agentSkillId,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "x402_price.create",
    metadata: { priceId: id, routePattern, amountUsdc },
  });

  return NextResponse.json({ id }, { status: 201 });
}
