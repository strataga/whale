export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { paymentProviders } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { encrypt } from "@/lib/crypto";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * GET /api/payment-providers
 * List payment providers for the authenticated workspace.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rows = db
    .select({
      id: paymentProviders.id,
      type: paymentProviders.type,
      name: paymentProviders.name,
      isDefault: paymentProviders.isDefault,
      status: paymentProviders.status,
      createdAt: paymentProviders.createdAt,
      updatedAt: paymentProviders.updatedAt,
    })
    .from(paymentProviders)
    .where(eq(paymentProviders.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({ providers: rows });
}

/**
 * POST /api/payment-providers
 * Create a new payment provider. Config is encrypted before storage.
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

  const { type, name, config } = body as {
    type?: string;
    name?: string;
    config?: Record<string, unknown>;
  };

  if (!type || !["stripe", "x402", "manual"].includes(type)) {
    return jsonError(400, "type must be one of: stripe, x402, manual");
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return jsonError(400, "name is required");
  }

  const configStr = JSON.stringify(config ?? {});
  const encryptedConfig = encrypt(configStr);

  const id = crypto.randomUUID();
  db.insert(paymentProviders)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      type,
      name: name.trim(),
      configEncrypted: encryptedConfig,
    })
    .run();

  const provider = db
    .select()
    .from(paymentProviders)
    .where(eq(paymentProviders.id, id))
    .get();

  return NextResponse.json({ provider }, { status: 201 });
}
