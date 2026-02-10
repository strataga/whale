import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
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

async function getSettlement() {
  return await import("@/lib/server/x402-settlement");
}

describe("x402 Settlement", () => {
  it("authorizes a payment", async () => {
    const { authorizePayment } = await getSettlement();
    const txId = authorizePayment(db, {
      workspaceId,
      payerAddress: "0x1234567890abcdef",
      amount: "0.01",
      asset: "USDC",
      network: "base",
    });

    expect(txId).toBeDefined();

    const tx = db
      .select()
      .from(schema.x402Transactions)
      .where(eq(schema.x402Transactions.id, txId))
      .get();
    expect(tx).toBeDefined();
    expect(tx!.status).toBe("authorized");
  });

  it("captures an authorized payment", async () => {
    const { authorizePayment, capturePayment } = await getSettlement();
    const txId = authorizePayment(db, {
      workspaceId,
      payerAddress: "0xabc",
      amount: "1.00",
      asset: "USDC",
      network: "base",
    });

    const result = capturePayment(db, txId);
    expect(result).toBe(true);

    const tx = db
      .select()
      .from(schema.x402Transactions)
      .where(eq(schema.x402Transactions.id, txId))
      .get();
    expect(tx!.status).toBe("captured");
  });

  it("settles a captured payment", async () => {
    const { authorizePayment, capturePayment, settlePayment } = await getSettlement();
    const txId = authorizePayment(db, {
      workspaceId,
      payerAddress: "0xabc",
      amount: "0.50",
      asset: "USDC",
      network: "base",
    });

    capturePayment(db, txId);
    const result = settlePayment(db, txId);
    expect(result).toBe(true);

    const tx = db
      .select()
      .from(schema.x402Transactions)
      .where(eq(schema.x402Transactions.id, txId))
      .get();
    expect(tx!.status).toBe("settled");
    expect(tx!.settledAt).toBeDefined();
  });

  it("refunds an authorized payment", async () => {
    const { authorizePayment, refundPayment } = await getSettlement();
    const txId = authorizePayment(db, {
      workspaceId,
      payerAddress: "0xabc",
      amount: "2.00",
      asset: "USDC",
      network: "base",
    });

    const result = refundPayment(db, txId);
    expect(result).toBe(true);

    const tx = db
      .select()
      .from(schema.x402Transactions)
      .where(eq(schema.x402Transactions.id, txId))
      .get();
    expect(tx!.status).toBe("refunded");
    expect(tx!.refundedAt).toBeDefined();
  });

  it("prevents settling a non-captured payment", async () => {
    const { authorizePayment, settlePayment } = await getSettlement();
    const txId = authorizePayment(db, {
      workspaceId,
      payerAddress: "0xabc",
      amount: "1.00",
      asset: "USDC",
      network: "base",
    });

    // Try to settle directly without capturing
    const result = settlePayment(db, txId);
    expect(result).toBe(false);
  });

  it("links payment to task", async () => {
    const { authorizePayment } = await getSettlement();
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id);

    const txId = authorizePayment(db, {
      workspaceId,
      payerAddress: "0xabc",
      amount: "0.05",
      asset: "USDC",
      network: "base",
      taskId: task.id,
    });

    const tx = db
      .select()
      .from(schema.x402Transactions)
      .where(eq(schema.x402Transactions.id, txId))
      .get();
    expect(tx!.taskId).toBe(task.id);
  });
});

describe("x402 Pricing", () => {
  it("creates a price configuration", () => {
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(schema.x402Prices)
      .values({
        id,
        workspaceId,
        routePattern: "/api/ai/*",
        amountUsdc: "0.001",
        network: "base",
        description: "AI endpoint pricing",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const price = db
      .select()
      .from(schema.x402Prices)
      .where(eq(schema.x402Prices.id, id))
      .get();
    expect(price).toBeDefined();
    expect(price!.amountUsdc).toBe("0.001");
    expect(price!.network).toBe("base");
  });
});
