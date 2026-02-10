import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { paymentDisputes } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { resolveDispute } from "@/lib/server/dispute-handler";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const dispute = db
    .select()
    .from(paymentDisputes)
    .where(
      and(
        eq(paymentDisputes.id, id),
        eq(paymentDisputes.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!dispute) return jsonError(404, "Dispute not found");

  return NextResponse.json({ dispute });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const dispute = db
    .select()
    .from(paymentDisputes)
    .where(
      and(
        eq(paymentDisputes.id, id),
        eq(paymentDisputes.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!dispute) return jsonError(404, "Dispute not found");

  try {
    const body = await req.json();
    const { status, evidence } = body;

    // If resolving the dispute, use the dispute handler
    if (status === "resolved_buyer" || status === "resolved_seller") {
      const resolved = resolveDispute(db, id, status, ctx.userId);
      if (!resolved) return jsonError(400, "Could not resolve dispute");

      logAudit({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        action: "dispute.resolve",
        metadata: { disputeId: id, resolution: status },
      });

      const updated = db
        .select()
        .from(paymentDisputes)
        .where(eq(paymentDisputes.id, id))
        .get();

      return NextResponse.json({ dispute: updated });
    }

    // Otherwise, update evidence or other fields
    const set: Record<string, unknown> = { updatedAt: Date.now() };

    if (evidence && typeof evidence === "object") {
      set.evidence = JSON.stringify(evidence);
    }

    if (status && typeof status === "string") {
      set.status = status;
    }

    db.update(paymentDisputes)
      .set(set)
      .where(eq(paymentDisputes.id, id))
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "dispute.update",
      metadata: { disputeId: id, fields: Object.keys(body) },
    });

    const updated = db
      .select()
      .from(paymentDisputes)
      .where(eq(paymentDisputes.id, id))
      .get();

    return NextResponse.json({ dispute: updated });
  } catch {
    return jsonError(400, "Invalid request body");
  }
}
