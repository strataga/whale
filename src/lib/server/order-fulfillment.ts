/**
 * Order lifecycle management.
 * Creates orders from checkout sessions and fulfills them
 * by spawning tasks assigned to the relevant agent.
 */

import { eq } from "drizzle-orm";

import {
  checkoutSessions,
  orders,
  agentProducts,
  agents,
  tasks,
  botTasks,
} from "@/lib/db/schema";
import type { AnyDb } from "@/types";

/**
 * Creates an order row from a checkout session.
 * Returns the new order ID.
 */
export function createOrder(db: AnyDb, checkoutSessionId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const session = d
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, checkoutSessionId))
    .get();

  if (!session) {
    throw new Error("Checkout session not found");
  }

  const orderId = crypto.randomUUID();
  d.insert(orders)
    .values({
      id: orderId,
      checkoutSessionId,
      status: "pending_fulfillment",
    })
    .run();

  return orderId;
}

/**
 * Fulfills an order by creating a task from purchased products
 * and assigning it to the agent.
 */
export function fulfillOrder(
  db: AnyDb,
  orderId: string,
): { ok: boolean; taskId?: string; error?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const order = d
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .get();

  if (!order) {
    return { ok: false, error: "Order not found" };
  }

  if (order.status !== "pending_fulfillment") {
    return { ok: false, error: `Order already in status '${order.status}'` };
  }

  const session = d
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, order.checkoutSessionId))
    .get();

  if (!session) {
    return { ok: false, error: "Checkout session not found" };
  }

  // Parse line items and find the first product to determine agent
  const lineItems: Array<{ productId: string; quantity: number }> = JSON.parse(
    session.lineItems || "[]",
  );

  if (lineItems.length === 0) {
    return { ok: false, error: "No line items in checkout session" };
  }

  const firstItem = lineItems[0]!;
  const product = d
    .select()
    .from(agentProducts)
    .where(eq(agentProducts.id, firstItem.productId))
    .get();

  if (!product) {
    return { ok: false, error: "Product not found" };
  }

  // Find agent and its linked bot
  const agent = d
    .select()
    .from(agents)
    .where(eq(agents.id, product.agentId))
    .get();

  if (!agent) {
    return { ok: false, error: "Agent not found" };
  }

  // Build a task description from all purchased products
  const productNames = lineItems.map((li) => {
    const p = d.select().from(agentProducts).where(eq(agentProducts.id, li.productId)).get();
    return p ? `${p.name} x${li.quantity}` : `Unknown product x${li.quantity}`;
  });

  const taskId = crypto.randomUUID();
  d.insert(tasks)
    .values({
      id: taskId,
      title: `Order ${orderId.slice(0, 8)}: ${product.name}`,
      description: `Fulfillment for order ${orderId}. Products: ${productNames.join(", ")}`,
      status: "todo",
      priority: "medium",
      sourceAgentId: session.buyerAgentId,
      sourceProtocol: "acp",
    })
    .run();

  // If the agent has a linked bot, create a bot task assignment
  if (agent.botId) {
    const botTaskId = crypto.randomUUID();
    d.insert(botTasks)
      .values({
        id: botTaskId,
        botId: agent.botId,
        taskId,
        status: "pending",
      })
      .run();
  }

  // Update order status
  d.update(orders)
    .set({
      status: "in_progress",
      agentTaskId: taskId,
      updatedAt: Date.now(),
    })
    .where(eq(orders.id, orderId))
    .run();

  return { ok: true, taskId };
}
