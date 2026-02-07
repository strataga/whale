import { describe, it, expect, beforeEach } from "vitest";
import { eq, and, gt, isNull } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import * as schema from "@/lib/db/schema";
import {
  registerBotSchema,
  botHeartbeatSchema,
} from "@/lib/validators";
import {
  createTestDb,
  createTestUser,
  type TestDb,
} from "../helpers/setup";

describe("Bots — registerBotSchema validation", () => {
  it("accepts valid bot registration", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(64),
      name: "My Bot",
      host: "localhost:8080",
      deviceId: "device-1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with capabilities", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "ab12cd34".repeat(8),
      name: "My Bot",
      host: "localhost:8080",
      deviceId: "device-1",
      capabilities: ["code", "test"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects pairing token shorter than 64 chars", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(63),
      name: "My Bot",
      host: "localhost",
      deviceId: "device-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects pairing token longer than 64 chars", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(65),
      name: "My Bot",
      host: "localhost",
      deviceId: "device-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects pairing token with non-hex characters", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "g".repeat(64),
      name: "My Bot",
      host: "localhost",
      deviceId: "device-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(64),
      name: "",
      host: "localhost",
      deviceId: "device-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty host", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(64),
      name: "Bot",
      host: "",
      deviceId: "device-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing deviceId", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(64),
      name: "Bot",
      host: "localhost",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(64),
      name: "Bot",
      host: "localhost",
      deviceId: "device-1",
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("defaults capabilities to empty array", () => {
    const result = registerBotSchema.safeParse({
      pairingToken: "a".repeat(64),
      name: "Bot",
      host: "localhost",
      deviceId: "device-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capabilities).toEqual([]);
    }
  });
});

describe("Bots — botHeartbeatSchema validation", () => {
  it("accepts valid heartbeat", () => {
    const result = botHeartbeatSchema.safeParse({ status: "online" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["online", "offline", "busy", "error"]) {
      const result = botHeartbeatSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = botHeartbeatSchema.safeParse({ status: "sleeping" });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = botHeartbeatSchema.safeParse({
      status: "online",
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("Bots — pairing token creation and consumption flow", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;
  });

  it("creates a pairing token with hash and expiry", async () => {
    const rawToken = "a1b2c3d4".repeat(8); // 64 hex chars
    const tokenHash = await hash(rawToken, 4);
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes
    const id = crypto.randomUUID();

    db.insert(schema.pairingTokens)
      .values({
        id,
        workspaceId,
        tokenHash,
        expiresAt,
        consumedAt: null,
        createdAt: now,
      })
      .run();

    const found = db
      .select()
      .from(schema.pairingTokens)
      .where(eq(schema.pairingTokens.id, id))
      .get();

    expect(found).toBeDefined();
    expect(found!.consumedAt).toBeNull();
    expect(found!.expiresAt).toBe(expiresAt);
    expect(await compare(rawToken, found!.tokenHash)).toBe(true);
  });

  it("consumes a pairing token (marks consumedAt)", async () => {
    const rawToken = "a1b2c3d4".repeat(8);
    const tokenHash = await hash(rawToken, 4);
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;
    const id = crypto.randomUUID();

    db.insert(schema.pairingTokens)
      .values({
        id,
        workspaceId,
        tokenHash,
        expiresAt,
        consumedAt: null,
        createdAt: now,
      })
      .run();

    // Find unconsumed, non-expired tokens
    const candidates = db
      .select({
        id: schema.pairingTokens.id,
        workspaceId: schema.pairingTokens.workspaceId,
        tokenHash: schema.pairingTokens.tokenHash,
      })
      .from(schema.pairingTokens)
      .where(
        and(
          isNull(schema.pairingTokens.consumedAt),
          gt(schema.pairingTokens.expiresAt, now),
        ),
      )
      .all();

    expect(candidates).toHaveLength(1);

    // Verify token matches
    const matched = await compare(rawToken, candidates[0].tokenHash);
    expect(matched).toBe(true);

    // Consume the token
    const consumeRes = db
      .update(schema.pairingTokens)
      .set({ consumedAt: Date.now() })
      .where(
        and(
          eq(schema.pairingTokens.id, candidates[0].id),
          isNull(schema.pairingTokens.consumedAt),
        ),
      )
      .run();

    expect(consumeRes.changes).toBe(1);

    // Verify it's consumed
    const consumed = db
      .select()
      .from(schema.pairingTokens)
      .where(eq(schema.pairingTokens.id, id))
      .get();

    expect(consumed!.consumedAt).not.toBeNull();
  });

  it("rejects already-consumed pairing token", async () => {
    const rawToken = "a1b2c3d4".repeat(8);
    const tokenHash = await hash(rawToken, 4);
    const now = Date.now();
    const id = crypto.randomUUID();

    // Insert already-consumed token
    db.insert(schema.pairingTokens)
      .values({
        id,
        workspaceId,
        tokenHash,
        expiresAt: now + 15 * 60 * 1000,
        consumedAt: now - 1000, // Already consumed
        createdAt: now - 2000,
      })
      .run();

    // Search for unconsumed tokens
    const candidates = db
      .select()
      .from(schema.pairingTokens)
      .where(
        and(
          isNull(schema.pairingTokens.consumedAt),
          gt(schema.pairingTokens.expiresAt, now),
        ),
      )
      .all();

    expect(candidates).toHaveLength(0);
  });

  it("rejects expired pairing token", async () => {
    const rawToken = "a1b2c3d4".repeat(8);
    const tokenHash = await hash(rawToken, 4);
    const now = Date.now();
    const id = crypto.randomUUID();

    // Insert expired token
    db.insert(schema.pairingTokens)
      .values({
        id,
        workspaceId,
        tokenHash,
        expiresAt: now - 1000, // Expired
        consumedAt: null,
        createdAt: now - 60000,
      })
      .run();

    const candidates = db
      .select()
      .from(schema.pairingTokens)
      .where(
        and(
          isNull(schema.pairingTokens.consumedAt),
          gt(schema.pairingTokens.expiresAt, now),
        ),
      )
      .all();

    expect(candidates).toHaveLength(0);
  });
});

describe("Bots — bot registration and heartbeat logic", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;
  });

  it("creates a bot with token hash and prefix", async () => {
    const deviceToken = "b".repeat(128);
    const tokenPrefix = deviceToken.slice(0, 8);
    const tokenHash = await hash(deviceToken, 4);
    const botId = crypto.randomUUID();
    const now = Date.now();

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Test Bot",
        host: "localhost:9090",
        status: "online",
        capabilities: JSON.stringify(["code", "test"]),
        lastSeenAt: now,
        tokenPrefix,
        tokenHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const bot = db
      .select()
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(bot).toBeDefined();
    expect(bot!.name).toBe("Test Bot");
    expect(bot!.host).toBe("localhost:9090");
    expect(bot!.status).toBe("online");
    expect(bot!.tokenPrefix).toBe("bbbbbbbb");
    expect(JSON.parse(bot!.capabilities)).toEqual(["code", "test"]);
    expect(await compare(deviceToken, bot!.tokenHash)).toBe(true);
  });

  it("updates bot status via heartbeat", async () => {
    const botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Heartbeat Bot",
        host: "localhost:9090",
        status: "online",
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Simulate heartbeat with status update
    const newNow = Date.now();
    const res = db
      .update(schema.bots)
      .set({
        status: "busy",
        lastSeenAt: newNow,
        updatedAt: newNow,
      })
      .where(
        and(
          eq(schema.bots.id, botId),
          eq(schema.bots.workspaceId, workspaceId),
        ),
      )
      .run();

    expect(res.changes).toBe(1);

    const updated = db
      .select()
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    expect(updated!.status).toBe("busy");
    expect(updated!.lastSeenAt).toBe(newNow);
  });

  it("heartbeat for non-existent bot returns no changes", () => {
    const res = db
      .update(schema.bots)
      .set({
        status: "online",
        lastSeenAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(schema.bots.id, crypto.randomUUID()),
          eq(schema.bots.workspaceId, workspaceId),
        ),
      )
      .run();

    expect(res.changes).toBe(0);
  });

  it("heartbeat for bot in different workspace returns no changes", async () => {
    const botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "WS1 Bot",
        host: "localhost",
        status: "online",
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Try to heartbeat from a different workspace
    const otherWorkspaceId = crypto.randomUUID();
    const res = db
      .update(schema.bots)
      .set({ status: "busy", lastSeenAt: Date.now(), updatedAt: Date.now() })
      .where(
        and(
          eq(schema.bots.id, botId),
          eq(schema.bots.workspaceId, otherWorkspaceId),
        ),
      )
      .run();

    expect(res.changes).toBe(0);

    // Bot should still be "online"
    const bot = db
      .select()
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();
    expect(bot!.status).toBe("online");
  });
});
