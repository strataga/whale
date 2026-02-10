import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestDb,
  createTestUser,
  createTestBot,
  createTestProject,
  createTestTask,
  createTestAgent,
  createTestAgentSkill,
  type TestDb,
} from "../helpers/setup";
import {
  createAgent,
  getAgent,
  findAgentsBySkill,
  findAgentsByType,
  updateAgent,
  deleteAgent,
  createAgentFromBot,
  migrateBotsSkillsToAgent,
  updateAgentReputation,
} from "@/lib/server/agent-registry";
import { assignTaskToAgent, findBestAgent, getAgentForBotTask } from "@/lib/server/agent-task-assignment";
import { buildAgentCard, buildHubAgentCard } from "@/lib/server/agent-card";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
let workspaceId: string;

beforeEach(async () => {
  db = createTestDb();
  const user = await createTestUser(db);
  workspaceId = user.workspaceId;
});

describe("Agent Registry", () => {
  it("creates a local agent", () => {
    const agent = createAgent(db, workspaceId, {
      type: "local",
      name: "Code Bot",
      description: "Writes code",
    });
    expect(agent.id).toBeDefined();
    expect(agent.type).toBe("local");
    expect(agent.name).toBe("Code Bot");
  });

  it("creates an external agent with url", () => {
    const agent = createAgent(db, workspaceId, {
      type: "external",
      name: "Remote Agent",
      url: "https://agent.example.com",
    });
    expect(agent.type).toBe("external");
    expect(agent.url).toBe("https://agent.example.com");
  });

  it("gets agent with skills", () => {
    const agent = createTestAgent(db, workspaceId, { name: "Skilled Agent" });
    createTestAgentSkill(db, agent.id, { name: "Coding", tags: ["coding"] });
    createTestAgentSkill(db, agent.id, { name: "Testing", tags: ["testing"] });

    const result = getAgent(db, agent.id);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Skilled Agent");
    expect(result!.skills).toHaveLength(2);
  });

  it("returns null for non-existent agent", () => {
    expect(getAgent(db, "nonexistent")).toBeNull();
  });

  it("returns null for soft-deleted agent", () => {
    const agent = createTestAgent(db, workspaceId);
    deleteAgent(db, agent.id);
    expect(getAgent(db, agent.id)).toBeNull();
  });

  it("finds agents by skill tag", () => {
    const a1 = createTestAgent(db, workspaceId, { name: "Coder" });
    const a2 = createTestAgent(db, workspaceId, { name: "Tester" });
    createTestAgentSkill(db, a1.id, { tags: ["coding", "python"] });
    createTestAgentSkill(db, a2.id, { tags: ["testing", "qa"] });

    const coders = findAgentsBySkill(db, workspaceId, "coding");
    expect(coders).toHaveLength(1);
    expect(coders[0].name).toBe("Coder");
  });

  it("finds agents by type", () => {
    createTestAgent(db, workspaceId, { type: "local", name: "Local" });
    createTestAgent(db, workspaceId, { type: "external", name: "External" });

    const locals = findAgentsByType(db, workspaceId, "local");
    expect(locals).toHaveLength(1);
    expect(locals[0].name).toBe("Local");

    const externals = findAgentsByType(db, workspaceId, "external");
    expect(externals).toHaveLength(1);
    expect(externals[0].name).toBe("External");
  });

  it("updates agent fields", () => {
    const agent = createTestAgent(db, workspaceId);
    updateAgent(db, agent.id, { name: "Updated Name", reputation: 75 });

    const updated = getAgent(db, agent.id);
    expect(updated!.name).toBe("Updated Name");
    expect(updated!.reputation).toBe(75);
  });

  it("adjusts reputation clamped to 0-100", () => {
    const agent = createTestAgent(db, workspaceId, { reputation: 50 });

    updateAgentReputation(db, agent.id, 60);
    expect(getAgent(db, agent.id)!.reputation).toBe(100);

    updateAgentReputation(db, agent.id, -150);
    expect(getAgent(db, agent.id)!.reputation).toBe(0);
  });

  it("creates agent from existing bot and migrates skills", () => {
    const bot = createTestBot(db, workspaceId, { name: "MyBot" });
    // Add bot skills
    const now = Date.now();
    db.insert(schema.botSkills).values({
      id: crypto.randomUUID(),
      botId: bot.id,
      skillName: "coding",
      createdAt: now,
      updatedAt: now,
    }).run();

    const agent = createAgentFromBot(db, workspaceId, bot.id);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("MyBot");
    expect(agent!.type).toBe("local");
    expect(agent!.botId).toBe(bot.id);
  });
});

describe("Agent Task Assignment", () => {
  it("assigns task to local agent via botTask", () => {
    const bot = createTestBot(db, workspaceId);
    const agent = createTestAgent(db, workspaceId, { type: "local", botId: bot.id });
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id);

    const result = assignTaskToAgent(db, task.id, agent.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.botTaskId).toBeDefined();
    }
  });

  it("assigns task to external agent as negotiating", () => {
    const agent = createTestAgent(db, workspaceId, {
      type: "external",
      url: "https://remote.example.com",
    });
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id);

    const result = assignTaskToAgent(db, task.id, agent.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.botTaskId).toBeUndefined();
    }

    // Task should be in negotiating status
    const updatedTask = db
      .select({ status: schema.tasks.status })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();
    expect(updatedTask!.status).toBe("negotiating");
  });

  it("fails for non-existent agent", () => {
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id);
    const result = assignTaskToAgent(db, task.id, "nonexistent");
    expect(result.ok).toBe(false);
  });

  it("finds best agent by skill tag and reputation", () => {
    const a1 = createTestAgent(db, workspaceId, { reputation: 30 });
    const a2 = createTestAgent(db, workspaceId, { reputation: 90 });
    createTestAgentSkill(db, a1.id, { tags: ["coding"] });
    createTestAgentSkill(db, a2.id, { tags: ["coding"] });

    const best = findBestAgent(db, workspaceId, "coding");
    expect(best).toBe(a2.id);
  });

  it("returns null when no agent matches skill", () => {
    const result = findBestAgent(db, workspaceId, "nonexistent-skill");
    expect(result).toBeNull();
  });
});

describe("Agent Card Builder", () => {
  it("builds agent card with skills", () => {
    const agent = createTestAgent(db, workspaceId, {
      name: "Code Agent",
      type: "external",
      url: "https://agent.example.com",
    });
    createTestAgentSkill(db, agent.id, {
      name: "Code Generation",
      tags: ["coding"],
      priceCents: 100,
      pricingModel: "per_task",
    });

    const card = buildAgentCard(db, agent.id);
    expect(card).not.toBeNull();
    expect(card!.name).toBe("Code Agent");
    expect(card!.url).toBe("https://agent.example.com");
    expect(card!.skills).toHaveLength(1);
    expect(card!.skills[0].name).toBe("Code Generation");
    expect(card!.skills[0].price).toBeDefined();
    expect(card!.skills[0].price!.amount).toBe(100);
  });

  it("returns null for non-existent agent", () => {
    expect(buildAgentCard(db, "nonexistent")).toBeNull();
  });

  it("builds hub agent card aggregating all local agents", () => {
    const a1 = createTestAgent(db, workspaceId, { type: "local" });
    const a2 = createTestAgent(db, workspaceId, { type: "local" });
    createTestAgentSkill(db, a1.id, { name: "Skill A" });
    createTestAgentSkill(db, a2.id, { name: "Skill B" });

    // External agent should NOT be included
    const ext = createTestAgent(db, workspaceId, { type: "external" });
    createTestAgentSkill(db, ext.id, { name: "External Skill" });

    const card = buildHubAgentCard(db, workspaceId, "https://whale.example.com");
    expect(card.name).toBe("Whale Hub");
    expect(card.skills).toHaveLength(2);
    expect(card.capabilities.streaming).toBe(true);
  });

  it("handles agent with no skills", () => {
    const agent = createTestAgent(db, workspaceId, { url: "https://empty.example.com" });
    const card = buildAgentCard(db, agent.id);
    expect(card).not.toBeNull();
    expect(card!.skills).toHaveLength(0);
  });
});

describe("Project-less tasks (A2A inbound)", () => {
  it("creates a task without projectId", () => {
    const now = Date.now();
    const id = crypto.randomUUID();
    db.insert(schema.tasks)
      .values({
        id,
        projectId: null,
        title: "A2A Inbound Task",
        sourceProtocol: "a2a",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get();
    expect(task).toBeDefined();
    expect(task!.projectId).toBeNull();
    expect(task!.sourceProtocol).toBe("a2a");
  });
});
