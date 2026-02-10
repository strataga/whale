import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requirePublicApiAuth } from "@/lib/server/public-api-auth";
import { checkX402Payment } from "@/lib/server/x402-middleware";
import { linkX402TransactionToTask } from "@/lib/server/x402-task-settlement";
import { submitTaskSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const ctx = await requirePublicApiAuth(req, "tasks:create");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = submitTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { agentSlug, title, description, priority, inputData } = parsed.data;

  // Find agent by slug
  const agent = db
    .select({
      id: schema.agents.id,
      botId: schema.agents.botId,
      workspaceId: schema.agents.workspaceId,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.slug, agentSlug),
        eq(schema.agents.visibility, "public"),
        isNull(schema.agents.deletedAt),
      ),
    )
    .get();

  if (!agent) {
    return Response.json({ error: `Agent '${agentSlug}' not found` }, { status: 404 });
  }

  // Prevent cross-workspace task injection into public agents.
  if (agent.workspaceId !== ctx.workspaceId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Optional x402 paywall (route-pattern based).
  const pay = await checkX402Payment(db, "/api/public/tasks", ctx.workspaceId, req);
  if (pay.required) {
    return new Response(JSON.stringify({ error: "Payment required" }), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "payment-required": JSON.stringify(pay.price),
      },
    });
  }

  const now = Date.now();
  const taskId = crypto.randomUUID();

  // Create task (projectId nullable for API-submitted tasks)
  db.insert(schema.tasks)
    .values({
      id: taskId,
      projectId: null,
      title,
      description: description ?? "",
      priority: priority ?? "medium",
      status: "todo",
      sourceAgentId: agent.id,
      sourceProtocol: "public_api",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // If agent has a linked bot, create botTask
  if (agent.botId) {
    db.insert(schema.botTasks)
      .values({
        botId: agent.botId,
        taskId,
        status: "pending",
        structuredSpec: inputData ? JSON.stringify(inputData) : null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  if (pay.transactionId) {
    linkX402TransactionToTask(db, pay.transactionId, taskId);
  }

  return Response.json({ taskId, status: "pending" }, { status: 201 });
}
