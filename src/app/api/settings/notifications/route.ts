import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { updateNotificationChannelsSchema } from "@/lib/validators";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ws = db.select({ slackWebhookUrl: workspaces.slackWebhookUrl, discordWebhookUrl: workspaces.discordWebhookUrl }).from(workspaces).where(eq(workspaces.id, auth.workspaceId)).get();
  return NextResponse.json({ slackConfigured: !!ws?.slackWebhookUrl, discordConfigured: !!ws?.discordWebhookUrl });
}
export async function PUT(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = updateNotificationChannelsSchema.parse(body);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.slackWebhookUrl !== undefined) updates.slackWebhookUrl = data.slackWebhookUrl ? encrypt(data.slackWebhookUrl) : null;
    if (data.discordWebhookUrl !== undefined) updates.discordWebhookUrl = data.discordWebhookUrl ? encrypt(data.discordWebhookUrl) : null;
    db.update(workspaces).set(updates).where(eq(workspaces.id, auth.workspaceId)).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "settings.update_notifications" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
