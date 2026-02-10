import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { scanAllWorkspaces } from "@/lib/server/anomaly-scanner";

export const runtime = "nodejs";

/**
 * Anomaly detection for bot behavior (#26).
 * Detects: sudden failure spikes, stale bots.
 */
export async function POST(req: Request) {
  const authorized = await authorizeCronRequest(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = scanAllWorkspaces(db);
  return NextResponse.json(result);
}
