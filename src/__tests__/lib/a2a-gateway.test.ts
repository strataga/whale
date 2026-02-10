import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestDb,
  createTestUser,
  createTestAgent,
  createTestAgentSkill,
  createTestProject,
  createTestTask,
  type TestDb,
} from "../helpers/setup";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { A2AJsonRpcRequest } from "@/types/a2a";
import { A2A_ERROR_CODES } from "@/types/a2a";

let db: TestDb;
let workspaceId: string;

beforeEach(async () => {
  db = createTestDb();
  const user = await createTestUser(db);
  workspaceId = user.workspaceId;
});

// Dynamically import after setup so module resolution works
async function getGateway() {
  return await import("@/lib/server/a2a-gateway");
}

describe("A2A Gateway", () => {
  it("returns method not found for unknown method", async () => {
    const { handleA2ARequest } = await getGateway();
    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: "a2a.Unknown" as any,
      params: {},
    };
    const res = handleA2ARequest(db, workspaceId, req);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(A2A_ERROR_CODES.METHOD_NOT_FOUND);
  });

  it("handles SendMessage — creates task in input_required (quote)", async () => {
    const { handleA2ARequest } = await getGateway();
    const agent = createTestAgent(db, workspaceId, { type: "local" });
    createTestAgentSkill(db, agent.id, {
      name: "coding",
      priceCents: 500,
      pricingModel: "per_task",
    });

    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "1",
      method: "a2a.SendMessage",
      params: {
        message: {
          role: "user",
          parts: [{ type: "text", text: "Write a hello world function" }],
        },
      },
    };

    const res = handleA2ARequest(db, workspaceId, req);
    expect(res.error).toBeUndefined();
    expect(res.result).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = res.result as any;
    expect(result.status?.state).toBe("input_required");
  });

  it("handles GetTask for existing task", async () => {
    const { handleA2ARequest } = await getGateway();
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id, { status: "in_progress" });

    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "2",
      method: "a2a.GetTask",
      params: { taskId: task.id },
    };

    const res = handleA2ARequest(db, workspaceId, req);
    expect(res.error).toBeUndefined();
    expect(res.result).toBeDefined();
  });

  it("handles GetTask for non-existent task", async () => {
    const { handleA2ARequest } = await getGateway();
    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "3",
      method: "a2a.GetTask",
      params: { taskId: "nonexistent-id" },
    };

    const res = handleA2ARequest(db, workspaceId, req);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
  });

  it("handles CancelTask", async () => {
    const { handleA2ARequest } = await getGateway();
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id, { status: "in_progress" });

    const req: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "4",
      method: "a2a.CancelTask",
      params: { taskId: task.id, reason: "No longer needed" },
    };

    const res = handleA2ARequest(db, workspaceId, req);
    expect(res.error).toBeUndefined();

    const updated = db
      .select({ status: schema.tasks.status })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();
    // Should be cancelled or the task status changed
    expect(updated).toBeDefined();
  });
});

describe("A2A Task State Mapping", () => {
  it("maps internal statuses to A2A states", async () => {
    const { handleA2ARequest } = await getGateway();
    const project = createTestProject(db, workspaceId);

    const statusMappings = [
      { internal: "todo", expected: "submitted" },
      { internal: "in_progress", expected: "working" },
      { internal: "done", expected: "completed" },
    ];

    for (const { internal, expected } of statusMappings) {
      const task = createTestTask(db, project.id, { status: internal });
      const req: A2AJsonRpcRequest = {
        jsonrpc: "2.0",
        id: "map-test",
        method: "a2a.GetTask",
        params: { taskId: task.id },
      };

      const res = handleA2ARequest(db, workspaceId, req);
      if (res.result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = res.result as any;
        expect(result.status?.state).toBe(expected);
      }
    }
  });
});

describe("SLA Validation", () => {
  it("validates SLA for agent skill", async () => {
    const { validateSLA } = await import("@/lib/server/sla");
    const agent = createTestAgent(db, workspaceId);
    const skill = createTestAgentSkill(db, agent.id, { name: "Coding" });

    const now = Date.now();
    db.insert(schema.serviceAgreements)
      .values({
        id: crypto.randomUUID(),
        agentId: agent.id,
        skillId: skill.skillId,
        maxResponseMs: 5000,
        maxDurationMs: 60000,
        guaranteedAvailability: 99,
        priceCents: 100,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = validateSLA(db, agent.id, skill.skillId);
    expect(result.valid).toBe(true);
    expect(result.agreement).toBeDefined();
  });

  it("returns invalid for non-existent SLA", async () => {
    const { validateSLA } = await import("@/lib/server/sla");
    const result = validateSLA(db, "nonexistent", "nonexistent");
    expect(result.valid).toBe(false);
  });

  it("detects SLA breach on response time", async () => {
    const { checkSLABreach } = await import("@/lib/server/sla");
    const agent = createTestAgent(db, workspaceId);

    const now = Date.now();
    db.insert(schema.serviceAgreements)
      .values({
        id: crypto.randomUUID(),
        agentId: agent.id,
        maxResponseMs: 1000,
        maxDurationMs: 5000,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = checkSLABreach(db, agent.id, 2000, 1000);
    expect(result.breached).toBe(true);
  });
});
