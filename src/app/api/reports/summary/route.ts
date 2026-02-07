import { NextResponse } from "next/server";

import { getReportingSummary } from "@/lib/server/reporting";
import { requireAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireAuthContext();
  const summary = getReportingSummary(ctx.workspaceId);
  return NextResponse.json(summary);
}
