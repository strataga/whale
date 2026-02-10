import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { botMetrics } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
export const runtime = "nodejs";
export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const metrics = db.select().from(botMetrics).where(eq(botMetrics.botId, botId)).orderBy(desc(botMetrics.createdAt)).limit(100).all();
  return NextResponse.json({ metrics });
}
