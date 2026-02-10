import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botConfigVersions, bots } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const versions = db
    .select()
    .from(botConfigVersions)
    .where(eq(botConfigVersions.botId, botId))
    .orderBy(desc(botConfigVersions.version))
    .all();
  return NextResponse.json(versions);
}
