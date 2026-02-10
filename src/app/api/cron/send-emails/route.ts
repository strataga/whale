import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { processEmailQueue } from "@/lib/server/email";

export const runtime = "nodejs";

/**
 * Process pending emails from the queue (#46).
 * Sends up to 10 emails per invocation.
 */
export async function POST(req: Request) {
  const authorized = await authorizeCronRequest(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = processEmailQueue(db, 10);
  return NextResponse.json(result);
}
