export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify bot belongs to workspace
  const bot = db
    .select({ id: schema.bots.id })
    .from(schema.bots)
    .where(
      eq(schema.bots.id, botId),
    )
    .get();

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const rollups = db
    .select()
    .from(schema.botMetricRollups)
    .where(eq(schema.botMetricRollups.botId, botId))
    .orderBy(desc(schema.botMetricRollups.periodStart))
    .limit(168)
    .all();

  return NextResponse.json({ trends: rollups });
}
