import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { pairingTokens } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPairingTokenSchema } from "@/lib/validators";
import { checkRole, getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`bots:pairing:${ctx.userId}`, { limit: 5, windowMs: 60_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    json = {};
  }

  try {
    createPairingTokenSchema.parse(json);

    const raw = randomBytes(32).toString("hex");
    const tokenHash = await hash(raw, 12);

    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;
    const id = crypto.randomUUID();

    db.insert(pairingTokens)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        tokenHash,
        expiresAt,
        consumedAt: null,
      })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot.pairing_token.create",
      metadata: { pairingTokenId: id, expiresAt },
    });

    return NextResponse.json({ pairingTokenId: id, token: raw, expiresAt }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to generate pairing token");
  }
}

