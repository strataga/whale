export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { evaluateRules } from "@/lib/server/rule-engine";
import { verifyCronSecret } from "@/lib/server/cron-auth";

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  const ctx = isCron ? null : await getAuthContext();
  if (!isCron && !ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { trigger, payload, taskId, botId } = body;

    if (!trigger || typeof trigger !== "string") {
      return NextResponse.json({ error: "trigger is required" }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "payload is required" }, { status: 400 });
    }

    const workspaceId = body.workspaceId ?? ctx?.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required in cron mode" }, { status: 400 });
    }
    const results = evaluateRules(db, trigger, payload, {
      taskId: taskId ?? undefined,
      botId: botId ?? undefined,
      workspaceId,
    });

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to evaluate rules";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
