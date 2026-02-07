import { describe, it, expect, beforeEach } from "vitest";
import { eq, desc } from "drizzle-orm";
import { hash } from "bcryptjs";
import * as schema from "@/lib/db/schema";
import { createReleaseNoteSchema } from "@/lib/validators";
import { createTestDb, createTestUser, type TestDb } from "../helpers/setup";

describe("Bot releases — createReleaseNoteSchema validation", () => {
  it("accepts valid release note", () => {
    const result = createReleaseNoteSchema.safeParse({
      version: "1.0.0",
      title: "Initial release",
      body: "First stable release of the bot.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with optional releaseUrl", () => {
    const result = createReleaseNoteSchema.safeParse({
      version: "1.1.0",
      title: "Feature update",
      body: "Added new capabilities.",
      releaseUrl: "https://github.com/org/repo/releases/tag/v1.1.0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.releaseUrl).toBe(
        "https://github.com/org/repo/releases/tag/v1.1.0",
      );
    }
  });

  it("rejects empty version", () => {
    const result = createReleaseNoteSchema.safeParse({
      version: "",
      title: "Some title",
      body: "Some body",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createReleaseNoteSchema.safeParse({
      version: "1.0.0",
      title: "",
      body: "Some body",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = createReleaseNoteSchema.safeParse({
      version: "1.0.0",
      title: "Some title",
      body: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = createReleaseNoteSchema.safeParse({
      version: "1.0.0",
      title: "Title",
      body: "Body",
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });
});

describe("Bot releases — DB integration", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;
  });

  it("creates a release note and retrieves it", () => {
    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(schema.botReleaseNotes)
      .values({
        id,
        workspaceId,
        version: "1.0.0",
        title: "Initial release",
        body: "First stable release.",
        releaseUrl: "https://example.com/v1.0.0",
        createdAt: now,
      })
      .run();

    const release = db
      .select()
      .from(schema.botReleaseNotes)
      .where(eq(schema.botReleaseNotes.id, id))
      .get();

    expect(release).toBeDefined();
    expect(release!.version).toBe("1.0.0");
    expect(release!.title).toBe("Initial release");
    expect(release!.body).toBe("First stable release.");
    expect(release!.releaseUrl).toBe("https://example.com/v1.0.0");
    expect(release!.workspaceId).toBe(workspaceId);
  });

  it("update check returns no update when bot has no version and no releases exist", async () => {
    const botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Bot A",
        host: "localhost:9090",
        status: "idle",
        statusChangedAt: now,
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        version: null,
        autoUpdate: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const bot = db
      .select({ version: schema.bots.version, autoUpdate: schema.bots.autoUpdate })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    const latestRelease = db
      .select({ version: schema.botReleaseNotes.version })
      .from(schema.botReleaseNotes)
      .where(eq(schema.botReleaseNotes.workspaceId, workspaceId))
      .orderBy(desc(schema.botReleaseNotes.createdAt))
      .limit(1)
      .get();

    const currentVersion = bot!.version ?? null;
    const latestVersion = latestRelease?.version ?? null;
    const updateAvailable =
      latestVersion !== null && latestVersion !== currentVersion;

    expect(updateAvailable).toBe(false);
    expect(currentVersion).toBeNull();
    expect(latestVersion).toBeNull();
  });

  it("update check returns no update when versions match", async () => {
    const botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Bot B",
        host: "localhost:9090",
        status: "idle",
        statusChangedAt: now,
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        version: "2.0.0",
        autoUpdate: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.botReleaseNotes)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        version: "2.0.0",
        title: "v2 release",
        body: "Matching version.",
        createdAt: now,
      })
      .run();

    const bot = db
      .select({ version: schema.bots.version, autoUpdate: schema.bots.autoUpdate })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    const latestRelease = db
      .select({ version: schema.botReleaseNotes.version })
      .from(schema.botReleaseNotes)
      .where(eq(schema.botReleaseNotes.workspaceId, workspaceId))
      .orderBy(desc(schema.botReleaseNotes.createdAt))
      .limit(1)
      .get();

    const currentVersion = bot!.version ?? null;
    const latestVersion = latestRelease?.version ?? null;
    const updateAvailable =
      latestVersion !== null && latestVersion !== currentVersion;

    expect(updateAvailable).toBe(false);
    expect(currentVersion).toBe("2.0.0");
    expect(latestVersion).toBe("2.0.0");
  });

  it("update check returns update available when versions differ", async () => {
    const botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Bot C",
        host: "localhost:9090",
        status: "idle",
        statusChangedAt: now,
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        version: "1.0.0",
        autoUpdate: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.botReleaseNotes)
      .values({
        id: crypto.randomUUID(),
        workspaceId,
        version: "2.0.0",
        title: "Major update",
        body: "New features.",
        releaseUrl: "https://example.com/v2.0.0",
        createdAt: now,
      })
      .run();

    const bot = db
      .select({ version: schema.bots.version, autoUpdate: schema.bots.autoUpdate })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();

    const latestRelease = db
      .select({
        version: schema.botReleaseNotes.version,
        releaseUrl: schema.botReleaseNotes.releaseUrl,
        title: schema.botReleaseNotes.title,
      })
      .from(schema.botReleaseNotes)
      .where(eq(schema.botReleaseNotes.workspaceId, workspaceId))
      .orderBy(desc(schema.botReleaseNotes.createdAt))
      .limit(1)
      .get();

    const currentVersion = bot!.version ?? null;
    const latestVersion = latestRelease?.version ?? null;
    const updateAvailable =
      latestVersion !== null && latestVersion !== currentVersion;

    expect(updateAvailable).toBe(true);
    expect(currentVersion).toBe("1.0.0");
    expect(latestVersion).toBe("2.0.0");
    expect(latestRelease!.releaseUrl).toBe("https://example.com/v2.0.0");
    expect(latestRelease!.title).toBe("Major update");
    expect(bot!.autoUpdate).toBe(1);
  });

  it("auto-update toggle: sets autoUpdate flag on bot", async () => {
    const botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("token", 4);

    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Toggle Bot",
        host: "localhost:9090",
        status: "idle",
        statusChangedAt: now,
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        version: "1.0.0",
        autoUpdate: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Verify default is 0
    let bot = db
      .select({ autoUpdate: schema.bots.autoUpdate })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();
    expect(bot!.autoUpdate).toBe(0);

    // Enable auto-update
    db.update(schema.bots)
      .set({ autoUpdate: 1, updatedAt: Date.now() })
      .where(eq(schema.bots.id, botId))
      .run();

    bot = db
      .select({ autoUpdate: schema.bots.autoUpdate })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();
    expect(bot!.autoUpdate).toBe(1);

    // Disable auto-update
    db.update(schema.bots)
      .set({ autoUpdate: 0, updatedAt: Date.now() })
      .where(eq(schema.bots.id, botId))
      .run();

    bot = db
      .select({ autoUpdate: schema.bots.autoUpdate })
      .from(schema.bots)
      .where(eq(schema.bots.id, botId))
      .get();
    expect(bot!.autoUpdate).toBe(0);
  });
});
