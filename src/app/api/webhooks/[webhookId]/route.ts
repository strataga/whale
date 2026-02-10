import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { updateWebhookSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function PATCH(req: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = updateWebhookSchema.parse(body);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.url !== undefined) updates.url = data.url;
    if (data.events !== undefined) updates.events = JSON.stringify(data.events);
    if (data.active !== undefined) updates.active = data.active ? 1 : 0;
    db.update(webhooks).set(updates).where(and(eq(webhooks.id, webhookId), eq(webhooks.workspaceId, auth.workspaceId))).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "webhook.update", metadata: { webhookId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  db.delete(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.workspaceId, auth.workspaceId))).run();
  logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "webhook.delete", metadata: { webhookId } });
  return NextResponse.json({ ok: true });
}
