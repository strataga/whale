import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { costBudgets } from "@/lib/db/schema";
import { updateCostBudgetSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const budget = db.select().from(costBudgets).where(eq(costBudgets.id, id)).get();
  if (!budget) return jsonError(404, "Cost budget not found");

  return NextResponse.json({ budget });
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

  const existing = db.select({ id: costBudgets.id }).from(costBudgets).where(eq(costBudgets.id, id)).get();
  if (!existing) return jsonError(404, "Cost budget not found");

  try {
    const body = await req.json();
    const data = updateCostBudgetSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.monthlyLimitCents !== undefined) updates.monthlyLimitCents = data.monthlyLimitCents;
    if (data.alertThresholdPercent !== undefined) updates.alertThresholdPercent = data.alertThresholdPercent;
    if (data.currentSpendCents !== undefined) updates.currentSpendCents = data.currentSpendCents;

    db.update(costBudgets).set(updates).where(eq(costBudgets.id, id)).run();

    const budget = db.select().from(costBudgets).where(eq(costBudgets.id, id)).get();

    return NextResponse.json({ budget });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update cost budget");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const existing = db.select({ id: costBudgets.id }).from(costBudgets).where(eq(costBudgets.id, id)).get();
  if (!existing) return jsonError(404, "Cost budget not found");

  db.delete(costBudgets).where(eq(costBudgets.id, id)).run();

  return NextResponse.json({ deleted: true });
}
