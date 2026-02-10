import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { paymentDisputes } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { openDispute } from "@/lib/server/dispute-handler";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const disputes = db
    .select()
    .from(paymentDisputes)
    .where(eq(paymentDisputes.workspaceId, ctx.workspaceId))
    .orderBy(desc(paymentDisputes.createdAt))
    .all();

  return NextResponse.json({ disputes });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const { checkoutSessionId, x402TransactionId, reason } = body;

    if (!reason || typeof reason !== "string") {
      return jsonError(400, "reason is required");
    }

    if (!checkoutSessionId && !x402TransactionId) {
      return jsonError(400, "Either checkoutSessionId or x402TransactionId is required");
    }

    const disputeId = openDispute(db, {
      workspaceId: ctx.workspaceId,
      checkoutSessionId: checkoutSessionId ?? undefined,
      x402TransactionId: x402TransactionId ?? undefined,
      reason,
    });

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "dispute.open",
      metadata: { disputeId, checkoutSessionId, x402TransactionId },
    });

    const dispute = db
      .select()
      .from(paymentDisputes)
      .where(eq(paymentDisputes.id, disputeId))
      .get();

    return NextResponse.json({ dispute }, { status: 201 });
  } catch {
    return jsonError(400, "Invalid request body");
  }
}
