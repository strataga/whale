import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requirePublicApiAuth } from "@/lib/server/public-api-auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requirePublicApiAuth(req, "webhooks:manage");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const sub = db
    .select({ id: schema.webhookSubscriptions.id })
    .from(schema.webhookSubscriptions)
    .where(
      and(
        eq(schema.webhookSubscriptions.id, id),
        eq(schema.webhookSubscriptions.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });

  db.delete(schema.webhookSubscriptions)
    .where(eq(schema.webhookSubscriptions.id, id))
    .run();

  return Response.json({ ok: true });
}
