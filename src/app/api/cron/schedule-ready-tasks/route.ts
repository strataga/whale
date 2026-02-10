export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { scheduleReadyTasks } from "@/lib/server/task-scheduler";
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
      const result = scheduleReadyTasks(db, ctx.workspaceId);
      return NextResponse.json({ assigned: result.assigned });
    }
    // Cron mode: schedule across all workspaces
    const allWs = db.select({ id: workspaces.id }).from(workspaces).all();
    const allAssigned = allWs.flatMap((ws) => scheduleReadyTasks(db, ws.id).assigned);
    return NextResponse.json({ assigned: allAssigned });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
