import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { inboundWebhooks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createInboundWebhookSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hooks = db.select().from(inboundWebhooks).where(eq(inboundWebhooks.workspaceId, auth.workspaceId)).all();
  return NextResponse.json({ webhooks: hooks });
}
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = createInboundWebhookSchema.parse(body);
    const id = crypto.randomUUID();
    const secretToken = crypto.randomUUID();
    const now = Date.now();
    db.insert(inboundWebhooks).values({ id, workspaceId: auth.workspaceId, name: data.name, secretToken, actionType: data.actionType, actionConfig: JSON.stringify(data.actionConfig ?? {}), createdAt: now, updatedAt: now }).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "inbound_webhook.create", metadata: { webhookId: id, name: data.name } });
    return NextResponse.json({ id, secretToken }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
