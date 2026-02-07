import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, pairingTokens, workspaces } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerBotSchema } from "@/lib/validators";
import { checkIpAllowlist } from "@/lib/server/ip-allowlist";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  const allowlist = checkIpAllowlist(req);
  if (!allowlist.ok) {
    return jsonError(403, allowlist.error);
  }

  // Rate limit by IP (via x-forwarded-for or fallback)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`bots:register:${ip}`, { limit: 10, windowMs: 60_000 });
  if (rl) {
    return jsonError(rl.status, rl.error, { retryAfter: rl.retryAfter });
  }

  try {
    const body = await req.json();
    const data = registerBotSchema.parse(body);

    const now = Date.now();

    const candidates = db
      .select({
        id: pairingTokens.id,
        workspaceId: pairingTokens.workspaceId,
        tokenHash: pairingTokens.tokenHash,
      })
      .from(pairingTokens)
      .where(and(isNull(pairingTokens.consumedAt), gt(pairingTokens.expiresAt, now)))
      .all();

    let matched: { id: string; workspaceId: string } | null = null;
    for (const candidate of candidates) {
      if (await compare(data.pairingToken, candidate.tokenHash)) {
        matched = { id: candidate.id, workspaceId: candidate.workspaceId };
        break;
      }
    }

    if (!matched) {
      return jsonError(401, "Invalid or expired pairing token");
    }

    const workspace = db
      .select({ ipAllowlist: workspaces.ipAllowlist })
      .from(workspaces)
      .where(eq(workspaces.id, matched.workspaceId))
      .get();

    const workspaceAllowlist = checkIpAllowlist(req, workspace?.ipAllowlist ?? null);
    if (!workspaceAllowlist.ok) {
      return jsonError(403, workspaceAllowlist.error);
    }

    const deviceToken = randomBytes(64).toString("hex");
    const tokenPrefix = deviceToken.slice(0, 8);
    const tokenHash = await hash(deviceToken, 12);

    const consumeRes = db
      .update(pairingTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(pairingTokens.id, matched.id),
          isNull(pairingTokens.consumedAt),
          gt(pairingTokens.expiresAt, now),
        ),
      )
      .run();

    if (!consumeRes.changes) {
      return jsonError(409, "Pairing token already consumed or expired");
    }

    const botId = crypto.randomUUID();

    db.insert(bots)
      .values({
        id: botId,
        workspaceId: matched.workspaceId,
        name: data.name,
        host: data.host,
        deviceId: data.deviceId,
        status: "online",
        capabilities: JSON.stringify(data.capabilities ?? []),
        lastSeenAt: now,
        tokenPrefix,
        tokenHash,
      })
      .run();

    logAudit({
      workspaceId: matched.workspaceId,
      userId: null,
      action: "bot.register",
      metadata: { botId, name: data.name, host: data.host },
    });

    return NextResponse.json({ botId, token: deviceToken }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}

