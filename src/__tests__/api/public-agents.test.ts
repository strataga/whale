import { describe, it, expect, beforeEach } from "vitest";
import { eq, and, isNull, sql } from "drizzle-orm";

import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestAgent,
  createTestAgentSkill,
  createTestBot,
  type TestDb,
} from "../helpers/setup";

// ---------------------------------------------------------------------------
// Public Agent Directory (DB-level tests matching route logic)
// ---------------------------------------------------------------------------
describe("Public Agent Directory", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  describe("listing public agents", () => {
    it("returns only public, non-deleted agents", () => {
      createTestAgent(db, workspaceId, {
        name: "Public Bot",
        slug: "public-bot",
        visibility: "public",
      });
      createTestAgent(db, workspaceId, {
        name: "Private Bot",
        slug: "private-bot",
        visibility: "private",
      });
      // Soft-deleted public agent
      const deleted = createTestAgent(db, workspaceId, {
        name: "Deleted Bot",
        slug: "deleted-bot",
        visibility: "public",
      });
      db.update(schema.agents)
        .set({ deletedAt: Date.now() })
        .where(eq(schema.agents.id, deleted.id))
        .run();

      const publicAgents = db
        .select({
          slug: schema.agents.slug,
          name: schema.agents.name,
          visibility: schema.agents.visibility,
        })
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.workspaceId, workspaceId),
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .all();

      expect(publicAgents).toHaveLength(1);
      expect(publicAgents[0].name).toBe("Public Bot");
    });

    it("filters by agentRole", () => {
      createTestAgent(db, workspaceId, {
        name: "Reviewer",
        slug: "reviewer-1",
        visibility: "public",
        agentRole: "reviewer",
      });
      createTestAgent(db, workspaceId, {
        name: "Generic",
        slug: "generic-1",
        visibility: "public",
        agentRole: "agent",
      });

      const reviewers = db
        .select()
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.visibility, "public"),
            eq(schema.agents.agentRole, "reviewer"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .all();

      expect(reviewers).toHaveLength(1);
      expect(reviewers[0].name).toBe("Reviewer");
    });

    it("filters by tag (JSON LIKE match)", () => {
      createTestAgent(db, workspaceId, {
        name: "TS Agent",
        slug: "ts-agent",
        visibility: "public",
        tags: ["typescript", "backend"],
      });
      createTestAgent(db, workspaceId, {
        name: "Python Agent",
        slug: "py-agent",
        visibility: "public",
        tags: ["python"],
      });

      const searchTerm = "%typescript%";
      const matched = db
        .select()
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
            sql`${schema.agents.tags} LIKE ${searchTerm}`,
          ),
        )
        .all();

      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe("TS Agent");
    });

    it("paginates with limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        createTestAgent(db, workspaceId, {
          name: `Agent ${i}`,
          slug: `agent-page-${i}`,
          visibility: "public",
          reputation: 50 + i,
        });
      }

      const page = db
        .select({ name: schema.agents.name })
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .limit(2)
        .offset(2)
        .all();

      expect(page).toHaveLength(2);
    });
  });

  describe("agent profile by slug", () => {
    it("fetches full profile for a public agent", () => {
      createTestAgent(db, workspaceId, {
        name: "CodeBot",
        slug: "codebot",
        visibility: "public",
        tagline: "I write code",
        bio: "A helpful coding agent",
        agentRole: "specialist",
        tags: ["typescript"],
        hourlyRate: 500,
      });

      const agent = db
        .select()
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.slug, "codebot"),
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .get();

      expect(agent).toBeDefined();
      expect(agent!.name).toBe("CodeBot");
      expect(agent!.tagline).toBe("I write code");
      expect(agent!.agentRole).toBe("specialist");
      expect(agent!.hourlyRate).toBe(500);
      expect(JSON.parse(agent!.tags)).toEqual(["typescript"]);
    });

    it("returns undefined for private agent slug", () => {
      createTestAgent(db, workspaceId, {
        name: "Hidden",
        slug: "hidden",
        visibility: "private",
      });

      const agent = db
        .select()
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.slug, "hidden"),
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .get();

      expect(agent).toBeUndefined();
    });

    it("returns undefined for deleted agent slug", () => {
      const a = createTestAgent(db, workspaceId, {
        name: "Gone",
        slug: "gone",
        visibility: "public",
      });
      db.update(schema.agents)
        .set({ deletedAt: Date.now() })
        .where(eq(schema.agents.id, a.id))
        .run();

      const agent = db
        .select()
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.slug, "gone"),
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .get();

      expect(agent).toBeUndefined();
    });
  });

  describe("agent skills", () => {
    it("fetches skills for a public agent", () => {
      const agent = createTestAgent(db, workspaceId, {
        name: "Skilled Bot",
        slug: "skilled",
        visibility: "public",
      });

      createTestAgentSkill(db, agent.id, {
        name: "Code Review",
        description: "Reviews code changes",
        priceCents: 100,
        pricingModel: "per_task",
      });
      createTestAgentSkill(db, agent.id, {
        name: "Write Tests",
        description: "Writes test suites",
        priceCents: null,
        pricingModel: "free",
      });

      const skills = db
        .select()
        .from(schema.agentSkills)
        .where(eq(schema.agentSkills.agentId, agent.id))
        .all();

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name).sort()).toEqual(["Code Review", "Write Tests"]);
    });
  });

  describe("agent profile update", () => {
    it("updates profile fields", () => {
      const agent = createTestAgent(db, workspaceId, {
        name: "Updatable",
        slug: "updatable",
        visibility: "public",
      });

      db.update(schema.agents)
        .set({
          tagline: "Updated tagline",
          bio: "New bio content",
          agentRole: "reviewer",
          tags: JSON.stringify(["updated"]),
          updatedAt: Date.now(),
        })
        .where(eq(schema.agents.id, agent.id))
        .run();

      const updated = db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, agent.id))
        .get();

      expect(updated!.tagline).toBe("Updated tagline");
      expect(updated!.bio).toBe("New bio content");
      expect(updated!.agentRole).toBe("reviewer");
      expect(JSON.parse(updated!.tags)).toEqual(["updated"]);
    });
  });

  describe("agent soft-delete", () => {
    it("soft-deletes an agent", () => {
      const agent = createTestAgent(db, workspaceId, {
        name: "To Delete",
        slug: "to-delete",
        visibility: "public",
      });

      db.update(schema.agents)
        .set({ deletedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(schema.agents.id, agent.id))
        .run();

      const active = db
        .select()
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.workspaceId, workspaceId),
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .all();

      expect(active.find((a) => a.id === agent.id)).toBeUndefined();
    });
  });

  describe("directory search", () => {
    it("finds agents matching name", () => {
      createTestAgent(db, workspaceId, {
        name: "CodeReviewer",
        slug: "code-reviewer",
        visibility: "public",
        tagline: "Reviews code",
      });
      createTestAgent(db, workspaceId, {
        name: "TestWriter",
        slug: "test-writer",
        visibility: "public",
        tagline: "Writes tests",
      });

      const searchTerm = "%Code%";
      const results = db
        .select({ slug: schema.agents.slug, name: schema.agents.name })
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
            sql`(${schema.agents.name} LIKE ${searchTerm} OR ${schema.agents.tagline} LIKE ${searchTerm})`,
          ),
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("CodeReviewer");
    });

    it("finds agents matching tagline", () => {
      createTestAgent(db, workspaceId, {
        name: "Bot A",
        slug: "bot-a",
        visibility: "public",
        tagline: "Expert at security audits",
      });

      const searchTerm = "%security%";
      const results = db
        .select({ name: schema.agents.name })
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
            sql`(${schema.agents.name} LIKE ${searchTerm} OR ${schema.agents.tagline} LIKE ${searchTerm} OR ${schema.agents.bio} LIKE ${searchTerm})`,
          ),
        )
        .all();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Bot A");
    });
  });

  describe("directory stats", () => {
    it("counts total public agents", () => {
      createTestAgent(db, workspaceId, { slug: "a1", visibility: "public" });
      createTestAgent(db, workspaceId, { slug: "a2", visibility: "public" });
      createTestAgent(db, workspaceId, { slug: "a3", visibility: "private" });

      const total = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.agents)
        .where(
          and(
            eq(schema.agents.visibility, "public"),
            isNull(schema.agents.deletedAt),
          ),
        )
        .get()!.count;

      expect(total).toBe(2);
    });
  });

  describe("agent status", () => {
    it("shows linked bot status via botId join", () => {
      const bot = createTestBot(db, workspaceId, {
        name: "Live Bot",
        status: "busy",
      });

      createTestAgent(db, workspaceId, {
        name: "Live Agent",
        slug: "live-agent",
        visibility: "public",
        botId: bot.id,
        status: "busy",
      });

      const agent = db
        .select({
          name: schema.agents.name,
          status: schema.agents.status,
          botId: schema.agents.botId,
        })
        .from(schema.agents)
        .where(eq(schema.agents.slug, "live-agent"))
        .get();

      expect(agent).toBeDefined();
      expect(agent!.botId).toBe(bot.id);

      // Fetch bot to get lastSeenAt etc.
      const linkedBot = db
        .select({ status: schema.bots.status, lastSeenAt: schema.bots.lastSeenAt })
        .from(schema.bots)
        .where(eq(schema.bots.id, agent!.botId!))
        .get();
      expect(linkedBot!.status).toBe("busy");
    });
  });
});
