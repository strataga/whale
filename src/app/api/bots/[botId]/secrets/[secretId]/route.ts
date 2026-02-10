import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { botSecrets } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string; secretId: string }> },
) {
  const { botId, secretId } = await params;
  const auth = await getAuthContext();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = db
    .select()
    .from(botSecrets)
    .where(and(eq(botSecrets.id, secretId), eq(botSecrets.botId, botId)))
    .get();

  if (!existing)
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });

  db.delete(botSecrets).where(eq(botSecrets.id, secretId)).run();

  logAudit({
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    action: "bot_secret.delete",
    metadata: { botId, secretId, secretName: existing.name },
  });

  return NextResponse.json({ ok: true });
}
