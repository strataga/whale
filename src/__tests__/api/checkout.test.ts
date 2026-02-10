import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestDb,
  createTestUser,
  createTestAgent,
  createTestAgentSkill,
  createTestCheckoutSession,
  createTestPaymentProvider,
  type TestDb,
} from "../helpers/setup";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
let workspaceId: string;

beforeEach(async () => {
  db = createTestDb();
  const user = await createTestUser(db);
  workspaceId = user.workspaceId;
});

describe("Checkout Session Lifecycle", () => {
  it("creates a checkout session", () => {
    const session = createTestCheckoutSession(db, workspaceId, {
      totalCents: 2500,
      status: "open",
    });
    expect(session.id).toBeDefined();
    expect(session.status).toBe("open");
  });

  it("processes checkout state transitions", async () => {
    const { processCheckout } = await import("@/lib/server/checkout");

    const session = createTestCheckoutSession(db, workspaceId, {
      totalCents: 1000,
      status: "open",
    });

    // open → authorized
    let result = processCheckout(db, session.id, "authorize");
    expect(result.ok).toBe(true);
    let updated = db.select().from(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id)).get();
    expect(updated!.status).toBe("authorized");

    // authorized → captured
    result = processCheckout(db, session.id, "capture");
    expect(result.ok).toBe(true);
    updated = db.select().from(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id)).get();
    expect(updated!.status).toBe("captured");

    // captured → settled
    result = processCheckout(db, session.id, "settle");
    expect(result.ok).toBe(true);
    updated = db.select().from(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id)).get();
    expect(updated!.status).toBe("settled");
  });

  it("prevents invalid state transitions", async () => {
    const { processCheckout } = await import("@/lib/server/checkout");

    const session = createTestCheckoutSession(db, workspaceId, {
      totalCents: 1000,
      status: "open",
    });

    // Can't capture from open (must authorize first)
    const result = processCheckout(db, session.id, "capture");
    expect(result.ok).toBe(false);
  });

  it("supports refund from authorized", async () => {
    const { processCheckout } = await import("@/lib/server/checkout");

    const session = createTestCheckoutSession(db, workspaceId, {
      totalCents: 500,
      status: "open",
    });

    processCheckout(db, session.id, "authorize");
    const result = processCheckout(db, session.id, "refund");
    expect(result.ok).toBe(true);

    const updated = db.select().from(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id)).get();
    expect(updated!.status).toBe("refunded");
  });
});

describe("Product Catalog", () => {
  it("creates a product linked to agent", () => {
    const agent = createTestAgent(db, workspaceId);
    const skill = createTestAgentSkill(db, agent.id, { name: "Coding" });
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(schema.agentProducts)
      .values({
        id,
        agentId: agent.id,
        skillId: skill.skillId,
        name: "Code Review",
        description: "AI-powered code review",
        priceCents: 500,
        pricingModel: "per_task",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const product = db.select().from(schema.agentProducts).where(eq(schema.agentProducts.id, id)).get();
    expect(product).toBeDefined();
    expect(product!.priceCents).toBe(500);
    expect(product!.agentId).toBe(agent.id);
  });
});

describe("Payment Providers", () => {
  it("creates a payment provider", () => {
    const provider = createTestPaymentProvider(db, workspaceId, {
      type: "stripe",
      name: "Stripe Production",
    });
    expect(provider.id).toBeDefined();
    expect(provider.type).toBe("stripe");
  });
});

describe("Order Fulfillment", () => {
  it("creates an order from checkout session", async () => {
    const { createOrder } = await import("@/lib/server/order-fulfillment");

    const session = createTestCheckoutSession(db, workspaceId, {
      totalCents: 1000,
      status: "captured",
    });

    const orderId = createOrder(db, session.id);
    expect(orderId).toBeDefined();

    const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
    expect(order).toBeDefined();
    expect(order!.status).toBe("pending_fulfillment");
    expect(order!.checkoutSessionId).toBe(session.id);
  });
});

describe("Agent Reputation", () => {
  it("records task outcome and updates reputation", async () => {
    const { recordTaskOutcome, recalculateReputation } = await import("@/lib/server/agent-reputation");
    const agent = createTestAgent(db, workspaceId, { reputation: 50 });

    recordTaskOutcome(db, agent.id, "completed", 5000);
    recordTaskOutcome(db, agent.id, "completed", 3000);
    recordTaskOutcome(db, agent.id, "failed", 10000);

    const newRep = recalculateReputation(db, agent.id);
    expect(typeof newRep).toBe("number");
    expect(newRep).toBeGreaterThanOrEqual(0);
    expect(newRep).toBeLessThanOrEqual(100);
  });
});
