import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { inviteUserSchema } from "@/lib/validators";
import { checkRole, getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

function generateTemporaryPassword() {
  // 18 bytes -> 24-ish chars base64url; comfortably above the 8-char minimum.
  return randomBytes(18).toString("base64url");
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rl = checkRateLimit(`users:invite:${ctx.userId}`, { limit: 10, windowMs: 3_600_000 });
  if (rl) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const invite = inviteUserSchema.parse(body);

    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invite.email))
      .get();

    if (existing) {
      return jsonError(409, "Email already registered");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hash(temporaryPassword, 12);
    const userId = crypto.randomUUID();

    db.insert(users)
      .values({
        id: userId,
        workspaceId: ctx.workspaceId,
        email: invite.email,
        passwordHash,
        name: invite.name,
        role: invite.role,
      })
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "user.invite",
      metadata: {
        invitedUserId: userId,
        email: invite.email,
        role: invite.role,
        name: invite.name,
      },
    });

    return NextResponse.json(
      { userId, temporaryPassword },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to invite user");
  }
}
