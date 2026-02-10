import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { escalationRules } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createEscalationRuleSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rules = db.select().from(escalationRules).where(eq(escalationRules.workspaceId, auth.workspaceId)).all();
  return NextResponse.json({ rules });
}
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = createEscalationRuleSchema.parse(body);
    const id = crypto.randomUUID();
    const now = Date.now();
    db.insert(escalationRules).values({ id, workspaceId: auth.workspaceId, trigger: data.trigger, threshold: data.threshold ?? 3, escalateToUserId: data.escalateToUserId ?? null, escalateToRole: data.escalateToRole ?? null, createdAt: now, updatedAt: now }).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "escalation_rule.create", metadata: { ruleId: id, trigger: data.trigger } });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
