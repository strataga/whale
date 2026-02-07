import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import * as schema from "@/lib/db/schema";
import {
  isValidTransition,
  getAllowedTransitions,
  normalizeLegacyStatus,
  transitionBotStatus,
  type BotStatus,
} from "@/lib/server/bot-state-machine";
import {
  createTestDb,
  createTestUser,
  type TestDb,
} from "../helpers/setup";

describe("Bot State Machine — isValidTransition", () => {
  const validCases: [BotStatus, BotStatus][] = [
    ["offline", "idle"],
    ["idle", "working"],
    ["idle", "offline"],
    ["idle", "error"],
    ["working", "idle"],
    ["working", "waiting"],
    ["working", "error"],
    ["waiting", "working"],
    ["waiting", "idle"],
    ["waiting", "error"],
    ["error", "recovering"],
    ["error", "offline"],
    ["recovering", "idle"],
    ["recovering", "error"],
    ["recovering", "offline"],
  ];

  it.each(validCases)("allows %s → %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  const invalidCases: [BotStatus, BotStatus][] = [
    ["offline", "working"],
    ["offline", "error"],
    ["offline", "waiting"],
    ["offline", "recovering"],
    ["offline", "offline"],
    ["idle", "recovering"],
    ["idle", "waiting"],
    ["idle", "idle"],
    ["working", "offline"],
    ["working", "recovering"],
    ["working", "working"],
    ["waiting", "offline"],
    ["waiting", "recovering"],
    ["waiting", "waiting"],
    ["error", "idle"],
    ["error", "working"],
    ["error", "waiting"],
    ["error", "error"],
    ["recovering", "working"],
    ["recovering", "waiting"],
    ["recovering", "recovering"],
  ];

  it.each(invalidCases)("rejects %s → %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });
});

describe("Bot State Machine — getAllowedTransitions", () => {
  it("returns correct transitions for idle", () => {
    expect(getAllowedTransitions("idle")).toEqual(["working", "offline", "error"]);
  });

  it("returns correct transitions for error", () => {
    expect(getAllowedTransitions("error")).toEqual(["recovering", "offline"]);
  });

  it("returns empty for unknown status", () => {
    expect(getAllowedTransitions("garbage" as BotStatus)).toEqual([]);
  });
});

describe("Bot State Machine — normalizeLegacyStatus", () => {
  it("maps 'online' to 'idle'", () => {
    expect(normalizeLegacyStatus("online")).toBe("idle");
  });

  it("maps 'busy' to 'working'", () => {
    expect(normalizeLegacyStatus("busy")).toBe("working");
  });

  it("passes through valid new statuses", () => {
    expect(normalizeLegacyStatus("idle")).toBe("idle");
    expect(normalizeLegacyStatus("working")).toBe("working");
    expect(normalizeLegacyStatus("offline")).toBe("offline");
  });
});

describe("Bot State Machine — transitionBotStatus (DB integration)", () => {
  let db: TestDb;
  let workspaceId: string;
  let botId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;

    botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "SM Bot",
        host: "localhost",
        status: "idle",
        statusChangedAt: now,
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("succeeds on valid transition (idle → working)", () => {
    const result = transitionBotStatus(db, botId, workspaceId, "idle", "working", "Starting task");
    expect(result.ok).toBe(true);

    const bot = db.select().from(schema.bots).where(eq(schema.bots.id, botId)).get();
    expect(bot!.status).toBe("working");
    expect(bot!.statusReason).toBe("Starting task");
    expect(bot!.statusChangedAt).toBeGreaterThan(0);
  });

  it("fails on invalid transition (idle → recovering)", () => {
    const result = transitionBotStatus(db, botId, workspaceId, "idle", "recovering");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.allowedTransitions).toContain("working");
      expect(result.allowedTransitions).not.toContain("recovering");
    }

    // Status unchanged
    const bot = db.select().from(schema.bots).where(eq(schema.bots.id, botId)).get();
    expect(bot!.status).toBe("idle");
  });

  it("handles legacy status 'online' → working", () => {
    // Set bot to legacy 'online' status
    db.update(schema.bots).set({ status: "online" }).where(eq(schema.bots.id, botId)).run();

    const result = transitionBotStatus(db, botId, workspaceId, "online", "working");
    expect(result.ok).toBe(true);
  });

  it("handles legacy status 'busy' → idle", () => {
    db.update(schema.bots).set({ status: "busy" }).where(eq(schema.bots.id, botId)).run();

    const result = transitionBotStatus(db, botId, workspaceId, "busy", "idle");
    expect(result.ok).toBe(true);
  });

  it("clears statusReason when reason not provided", () => {
    // First set a reason
    transitionBotStatus(db, botId, workspaceId, "idle", "working", "Starting task");

    // Transition without reason
    transitionBotStatus(db, botId, workspaceId, "working", "idle");
    const bot = db.select().from(schema.bots).where(eq(schema.bots.id, botId)).get();
    expect(bot!.statusReason).toBeNull();
  });

  it("creates audit log on transition", () => {
    transitionBotStatus(db, botId, workspaceId, "idle", "error", "Crash");

    const logs = db.select().from(schema.auditLogs).all();
    const statusLog = logs.find((l) => l.action === "bot.status_change");
    expect(statusLog).toBeDefined();
    const meta = JSON.parse(statusLog!.metadata);
    expect(meta.from).toBe("idle");
    expect(meta.to).toBe("error");
    expect(meta.reason).toBe("Crash");
  });
});
