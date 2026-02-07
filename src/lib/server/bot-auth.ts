import { compare } from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { bots, workspaces } from "@/lib/db/schema";
import { checkIpAllowlist } from "@/lib/server/ip-allowlist";

export type BotAuthContext = {
  botId: string;
  workspaceId: string;
};

const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

export async function getBotAuthContext(req: Request): Promise<BotAuthContext | null> {
  const allowlist = checkIpAllowlist(req);
  if (!allowlist.ok) return null;

  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;

  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  const tokenPrefix = token.slice(0, 8);

  if (!token || tokenPrefix.length !== 8) return null;

  const signatureOk = await verifySignedRequest(req, token);
  if (!signatureOk) return null;

  const requestDeviceId = req.headers.get("x-whale-device-id")?.trim();
  if (!requestDeviceId) return null;

  const candidates = db
    .select({
      id: bots.id,
      workspaceId: bots.workspaceId,
      tokenHash: bots.tokenHash,
      deviceId: bots.deviceId,
    })
    .from(bots)
    .where(eq(bots.tokenPrefix, tokenPrefix))
    .all();

  for (const candidate of candidates) {
    try {
      const ok = await compare(token, candidate.tokenHash);
      if (!ok) continue;

      if (candidate.deviceId && candidate.deviceId !== requestDeviceId) {
        continue;
      }

      const workspace = db
        .select({ ipAllowlist: workspaces.ipAllowlist })
        .from(workspaces)
        .where(eq(workspaces.id, candidate.workspaceId))
        .get();

      const workspaceAllowlist = checkIpAllowlist(req, workspace?.ipAllowlist ?? null);
      if (!workspaceAllowlist.ok) {
        return null;
      }

      if (!candidate.deviceId) {
        db.update(bots)
          .set({ deviceId: requestDeviceId, updatedAt: Date.now() })
          .where(eq(bots.id, candidate.id))
          .run();
      }

      return { botId: candidate.id, workspaceId: candidate.workspaceId };
    } catch {
      // Treat invalid hashes as non-matches.
    }
  }

  return null;
}

async function verifySignedRequest(req: Request, token: string): Promise<boolean> {
  const signature = req.headers.get("x-whale-signature")?.trim();
  const timestamp = req.headers.get("x-whale-timestamp")?.trim();

  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Date.now();
  if (Math.abs(now - ts) > SIGNATURE_WINDOW_MS) return false;

  const url = new URL(req.url);
  const body = req.method === "GET" || req.method === "HEAD" ? "" : await req.clone().text();

  const payload = `${timestamp}\n${req.method.toUpperCase()}\n${url.pathname}${url.search}\n${body}`;
  const expected = createHmac("sha256", token).update(payload).digest("hex");

  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
