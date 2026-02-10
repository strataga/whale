export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { checkoutSessions } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { processCheckout } from "@/lib/server/checkout";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * GET /api/checkout/sessions/[id]
 * Retrieve checkout session details.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const session = db
    .select()
    .from(checkoutSessions)
    .where(and(eq(checkoutSessions.id, id), eq(checkoutSessions.workspaceId, ctx.workspaceId)))
    .get();

  if (!session) return jsonError(404, "Checkout session not found");

  return NextResponse.json({ session });
}

/**
 * PATCH /api/checkout/sessions/[id]
 * Update checkout session status (authorize, capture, settle, refund).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  // Verify session belongs to workspace
  const session = db
    .select()
    .from(checkoutSessions)
    .where(and(eq(checkoutSessions.id, id), eq(checkoutSessions.workspaceId, ctx.workspaceId)))
    .get();

  if (!session) return jsonError(404, "Checkout session not found");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const { action } = body as { action?: string };
  const validActions = ["authorize", "capture", "settle", "refund"];
  if (!action || !validActions.includes(action)) {
    return jsonError(400, `action must be one of: ${validActions.join(", ")}`);
  }

  const result = processCheckout(
    db,
    id,
    action as "authorize" | "capture" | "settle" | "refund",
  );

  if (!result.ok) {
    return jsonError(400, result.error ?? "Checkout action failed");
  }

  const updated = db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id))
    .get();

  return NextResponse.json({ session: updated });
}
