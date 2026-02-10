import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { inboundWebhooks } from "@/lib/db/schema";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hook = db.select().from(inboundWebhooks).where(and(eq(inboundWebhooks.id, id), eq(inboundWebhooks.active, 1))).get();
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = req.headers.get("x-webhook-token")?.trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });
  const a = Buffer.from(token);
  const b = Buffer.from(hook.secretToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  await req.json().catch(() => ({}));
  // Store the payload for now — action execution can be expanded later
  return NextResponse.json({ ok: true, actionType: hook.actionType, received: true });
}
