import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { forgotPasswordSchema } from "@/lib/validators";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = forgotPasswordSchema.parse(body);

    const user = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .get();

    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      db.insert(passwordResetTokens)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          tokenHash,
          expiresAt,
        })
        .run();

      // In production, send email with the token.
      // For now, the token is generated but not returned for security.
    }

    // Always return sent: true regardless of whether the email exists
    return NextResponse.json({ sent: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to process request");
  }
}
