export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { dispatchToChannels } from "@/lib/server/channel-dispatcher";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/** Send a test message through the channel dispatcher (admin only). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const channel = db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.id, channelId),
        eq(schema.channels.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!channel) return jsonError(404, "Channel not found");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await dispatchToChannels(db as any, ctx.workspaceId, {
      event: "channel.test",
      severity: "info",
      title: "Test Message",
      body: "This is a test message from Whale channel configuration.",
    });

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "channel.test",
      metadata: { channelId },
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    return jsonError(500, "Test dispatch failed", err instanceof Error ? err.message : undefined);
  }
}
