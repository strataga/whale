export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { startWorkflowRun, advanceWorkflowRun } from "@/lib/server/workflow-engine";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId, stepsInitialized } = startWorkflowRun(db, workflowId, ctx.workspaceId);
    const advanced = advanceWorkflowRun(db, runId);

    return NextResponse.json({
      runId,
      stepsInitialized,
      advanced: advanced.advanced,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run workflow";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
