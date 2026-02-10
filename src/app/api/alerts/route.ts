export const runtime = "nodejs";

import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rows = db
    .select()
    .from(alerts)
    .where(eq(alerts.workspaceId, ctx.workspaceId))
    .orderBy(desc(alerts.createdAt))
    .all();

  return NextResponse.json({
    alerts: rows.map((a) => ({
      ...a,
      metadata: JSON.parse(a.metadata || "{}"),
    })),
  });
}
