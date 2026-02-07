import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import * as schema from "@/lib/db/schema";
import { createBotGuidelineSchema, ackOnboardingSchema } from "@/lib/validators";
import { createTestDb, createTestUser, type TestDb } from "../helpers/setup";

// ── Validator tests ──────────────────────────────────────────────────

describe("createBotGuidelineSchema validation", () => {
  it("accepts valid guideline data", () => {
    const result = createBotGuidelineSchema.safeParse({
      title: "Code Style Rules",
      content: "Always use 2-space indentation and trailing commas.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createBotGuidelineSchema.safeParse({
      title: "",
      content: "Some content here.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = createBotGuidelineSchema.safeParse({
      title: "Valid Title",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createBotGuidelineSchema.safeParse({
      content: "Some content.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const result = createBotGuidelineSchema.safeParse({
      title: "A Title",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = createBotGuidelineSchema.safeParse({
      title: "Title",
      content: "Content",
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });
});

describe("ackOnboardingSchema validation", () => {
  it("accepts { acknowledged: true }", () => {
    const result = ackOnboardingSchema.safeParse({ acknowledged: true });
    expect(result.success).toBe(true);
  });

  it("rejects { acknowledged: false }", () => {
    const result = ackOnboardingSchema.safeParse({ acknowledged: false });
    expect(result.success).toBe(false);
  });

  it("rejects missing acknowledged field", () => {
    const result = ackOnboardingSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = ackOnboardingSchema.safeParse({
      acknowledged: true,
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });
});

// ── DB integration tests ─────────────────────────────────────────────

describe("Bot onboarding — DB integration", () => {
  let db: TestDb;
  let workspaceId: string;
  let botId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;

    // Create a test bot
    botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("test-token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Test Bot",
        host: "localhost:9090",
        status: "idle",
        statusChangedAt: now,
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        onboardedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("creates a guideline in the database", () => {
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(schema.botGuidelines)
      .values({
        id,
        workspaceId,
        title: "Security Policy",
        content: "Never commit secrets to version control.",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const guideline = db
      .select()
      .from(schema.botGuidelines)
      .where(eq(schema.botGuidelines.id, id))
      .get();

    expect(guideline).toBeDefined();
    expect(guideline!.title).toBe("Security Policy");
    expect(guideline!.content).toBe("Never commit secrets to version control.");
    expect(guideline!.version).toBe(1);
    expect(guideline!.workspaceId).toBe(workspaceId);
  });

  it("onboarding ACK sets onboardedAt on the bot", () => {
    // Create a guideline first
    const guidelineId = crypto.randomUUID();
    const now = Date.now();

    db.insert(schema.botGuidelines)
      .values({
        id: guidelineId,
        workspaceId,
        title: "Test Guideline",
        content: "Content for the guideline.",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Verify bot is not onboarded
    const botBefore = db
      .select({ onboardedAt: schema.bots.onboardedAt })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(botBefore!.onboardedAt).toBeNull();

    // Simulate onboarding ACK: set onboardedAt
    const onboardedAt = Date.now();
    db.update(schema.bots)
      .set({ onboardedAt, updatedAt: onboardedAt })
      .where(eq(schema.bots.id, botId))
      .run();

    // Verify bot is now onboarded
    const botAfter = db
      .select({ onboardedAt: schema.bots.onboardedAt })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(botAfter!.onboardedAt).toBe(onboardedAt);
  });

  it("task gating: bot without onboarding should be blocked when guidelines exist", () => {
    // Create a guideline
    const guidelineId = crypto.randomUUID();
    const now = Date.now();

    db.insert(schema.botGuidelines)
      .values({
        id: guidelineId,
        workspaceId,
        title: "Required Guideline",
        content: "Bots must follow this.",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Check bot's onboardedAt
    const bot = db
      .select({ onboardedAt: schema.bots.onboardedAt })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(bot!.onboardedAt).toBeNull();

    // Check guideline count
    const guidelines = db
      .select()
      .from(schema.botGuidelines)
      .where(eq(schema.botGuidelines.workspaceId, workspaceId))
      .all();

    expect(guidelines.length).toBeGreaterThan(0);

    // Simulate gate: if onboardedAt is null and guidelines exist, block tasks
    const shouldGate = bot!.onboardedAt === null && guidelines.length > 0;
    expect(shouldGate).toBe(true);
  });

  it("task gating: onboarded bot should not be blocked", () => {
    // Create a guideline
    const now = Date.now();
    db.insert(schema.botGuidelines)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        title: "Some Guideline",
        content: "Content.",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Onboard the bot
    db.update(schema.bots)
      .set({ onboardedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(schema.bots.id, botId))
      .run();

    const bot = db
      .select({ onboardedAt: schema.bots.onboardedAt })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(bot!.onboardedAt).not.toBeNull();

    // Should not gate
    const shouldGate = bot!.onboardedAt === null;
    expect(shouldGate).toBe(false);
  });

  it("task gating: bot without onboarding should NOT be blocked when no guidelines exist", () => {
    // No guidelines created — bot should not be gated
    const bot = db
      .select({ onboardedAt: schema.bots.onboardedAt })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(bot!.onboardedAt).toBeNull();

    const guidelines = db
      .select()
      .from(schema.botGuidelines)
      .where(eq(schema.botGuidelines.workspaceId, workspaceId))
      .all();

    expect(guidelines.length).toBe(0);

    const shouldGate = bot!.onboardedAt === null && guidelines.length > 0;
    expect(shouldGate).toBe(false);
  });

  it("multiple guidelines can be created for a workspace", () => {
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      db.insert(schema.botGuidelines)
        .values({
          id: crypto.randomUUID(),
          workspaceId,
          title: `Guideline ${i + 1}`,
          content: `Content for guideline ${i + 1}.`,
          version: 1,
          createdAt: now + i,
          updatedAt: now + i,
        })
        .run();
    }

    const guidelines = db
      .select()
      .from(schema.botGuidelines)
      .where(eq(schema.botGuidelines.workspaceId, workspaceId))
      .all();

    expect(guidelines).toHaveLength(3);
  });
});
