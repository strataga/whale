import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requirePublicApiAuth } from "@/lib/server/public-api-auth";
import { createWebhookSubscriptionSchema } from "@/lib/validators";
import { randomBytes } from "node:crypto";

export async function POST(req: Request) {
  const ctx = await requirePublicApiAuth(req, "webhooks:manage");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = createWebhookSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const secret = randomBytes(32).toString("hex");
  const now = Date.now();
  const id = crypto.randomUUID();

  db.insert(schema.webhookSubscriptions)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      url: parsed.data.url,
      secret,
      events: JSON.stringify(parsed.data.events),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return Response.json({ id, url: parsed.data.url, secret, events: parsed.data.events }, { status: 201 });
}
