export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { paymentProviders } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { encrypt, decrypt } from "@/lib/crypto";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * GET /api/payment-providers/[id]
 * Retrieve a single payment provider (config is decrypted for display).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const provider = db
    .select()
    .from(paymentProviders)
    .where(and(eq(paymentProviders.id, id), eq(paymentProviders.workspaceId, ctx.workspaceId)))
    .get();

  if (!provider) return jsonError(404, "Payment provider not found");

  return NextResponse.json({
    provider: {
      ...provider,
      config: JSON.parse(decrypt(provider.configEncrypted)),
      configEncrypted: undefined,
    },
  });
}

/**
 * PATCH /api/payment-providers/[id]
 * Update a payment provider.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const existing = db
    .select()
    .from(paymentProviders)
    .where(and(eq(paymentProviders.id, id), eq(paymentProviders.workspaceId, ctx.workspaceId)))
    .get();

  if (!existing) return jsonError(404, "Payment provider not found");

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

  if (body.type !== undefined) {
    if (!["stripe", "x402", "manual"].includes(body.type as string)) {
      return jsonError(400, "type must be one of: stripe, x402, manual");
    }
    updates.type = body.type;
  }

  if (body.config !== undefined) {
    updates.configEncrypted = encrypt(JSON.stringify(body.config));
  }

  if (body.isDefault !== undefined) {
    updates.isDefault = body.isDefault ? 1 : 0;
  }

  if (body.status !== undefined) {
    if (!["active", "inactive"].includes(body.status as string)) {
      return jsonError(400, "status must be one of: active, inactive");
    }
    updates.status = body.status;
  }

  db.update(paymentProviders).set(updates).where(eq(paymentProviders.id, id)).run();

  const updated = db.select().from(paymentProviders).where(eq(paymentProviders.id, id)).get();

  return NextResponse.json({ provider: updated });
}

/**
 * DELETE /api/payment-providers/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const existing = db
    .select()
    .from(paymentProviders)
    .where(and(eq(paymentProviders.id, id), eq(paymentProviders.workspaceId, ctx.workspaceId)))
    .get();

  if (!existing) return jsonError(404, "Payment provider not found");

  db.delete(paymentProviders).where(eq(paymentProviders.id, id)).run();

  return NextResponse.json({ success: true });
}
