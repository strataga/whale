import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";

import {
  topologicalSort,
  parseWorkflowDefinition,
  findReadySteps,
  startWorkflowRun,
  advanceWorkflowRun,
  completeWorkflowStep,
  type WorkflowStep,
} from "@/lib/server/workflow-engine";
import { workflowRuns, workflowRunSteps, workflows } from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestWorkflow,
  type TestDb,
} from "../helpers/setup";

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------
describe("topologicalSort", () => {
  it("sorts a linear chain A -> B -> C", () => {
    const steps: WorkflowStep[] = [
      { id: "C", name: "Step C", type: "bot_task", dependsOn: ["B"] },
      { id: "B", name: "Step B", type: "bot_task", dependsOn: ["A"] },
      { id: "A", name: "Step A", type: "bot_task" },
    ];

    const sorted = topologicalSort(steps);
    const ids = sorted.map((s) => s.id);

    // A must come before B, B before C
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("C"));
  });

  it("handles parallel steps with no dependencies", () => {
    const steps: WorkflowStep[] = [
      { id: "X", name: "Step X", type: "bot_task" },
      { id: "Y", name: "Step Y", type: "approval" },
      { id: "Z", name: "Step Z", type: "wait" },
    ];

    const sorted = topologicalSort(steps);
    expect(sorted).toHaveLength(3);
    // All three should be present
    const ids = sorted.map((s) => s.id);
    expect(ids).toContain("X");
    expect(ids).toContain("Y");
    expect(ids).toContain("Z");
  });

  it("handles a diamond dependency: A -> B, A -> C, B -> D, C -> D", () => {
    const steps: WorkflowStep[] = [
      { id: "D", name: "Step D", type: "bot_task", dependsOn: ["B", "C"] },
      { id: "B", name: "Step B", type: "bot_task", dependsOn: ["A"] },
      { id: "C", name: "Step C", type: "bot_task", dependsOn: ["A"] },
      { id: "A", name: "Step A", type: "bot_task" },
    ];

    const sorted = topologicalSort(steps);
    const ids = sorted.map((s) => s.id);

    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("B"));
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("C"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("D"));
    expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("D"));
  });

  it("throws on a direct cycle (A <-> B)", () => {
    const steps: WorkflowStep[] = [
      { id: "A", name: "Step A", type: "bot_task", dependsOn: ["B"] },
      { id: "B", name: "Step B", type: "bot_task", dependsOn: ["A"] },
    ];

    expect(() => topologicalSort(steps)).toThrow(/[Cc]ycle/);
  });

  it("throws on a transitive cycle (A -> B -> C -> A)", () => {
    const steps: WorkflowStep[] = [
      { id: "A", name: "Step A", type: "bot_task", dependsOn: ["C"] },
      { id: "B", name: "Step B", type: "bot_task", dependsOn: ["A"] },
      { id: "C", name: "Step C", type: "bot_task", dependsOn: ["B"] },
    ];

    expect(() => topologicalSort(steps)).toThrow(/[Cc]ycle/);
  });

  it("throws on unknown step reference in dependsOn", () => {
    const steps: WorkflowStep[] = [
      { id: "A", name: "Step A", type: "bot_task", dependsOn: ["missing"] },
    ];

    expect(() => topologicalSort(steps)).toThrow(/[Uu]nknown step/);
  });

  it("returns empty array for empty input", () => {
    expect(topologicalSort([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseWorkflowDefinition
// ---------------------------------------------------------------------------
describe("parseWorkflowDefinition", () => {
  it("parses valid JSON with steps array", () => {
    const raw = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "approval", dependsOn: ["s1"] },
      ],
      onFailure: "stop",
    });

    const def = parseWorkflowDefinition(raw);
    expect(def.steps).toHaveLength(2);
    expect(def.steps[0].id).toBe("s1");
    expect(def.onFailure).toBe("stop");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseWorkflowDefinition("not json")).toThrow();
  });

  it("throws when steps is missing", () => {
    const raw = JSON.stringify({ name: "no steps here" });
    expect(() => parseWorkflowDefinition(raw)).toThrow(/steps/);
  });

  it("throws when steps is not an array", () => {
    const raw = JSON.stringify({ steps: "not-an-array" });
    expect(() => parseWorkflowDefinition(raw)).toThrow(/steps/);
  });

  it("accepts an empty steps array", () => {
    const raw = JSON.stringify({ steps: [] });
    const def = parseWorkflowDefinition(raw);
    expect(def.steps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findReadySteps
// ---------------------------------------------------------------------------
describe("findReadySteps", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  function insertRunAndSteps(
    workflowId: string,
    steps: { stepId: string; status: string }[],
  ): string {
    const runId = crypto.randomUUID();
    const now = Date.now();

    db.insert(workflowRuns)
      .values({
        id: runId,
        workflowId,
        status: "running",
        startedAt: now,
        createdAt: now,
      })
      .run();

    for (const s of steps) {
      db.insert(workflowRunSteps)
        .values({
          id: crypto.randomUUID(),
          workflowRunId: runId,
          stepId: s.stepId,
          status: s.status,
          createdAt: now,
        })
        .run();
    }

    return runId;
  }

  it("returns steps with no dependencies as ready", () => {
    const workflow = createTestWorkflow(db, workspaceId);
    const definition = {
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" as const },
        { id: "s2", name: "Step 2", type: "bot_task" as const },
      ],
    };

    const runId = insertRunAndSteps(workflow.id, [
      { stepId: "s1", status: "pending" },
      { stepId: "s2", status: "pending" },
    ]);

    const ready = findReadySteps(db, runId, definition);
    const ids = ready.map((s) => s.id);
    expect(ids).toContain("s1");
    expect(ids).toContain("s2");
  });

  it("does not return steps whose dependencies are not completed", () => {
    const workflow = createTestWorkflow(db, workspaceId);
    const definition = {
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" as const },
        { id: "s2", name: "Step 2", type: "bot_task" as const, dependsOn: ["s1"] },
      ],
    };

    const runId = insertRunAndSteps(workflow.id, [
      { stepId: "s1", status: "pending" },
      { stepId: "s2", status: "pending" },
    ]);

    const ready = findReadySteps(db, runId, definition);
    const ids = ready.map((s) => s.id);
    expect(ids).toContain("s1");
    expect(ids).not.toContain("s2");
  });

  it("returns step when all dependencies are completed", () => {
    const workflow = createTestWorkflow(db, workspaceId);
    const definition = {
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" as const },
        { id: "s2", name: "Step 2", type: "bot_task" as const, dependsOn: ["s1"] },
      ],
    };

    const runId = insertRunAndSteps(workflow.id, [
      { stepId: "s1", status: "completed" },
      { stepId: "s2", status: "pending" },
    ]);

    const ready = findReadySteps(db, runId, definition);
    const ids = ready.map((s) => s.id);
    expect(ids).toContain("s2");
    expect(ids).not.toContain("s1"); // already completed, not pending
  });

  it("skips steps that are already running", () => {
    const workflow = createTestWorkflow(db, workspaceId);
    const definition = {
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" as const },
      ],
    };

    const runId = insertRunAndSteps(workflow.id, [
      { stepId: "s1", status: "running" },
    ]);

    const ready = findReadySteps(db, runId, definition);
    expect(ready).toHaveLength(0);
  });

  it("skips steps that are already completed", () => {
    const workflow = createTestWorkflow(db, workspaceId);
    const definition = {
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" as const },
      ],
    };

    const runId = insertRunAndSteps(workflow.id, [
      { stepId: "s1", status: "completed" },
    ]);

    const ready = findReadySteps(db, runId, definition);
    expect(ready).toHaveLength(0);
  });

  it("blocks step when only some dependencies are completed", () => {
    const workflow = createTestWorkflow(db, workspaceId);
    const definition = {
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" as const },
        { id: "s2", name: "Step 2", type: "bot_task" as const },
        { id: "s3", name: "Step 3", type: "bot_task" as const, dependsOn: ["s1", "s2"] },
      ],
    };

    const runId = insertRunAndSteps(workflow.id, [
      { stepId: "s1", status: "completed" },
      { stepId: "s2", status: "running" },
      { stepId: "s3", status: "pending" },
    ]);

    const ready = findReadySteps(db, runId, definition);
    expect(ready).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// startWorkflowRun
// ---------------------------------------------------------------------------
describe("startWorkflowRun", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  it("creates a run record and initializes step records", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "approval", dependsOn: ["s1"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId, stepsInitialized } = startWorkflowRun(db, workflow.id, workspaceId);

    expect(runId).toBeTruthy();
    expect(stepsInitialized).toBe(2);

    // Verify the run was persisted
    const run = db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .get();

    expect(run).toBeDefined();
    expect(run!.status).toBe("running");
    expect(run!.workflowId).toBe(workflow.id);

    // Verify step records were created
    const steps = db
      .select()
      .from(workflowRunSteps)
      .where(eq(workflowRunSteps.workflowRunId, runId))
      .all();

    expect(steps).toHaveLength(2);
    expect(steps.every((s) => s.status === "pending")).toBe(true);

    const stepIds = steps.map((s) => s.stepId);
    expect(stepIds).toContain("s1");
    expect(stepIds).toContain("s2");
  });

  it("throws when workflow is not found", () => {
    expect(() =>
      startWorkflowRun(db, "nonexistent-id", workspaceId),
    ).toThrow(/not found/i);
  });

  it("throws when workflow belongs to a different workspace", () => {
    const definition = JSON.stringify({
      steps: [{ id: "s1", name: "Step 1", type: "bot_task" }],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });

    expect(() =>
      startWorkflowRun(db, workflow.id, "other-workspace-id"),
    ).toThrow(/not found/i);
  });

  it("throws when definition contains a cycle", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "A", name: "A", type: "bot_task", dependsOn: ["B"] },
        { id: "B", name: "B", type: "bot_task", dependsOn: ["A"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });

    expect(() =>
      startWorkflowRun(db, workflow.id, workspaceId),
    ).toThrow(/[Cc]ycle/);
  });

  it("works with an empty steps array", () => {
    const definition = JSON.stringify({ steps: [] });
    const workflow = createTestWorkflow(db, workspaceId, { definition });

    const { runId, stepsInitialized } = startWorkflowRun(db, workflow.id, workspaceId);
    expect(stepsInitialized).toBe(0);

    const steps = db
      .select()
      .from(workflowRunSteps)
      .where(eq(workflowRunSteps.workflowRunId, runId))
      .all();

    expect(steps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// advanceWorkflowRun
// ---------------------------------------------------------------------------
describe("advanceWorkflowRun", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  it("marks ready steps as running", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "bot_task", dependsOn: ["s1"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    const { advanced, completed } = advanceWorkflowRun(db, runId);

    expect(advanced).toContain("s1");
    expect(advanced).not.toContain("s2");
    expect(completed).toBe(false);

    // Verify s1 is now running in DB
    const s1 = db
      .select()
      .from(workflowRunSteps)
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s1"),
        ),
      )
      .get();

    expect(s1!.status).toBe("running");
  });

  it("detects completion when all steps are completed", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    // Manually mark step as completed
    db.update(workflowRunSteps)
      .set({ status: "completed", completedAt: Date.now() })
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s1"),
        ),
      )
      .run();

    const { completed } = advanceWorkflowRun(db, runId);
    expect(completed).toBe(true);

    // Verify run is marked as completed
    const run = db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .get();

    expect(run!.status).toBe("completed");
    expect(run!.completedAt).toBeTruthy();
  });

  it("marks run as failed when any step is failed and all are terminal", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "bot_task" },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    const now = Date.now();
    db.update(workflowRunSteps)
      .set({ status: "completed", completedAt: now })
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s1"),
        ),
      )
      .run();

    db.update(workflowRunSteps)
      .set({ status: "failed", completedAt: now })
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s2"),
        ),
      )
      .run();

    const { completed } = advanceWorkflowRun(db, runId);
    expect(completed).toBe(true);

    const run = db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .get();

    expect(run!.status).toBe("failed");
  });

  it("returns empty when run is not in running state", () => {
    const definition = JSON.stringify({
      steps: [{ id: "s1", name: "Step 1", type: "bot_task" }],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    // Mark run as completed manually
    db.update(workflowRuns)
      .set({ status: "completed" })
      .where(eq(workflowRuns.id, runId))
      .run();

    const result = advanceWorkflowRun(db, runId);
    expect(result.advanced).toEqual([]);
    expect(result.completed).toBe(false);
  });

  it("returns empty for a nonexistent run ID", () => {
    const result = advanceWorkflowRun(db, "nonexistent-run");
    expect(result.advanced).toEqual([]);
    expect(result.completed).toBe(false);
  });

  it("advances multiple parallel steps at once", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "bot_task" },
        { id: "s3", name: "Step 3", type: "bot_task", dependsOn: ["s1", "s2"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    const { advanced, completed } = advanceWorkflowRun(db, runId);

    expect(advanced).toContain("s1");
    expect(advanced).toContain("s2");
    expect(advanced).not.toContain("s3");
    expect(completed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// completeWorkflowStep
// ---------------------------------------------------------------------------
describe("completeWorkflowStep", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  it("marks a step as completed with a result", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "bot_task", dependsOn: ["s1"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    // Mark s1 as running first (as advanceWorkflowRun would)
    advanceWorkflowRun(db, runId);

    const { completed } = completeWorkflowStep(db, runId, "s1", "success output");
    expect(completed).toBe(false); // s2 still pending

    // Verify the step record
    const s1 = db
      .select()
      .from(workflowRunSteps)
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s1"),
        ),
      )
      .get();

    expect(s1!.status).toBe("completed");
    expect(s1!.result).toBe("success output");
    expect(s1!.completedAt).toBeTruthy();
  });

  it("triggers advance and unblocks dependent steps", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
        { id: "s2", name: "Step 2", type: "bot_task", dependsOn: ["s1"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    // Advance to start s1
    advanceWorkflowRun(db, runId);

    // Complete s1 — should trigger advance which marks s2 as running
    completeWorkflowStep(db, runId, "s1");

    const s2 = db
      .select()
      .from(workflowRunSteps)
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s2"),
        ),
      )
      .get();

    expect(s2!.status).toBe("running");
  });

  it("returns completed=true when it was the last step", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "s1", name: "Step 1", type: "bot_task" },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    // Advance to start s1
    advanceWorkflowRun(db, runId);

    const { completed } = completeWorkflowStep(db, runId, "s1", "done");
    expect(completed).toBe(true);

    // Verify the run is marked completed
    const run = db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .get();

    expect(run!.status).toBe("completed");
  });

  it("completes without a result string (defaults to null)", () => {
    const definition = JSON.stringify({
      steps: [{ id: "s1", name: "Step 1", type: "bot_task" }],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    advanceWorkflowRun(db, runId);
    completeWorkflowStep(db, runId, "s1");

    const s1 = db
      .select()
      .from(workflowRunSteps)
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "s1"),
        ),
      )
      .get();

    expect(s1!.status).toBe("completed");
    expect(s1!.result).toBeNull();
  });

  it("handles a full multi-step workflow end-to-end", () => {
    const definition = JSON.stringify({
      steps: [
        { id: "build", name: "Build", type: "bot_task" },
        { id: "test", name: "Test", type: "bot_task", dependsOn: ["build"] },
        { id: "deploy", name: "Deploy", type: "bot_task", dependsOn: ["test"] },
      ],
    });

    const workflow = createTestWorkflow(db, workspaceId, { definition });
    const { runId } = startWorkflowRun(db, workflow.id, workspaceId);

    // Advance: build should start
    const a1 = advanceWorkflowRun(db, runId);
    expect(a1.advanced).toEqual(["build"]);

    // Complete build -> test starts
    const r1 = completeWorkflowStep(db, runId, "build", "build ok");
    expect(r1.completed).toBe(false);

    // Verify test is now running
    const testStep = db
      .select()
      .from(workflowRunSteps)
      .where(
        and(
          eq(workflowRunSteps.workflowRunId, runId),
          eq(workflowRunSteps.stepId, "test"),
        ),
      )
      .get();
    expect(testStep!.status).toBe("running");

    // Complete test -> deploy starts
    const r2 = completeWorkflowStep(db, runId, "test", "tests pass");
    expect(r2.completed).toBe(false);

    // Complete deploy -> workflow done
    const r3 = completeWorkflowStep(db, runId, "deploy", "deployed");
    expect(r3.completed).toBe(true);

    // Verify final run status
    const run = db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .get();

    expect(run!.status).toBe("completed");
    expect(run!.completedAt).toBeTruthy();
  });
});
