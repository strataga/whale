export const runtime = "nodejs";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { updateChannelSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/** Get a single channel with its 20 most recent deliveries. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

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

  const deliveries = db
    .select()
    .from(schema.channelDeliveries)
    .where(eq(schema.channelDeliveries.channelId, channelId))
    .orderBy(desc(schema.channelDeliveries.createdAt))
    .limit(20)
    .all();

  return NextResponse.json({
    channel: {
      ...channel,
      config: JSON.parse(channel.config),
      events: JSON.parse(channel.events),
      active: channel.active === 1,
    },
    deliveries: deliveries.map((d) => ({
      ...d,
      payload: JSON.parse(d.payload),
    })),
  });
}

/** Update a channel (admin only). */
export async function PATCH(
  req: Request,
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
    const body = await req.json();
    const data = updateChannelSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.config !== undefined) updates.config = JSON.stringify(data.config);
    if (data.events !== undefined) updates.events = JSON.stringify(data.events);
    if (data.minSeverity !== undefined) updates.minSeverity = data.minSeverity;
    if (data.active !== undefined) updates.active = data.active ? 1 : 0;

    db.update(schema.channels)
      .set(updates)
      .where(eq(schema.channels.id, channelId))
      .run();

    const updated = db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, channelId))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "channel.update",
      metadata: { channelId },
    });

    return NextResponse.json({
      channel: updated
        ? {
            ...updated,
            config: JSON.parse(updated.config),
            events: JSON.parse(updated.events),
            active: updated.active === 1,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update channel");
  }
}

/** Delete a channel (admin only). */
export async function DELETE(
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

  db.delete(schema.channels).where(eq(schema.channels.id, channelId)).run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "channel.delete",
    metadata: { channelId },
  });

  return NextResponse.json({ success: true });
}
