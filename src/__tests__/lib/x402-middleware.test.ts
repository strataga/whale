import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";

import * as schema from "@/lib/db/schema";
import { checkX402Payment } from "@/lib/server/x402-middleware";
import { createTestDb, createTestUser, type TestDb } from "../helpers/setup";

describe("x402 Middleware", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.X402_FACILITATOR_URL;
  });

  it("returns 402 when a route is priced and no payment-signature is provided", async () => {
    const now = Date.now();
    db.insert(schema.x402Prices)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        routePattern: "/api/public/tasks",
        amountUsdc: "1.00",
        network: "base",
        description: "Public tasks",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const req = new Request("https://whale.local/api/public/tasks", { method: "POST" });
    const result = await checkX402Payment(db, "/api/public/tasks", workspaceId, req);

    expect(result.required).toBe(true);
    if (result.required) {
      expect(result.price.amount).toBe("1.00");
      expect(result.price.network).toBe("base");
      expect(result.price.asset).toBe("USDC");
    }
  });

  it("verifies payment via facilitator and records a transaction", async () => {
    const now = Date.now();
    db.insert(schema.x402Prices)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        routePattern: "/api/public/tasks",
        amountUsdc: "1.00",
        network: "base",
        description: "Public tasks",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/verify")) {
        // Ensure request is well-formed
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            valid: true,
            txHash: "0xtxhash",
            payerAddress: "0xpayer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const req = new Request("https://whale.local/api/public/tasks", {
      method: "POST",
      headers: { "payment-signature": "base64payload" },
    });

    const result = await checkX402Payment(db, "/api/public/tasks", workspaceId, req);

    expect(result.required).toBe(false);
    if (!result.required) {
      expect(result.transactionId).toBeTruthy();

      const tx = db
        .select()
        .from(schema.x402Transactions)
        .where(eq(schema.x402Transactions.id, result.transactionId!))
        .get();

      expect(tx).toBeDefined();
      expect(tx!.workspaceId).toBe(workspaceId);
      expect(tx!.status).toBe("authorized");
      expect(tx!.txHash).toBe("0xtxhash");
      expect(tx!.payerAddress).toBe("0xpayer");
      expect(tx!.amount).toBe("1.00");
      expect(tx!.network).toBe("base");
    }
  });
});

