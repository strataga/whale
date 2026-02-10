import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { botTaskCheckpoints } from "@/lib/db/schema";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { getAuthContext } from "@/lib/server/auth-context";
import { createCheckpointSchema, reviewCheckpointSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET(req: Request, { params }: { params: Promise<{ botId: string; botTaskId: string }> }) {
  const { botTaskId } = await params;
  const botCtx = await getBotAuthContext(req);
  const humanCtx = botCtx ? null : await getAuthContext();
  if (!botCtx && !humanCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const checkpoints = db.select().from(botTaskCheckpoints).where(eq(botTaskCheckpoints.botTaskId, botTaskId)).all();
  return NextResponse.json({ checkpoints });
}
export async function POST(req: Request, { params }: { params: Promise<{ botId: string; botTaskId: string }> }) {
  const { botId, botTaskId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (botCtx.botId !== botId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const data = createCheckpointSchema.parse(body);
    const now = Date.now();
    const id = crypto.randomUUID();
    db.insert(botTaskCheckpoints).values({ id, botTaskId, name: data.name, data: JSON.stringify(data.data ?? {}), createdAt: now, updatedAt: now }).run();
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ botId: string; botTaskId: string }> }) {
  const { botTaskId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = reviewCheckpointSchema.parse(body);
    const checkpoint = db.select().from(botTaskCheckpoints).where(and(eq(botTaskCheckpoints.botTaskId, botTaskId), eq(botTaskCheckpoints.status, "pending"))).get();
    if (!checkpoint) return NextResponse.json({ error: "No pending checkpoint" }, { status: 404 });
    db.update(botTaskCheckpoints).set({ status: data.status, reviewedBy: auth.userId, updatedAt: Date.now() }).where(eq(botTaskCheckpoints.id, checkpoint.id)).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "checkpoint.review", metadata: { botTaskId, checkpointId: checkpoint.id, status: data.status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
