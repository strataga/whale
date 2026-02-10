import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createWebhookSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hooks = db.select().from(webhooks).where(eq(webhooks.workspaceId, auth.workspaceId)).all();
  return NextResponse.json({ webhooks: hooks.map((h) => ({ ...h, events: JSON.parse(h.events) })) });
}
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = createWebhookSchema.parse(body);
    const id = crypto.randomUUID();
    const secret = crypto.randomUUID();
    const now = Date.now();
    db.insert(webhooks).values({ id, workspaceId: auth.workspaceId, url: data.url, secret, events: JSON.stringify(data.events), createdAt: now, updatedAt: now }).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "webhook.create", metadata: { webhookId: id, url: data.url } });
    return NextResponse.json({ id, secret }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
