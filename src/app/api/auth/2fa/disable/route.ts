import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  db.update(users)
    .set({ totpEnabled: 0, totpSecret: null, updatedAt: Date.now() })
    .where(eq(users.id, ctx.userId))
    .run();

  return NextResponse.json({ disabled: true });
}
