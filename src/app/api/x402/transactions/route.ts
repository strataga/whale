import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { x402Transactions } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const network = url.searchParams.get("network");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const conditions = [eq(x402Transactions.workspaceId, ctx.workspaceId)];

  if (status) {
    conditions.push(eq(x402Transactions.status, status));
  }
  if (network) {
    conditions.push(eq(x402Transactions.network, network));
  }

  const transactions = db
    .select()
    .from(x402Transactions)
    .where(and(...conditions))
    .orderBy(desc(x402Transactions.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ transactions });
}
