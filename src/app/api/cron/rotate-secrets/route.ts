import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { botCommands, botSecrets } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { verifyCronSecret } from "@/lib/server/cron-auth";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  if (!isCron) {
    const ctx = await getAuthContext();
    if (!ctx) return jsonError(401, "Unauthorized");
    const roleCheck = checkRole(ctx, "admin");
    if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);
  }

  const now = Date.now();

  // Find secrets due for rotation (all workspaces in cron mode)
  const dueSecrets = db
    .select()
    .from(botSecrets)
    .where(
      and(
        isNotNull(botSecrets.rotateEveryDays),
        sql`(${botSecrets.lastRotatedAt} + ${botSecrets.rotateEveryDays} * 86400000) < ${now}`,
      ),
    )
    .all();

  let rotated = 0;

  for (const secret of dueSecrets) {
    const newValue = randomBytes(32).toString("hex");
    const encryptedValue = encrypt(newValue);

    db.update(botSecrets)
      .set({
        encryptedValue,
        lastRotatedAt: now,
        updatedAt: now,
      })
      .where(eq(botSecrets.id, secret.id))
      .run();

    db.insert(botCommands)
      .values({
        id: crypto.randomUUID(),
        botId: secret.botId,
        command: "secret_rotated",
        payload: JSON.stringify({ secretName: secret.name }),
      })
      .run();

    rotated++;
  }

  return NextResponse.json({ rotated });
}
