import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const user = db
    .select({ email: users.email, totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .get();

  if (!user) return jsonError(404, "User not found");

  if (user.totpEnabled) {
    return jsonError(400, "2FA is already enabled");
  }

  const secret = randomBytes(20).toString("hex");
  const encryptedSecret = encrypt(secret);

  db.update(users)
    .set({ totpSecret: encryptedSecret, updatedAt: Date.now() })
    .where(eq(users.id, ctx.userId))
    .run();

  const email = user.email;
  const provisioningUri = `otpauth://totp/Whale:${encodeURIComponent(email)}?secret=${secret}&issuer=Whale`;

  return NextResponse.json({ secret, provisioningUri });
}
