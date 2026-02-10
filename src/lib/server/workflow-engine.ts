import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

export interface WorkflowStep {
  id: string;
  name: string;
  type: "bot_task" | "approval" | "wait" | "parallel";
  botGroupId?: string;
  dependsOn?: string[];
  config?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  steps: WorkflowStep[];
  onFailure?: "stop" | "continue" | "retry";
}

/**
 * Parse and validate a workflow definition JSON.
 */
export function parseWorkflowDefinition(raw: string): WorkflowDefinition {
  const parsed = JSON.parse(raw);
  if (!parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error("Workflow definition must have a 'steps' array");
  }
  return parsed as WorkflowDefinition;
}

/**
 * Topological sort of workflow steps based on dependsOn edges.
 * Throws if a cycle is detected.
 */
export function topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: WorkflowStep[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cycle detected in workflow at step '${id}'`);
    visiting.add(id);
    const step = stepMap.get(id);
    if (!step) throw new Error(`Unknown step '${id}'`);
    for (const dep of step.dependsOn ?? []) {
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
    sorted.push(step);
  }

  for (const step of steps) {
    visit(step.id);
  }

  return sorted;
}

/**
 * Find steps that are ready to execute (all dependencies completed).
 */
export function findReadySteps(
  db: Db,
  workflowRunId: string,
  definition: WorkflowDefinition,
): WorkflowStep[] {
  const runSteps = db
    .select()
    .from(schema.workflowRunSteps)
    .where(eq(schema.workflowRunSteps.workflowRunId, workflowRunId))
    .all();

  const statusMap = new Map(runSteps.map((s) => [s.stepId, s.status]));
  const ready: WorkflowStep[] = [];

  for (const step of definition.steps) {
    const current = statusMap.get(step.id);
    if (current && current !== "pending") continue;

    const depsComplete = (step.dependsOn ?? []).every(
      (dep) => statusMap.get(dep) === "completed",
    );
    if (depsComplete) {
      ready.push(step);
    }
  }

  return ready;
}

/**
 * Start a workflow run: create run record, initialize step records, execute first ready steps.
 */
export function startWorkflowRun(
  db: Db,
  workflowId: string,
  workspaceId: string,
): { runId: string; stepsInitialized: number } {
  const workflow = db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.workspaceId, workspaceId)))
    .get();

  if (!workflow) throw new Error("Workflow not found");

  const definition = parseWorkflowDefinition(workflow.definition);
  // Validate DAG
  topologicalSort(definition.steps);

  const runId = crypto.randomUUID();
  const now = Date.now();

  db.insert(schema.workflowRuns)
    .values({ id: runId, workflowId, status: "running", startedAt: now, createdAt: now })
    .run();

  for (const step of definition.steps) {
    db.insert(schema.workflowRunSteps)
      .values({
        id: crypto.randomUUID(),
        workflowRunId: runId,
        stepId: step.id,
        status: "pending",
        createdAt: now,
      })
      .run();
  }

  return { runId, stepsInitialized: definition.steps.length };
}

/**
 * Advance a workflow run: find ready steps, mark them running, create botTasks for bot_task steps.
 */
export function advanceWorkflowRun(
  db: Db,
  workflowRunId: string,
): { advanced: string[]; completed: boolean } {
  const run = db
    .select()
    .from(schema.workflowRuns)
    .where(eq(schema.workflowRuns.id, workflowRunId))
    .get();

  if (!run || run.status !== "running") return { advanced: [], completed: false };

  const workflow = db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.id, run.workflowId))
    .get();

  if (!workflow) return { advanced: [], completed: false };

  const definition = parseWorkflowDefinition(workflow.definition);
  const readySteps = findReadySteps(db, workflowRunId, definition);
  const advanced: string[] = [];
  const now = Date.now();

  for (const step of readySteps) {
    db.update(schema.workflowRunSteps)
      .set({ status: "running", startedAt: now })
      .where(
        and(
          eq(schema.workflowRunSteps.workflowRunId, workflowRunId),
          eq(schema.workflowRunSteps.stepId, step.id),
        ),
      )
      .run();
    advanced.push(step.id);
  }

  // Check if all steps are completed
  const allSteps = db
    .select()
    .from(schema.workflowRunSteps)
    .where(eq(schema.workflowRunSteps.workflowRunId, workflowRunId))
    .all();

  const allDone = allSteps.every(
    (s) => s.status === "completed" || s.status === "failed" || s.status === "skipped",
  );

  if (allDone) {
    const anyFailed = allSteps.some((s) => s.status === "failed");
    db.update(schema.workflowRuns)
      .set({
        status: anyFailed ? "failed" : "completed",
        completedAt: now,
      })
      .where(eq(schema.workflowRuns.id, workflowRunId))
      .run();
    return { advanced, completed: true };
  }

  return { advanced, completed: false };
}

/**
 * Mark a workflow step as completed and advance the run.
 */
export function completeWorkflowStep(
  db: Db,
  workflowRunId: string,
  stepId: string,
  result?: string,
): { completed: boolean } {
  const now = Date.now();
  db.update(schema.workflowRunSteps)
    .set({ status: "completed", result: result ?? null, completedAt: now })
    .where(
      and(
        eq(schema.workflowRunSteps.workflowRunId, workflowRunId),
        eq(schema.workflowRunSteps.stepId, stepId),
      ),
    )
    .run();

  const { completed } = advanceWorkflowRun(db, workflowRunId);
  return { completed };
}
