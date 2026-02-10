export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { checkEscalations } from "@/lib/server/escalation-engine";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { workspaces } from "@/lib/db/schema";

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  const ctx = isCron ? null : await getAuthContext();
  if (!isCron && !ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (ctx) {
      const results = checkEscalations(db, ctx.workspaceId);
      return NextResponse.json(results);
    }
    // Cron mode: check all workspaces
    const allWs = db.select({ id: workspaces.id }).from(workspaces).all();
    const allResults = allWs.map((ws) => checkEscalations(db, ws.id));
    return NextResponse.json({ workspaces: allResults.length, results: allResults });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check escalations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
