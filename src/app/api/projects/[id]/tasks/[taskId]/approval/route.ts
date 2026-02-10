import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { approvalGates, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createApprovalGateSchema, reviewApprovalGateSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { taskId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gates = db.select().from(approvalGates).where(eq(approvalGates.taskId, taskId)).all();
  return NextResponse.json({ gates });
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id: projectId, taskId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId))).get();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const data = createApprovalGateSchema.parse(body);
    const now = Date.now();
    const gateId = crypto.randomUUID();
    db.insert(approvalGates).values({ id: gateId, taskId, requiredRole: data.requiredRole ?? "admin", createdAt: now, updatedAt: now }).run();
    db.update(tasks).set({ requiresApproval: 1, updatedAt: now }).where(eq(tasks.id, taskId)).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "approval_gate.create", metadata: { taskId, gateId } });
    return NextResponse.json({ id: gateId }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { taskId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = reviewApprovalGateSchema.parse(body);
    const gate = db.select().from(approvalGates).where(and(eq(approvalGates.taskId, taskId), eq(approvalGates.status, "pending"))).get();
    if (!gate) return NextResponse.json({ error: "No pending approval gate" }, { status: 404 });
    const now = Date.now();
    db.update(approvalGates).set({ status: data.status, reviewedBy: auth.userId, reviewNote: data.reviewNote ?? null, updatedAt: now }).where(eq(approvalGates.id, gate.id)).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "approval_gate.review", metadata: { taskId, gateId: gate.id, status: data.status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
