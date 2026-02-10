import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { resetPasswordSchema } from "@/lib/validators";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = resetPasswordSchema.parse(body);

    const tokenHash = createHash("sha256").update(data.token).digest("hex");

    const resetToken = db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, Date.now()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .get();

    if (!resetToken) {
      return jsonError(400, "Invalid or expired reset token");
    }

    const passwordHash = await hash(data.newPassword, 12);

    db.update(users)
      .set({ passwordHash, updatedAt: Date.now() })
      .where(eq(users.id, resetToken.userId))
      .run();

    db.update(passwordResetTokens)
      .set({ usedAt: Date.now() })
      .where(eq(passwordResetTokens.id, resetToken.id))
      .run();

    return NextResponse.json({ reset: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to reset password");
  }
}
