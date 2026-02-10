import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verify2faSchema } from "@/lib/validators";
import { getAuthContext } from "@/lib/server/auth-context";
import { verifyTOTP } from "@/lib/server/totp";
import { decrypt, isEncrypted } from "@/lib/crypto";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const user = db
    .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .get();

  if (!user) return jsonError(404, "User not found");

  if (!user.totpSecret) {
    return jsonError(400, "2FA setup not initiated. Call /api/auth/2fa/setup first.");
  }

  try {
    const body = await req.json();
    const data = verify2faSchema.parse(body);

    // Decrypt the TOTP secret (may be stored encrypted or plaintext)
    const storedSecret = user.totpSecret as string;
    const secret = isEncrypted(storedSecret) ? decrypt(storedSecret) : storedSecret;

    // Verify the TOTP code against the secret (allows +/-1 time step window)
    if (!verifyTOTP(secret, data.code)) {
      return jsonError(400, "Invalid verification code");
    }

    db.update(users)
      .set({ totpEnabled: 1, updatedAt: Date.now() })
      .where(eq(users.id, ctx.userId))
      .run();

    return NextResponse.json({ enabled: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to verify 2FA");
  }
}
