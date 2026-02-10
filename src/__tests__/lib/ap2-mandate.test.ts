import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestDb,
  createTestUser,
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

describe("AP2 Mandate", () => {
  it("creates and stores a payment mandate", async () => {
    const { createMandate } = await import("@/lib/server/ap2-mandate");
    const mandate = createMandate(db, {
      type: "payment",
      payerIdentity: "user@example.com",
      amount: "100.00",
      currency: "USD",
      recipientIdentity: "agent-1",
      reference: "order-123",
      ttlSeconds: 3600,
    }, workspaceId);

    expect(mandate.id).toBeDefined();
    expect(mandate.signature).toBeDefined();
    expect(mandate.type).toBe("payment");

    // Verify stored in DB
    const stored = db
      .select()
      .from(schema.paymentMandates)
      .where(eq(schema.paymentMandates.id, mandate.id))
      .get();
    expect(stored).toBeDefined();
    expect(stored!.status).toBe("authorized");
  });

  it("creates an intent mandate", async () => {
    const { createMandate } = await import("@/lib/server/ap2-mandate");
    const mandate = createMandate(db, {
      type: "intent",
      payerIdentity: "agent@example.com",
      amount: "50.00",
      currency: "USD",
      description: "Code review service",
      ttlSeconds: 1800,
    }, workspaceId);

    expect(mandate.type).toBe("intent");
    expect(mandate.signature).toBeTruthy();
  });

  it("verifies a valid mandate", async () => {
    const { createMandate } = await import("@/lib/server/ap2-mandate");
    const { verifyMandate } = await import("@/lib/server/ap2-verify");

    const mandate = createMandate(db, {
      type: "payment",
      payerIdentity: "user@example.com",
      amount: "25.00",
      currency: "USD",
      ttlSeconds: 3600,
    }, workspaceId);

    const result = verifyMandate(mandate);
    expect(result.valid).toBe(true);
    expect(result.mandate).toBeDefined();
  });

  it("rejects a mandate with tampered signature", async () => {
    const { createMandate } = await import("@/lib/server/ap2-mandate");
    const { verifyMandate } = await import("@/lib/server/ap2-verify");

    const mandate = createMandate(db, {
      type: "payment",
      payerIdentity: "user@example.com",
      amount: "25.00",
      currency: "USD",
      ttlSeconds: 3600,
    }, workspaceId);

    // Tamper with signature
    const tampered = { ...mandate, signature: "tampered-signature" };
    const result = verifyMandate(tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired mandate", async () => {
    const { verifyMandate } = await import("@/lib/server/ap2-verify");

    const expired = {
      type: "payment" as const,
      id: crypto.randomUUID(),
      payerIdentity: "user@example.com",
      amount: "10.00",
      currency: "USD",
      recipientIdentity: "agent-1",
      reference: "ref-1",
      expiresAt: new Date(Date.now() - 60000).toISOString(),
      signature: "irrelevant",
    };

    const result = verifyMandate(expired);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });
});
