export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { advanceWorkflowRun } from "@/lib/server/workflow-engine";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workflowId: string; runId: string }> },
) {
  const { runId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = advanceWorkflowRun(db, runId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to advance workflow";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
