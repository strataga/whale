import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const session = db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(and(eq(userSessions.id, id), eq(userSessions.userId, ctx.userId)))
    .get();

  if (!session) return jsonError(404, "Session not found");

  db.update(userSessions)
    .set({ revokedAt: Date.now() })
    .where(eq(userSessions.id, id))
    .run();

  return NextResponse.json({ revoked: true });
}
