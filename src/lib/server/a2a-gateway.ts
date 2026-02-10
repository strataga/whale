import { eq, and, isNull } from "drizzle-orm";

import { agents, agentSkills, tasks } from "@/lib/db/schema";
import type {
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2AJsonRpcError,
  A2ASendMessageParams,
  A2AGetTaskParams,
  A2ACancelTaskParams,
  A2AListTasksParams,
  A2ATask,
  A2ATaskState,
  A2AMessage,
  A2AQuote,
} from "@/types/a2a";
import { A2A_ERROR_CODES } from "@/types/a2a";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpcError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown,
): A2AJsonRpcResponse {
  const error: A2AJsonRpcError = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

function rpcResult(id: string | number, result: unknown): A2AJsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function taskToA2A(task: typeof tasks.$inferSelect): A2ATask {
  const stateMap: Record<string, A2ATaskState> = {
    todo: "submitted",
    in_progress: "working",
    negotiating: "input_required",
    done: "completed",
    cancelled: "canceled",
    failed: "failed",
  };

  const messages: A2AMessage[] = [];
  if (task.description) {
    messages.push({
      role: "user",
      parts: [{ type: "text", text: task.description }],
    });
  }

  return {
    id: task.id,
    sessionId: task.projectId ?? task.id,
    status: {
      state: stateMap[task.status] ?? "submitted",
      timestamp: new Date(task.createdAt).toISOString(),
    },
    messages,
  };
}

function buildQuote(skillRow: typeof agentSkills.$inferSelect | null): A2AQuote {
  const priceCents = skillRow?.priceCents ?? 0;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  return {
    priceCents,
    currency: "USD",
    estimatedDurationMs: 60_000,
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Method Handlers
// ---------------------------------------------------------------------------

function handleSendMessage(
  db: AnyDb,
  workspaceId: string,
  id: string | number,
  params: A2ASendMessageParams,
): A2AJsonRpcResponse {
  if (!params.message || !params.message.parts || params.message.parts.length === 0) {
    return rpcError(id, A2A_ERROR_CODES.INVALID_PARAMS, "message.parts is required");
  }

  // Extract text from first text part
  const textPart = params.message.parts.find((p) => p.type === "text");
  const taskDescription = textPart && "text" in textPart ? textPart.text : "";

  if (!taskDescription) {
    return rpcError(id, A2A_ERROR_CODES.INVALID_PARAMS, "message must contain a text part");
  }

  // If acceptQuote is set, create the task and assign it
  if (params.acceptQuote) {
    const sessionId = params.sessionId ?? crypto.randomUUID();
    const taskId = crypto.randomUUID();
    const now = Date.now();

    db.insert(tasks)
      .values({
        id: taskId,
        title: taskDescription.slice(0, 200),
        description: taskDescription,
        status: "todo",
        priority: "medium",
        sourceProtocol: "a2a",
        tags: "[]",
        position: 0,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!created) {
      return rpcError(id, A2A_ERROR_CODES.INTERNAL_ERROR, "Failed to create task");
    }

    const a2aTask = taskToA2A(created);
    a2aTask.sessionId = sessionId;
    a2aTask.status.state = "submitted";

    return rpcResult(id, a2aTask);
  }

  // First call: return a quote in input_required state
  // Try to find the best matching skill for the quote
  const agentRows = db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.workspaceId, workspaceId),
        isNull(agents.deletedAt),
      ),
    )
    .all();

  let matchedSkill: typeof agentSkills.$inferSelect | null = null;

  for (const agent of agentRows) {
    const skills = db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, agent.id))
      .all();

    if (skills.length > 0) {
      matchedSkill = skills[0];
      break;
    }
  }

  const quote = buildQuote(matchedSkill);
  const sessionId = params.sessionId ?? crypto.randomUUID();

  const pendingTask: A2ATask = {
    id: crypto.randomUUID(),
    sessionId,
    status: {
      state: "input_required",
      message: {
        role: "agent",
        parts: [
          {
            type: "data",
            data: { quote },
          },
          {
            type: "text",
            text: `Quote: ${quote.priceCents} cents (${quote.currency}). Send again with acceptQuote=true to proceed.`,
          },
        ],
      },
      timestamp: new Date().toISOString(),
    },
    messages: [params.message],
    metadata: { quote },
  };

  return rpcResult(id, pendingTask);
}

function handleGetTask(
  db: AnyDb,
  _workspaceId: string,
  id: string | number,
  params: A2AGetTaskParams,
): A2AJsonRpcResponse {
  if (!params.taskId) {
    return rpcError(id, A2A_ERROR_CODES.INVALID_PARAMS, "taskId is required");
  }

  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), isNull(tasks.deletedAt)))
    .get();

  if (!task) {
    return rpcError(id, A2A_ERROR_CODES.TASK_NOT_FOUND, "Task not found");
  }

  return rpcResult(id, taskToA2A(task));
}

function handleCancelTask(
  db: AnyDb,
  _workspaceId: string,
  id: string | number,
  params: A2ACancelTaskParams,
): A2AJsonRpcResponse {
  if (!params.taskId) {
    return rpcError(id, A2A_ERROR_CODES.INVALID_PARAMS, "taskId is required");
  }

  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), isNull(tasks.deletedAt)))
    .get();

  if (!task) {
    return rpcError(id, A2A_ERROR_CODES.TASK_NOT_FOUND, "Task not found");
  }

  if (task.status === "done") {
    return rpcError(
      id,
      A2A_ERROR_CODES.INVALID_REQUEST,
      "Cannot cancel a completed task",
    );
  }

  const now = Date.now();
  db.update(tasks)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(tasks.id, params.taskId))
    .run();

  const updated = db.select().from(tasks).where(eq(tasks.id, params.taskId)).get();
  if (!updated) {
    return rpcError(id, A2A_ERROR_CODES.INTERNAL_ERROR, "Failed to update task");
  }

  const a2aTask = taskToA2A(updated);
  if (params.reason) {
    a2aTask.status.message = {
      role: "user",
      parts: [{ type: "text", text: params.reason }],
    };
  }

  return rpcResult(id, a2aTask);
}

function handleListTasks(
  db: AnyDb,
  _workspaceId: string,
  id: string | number,
  params: A2AListTasksParams,
): A2AJsonRpcResponse {
  if (!params.sessionId) {
    return rpcError(id, A2A_ERROR_CODES.INVALID_PARAMS, "sessionId is required");
  }

  // sessionId maps to projectId in our data model
  const taskRows = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, params.sessionId),
        isNull(tasks.deletedAt),
      ),
    )
    .all();

  // Also include tasks with sourceProtocol = a2a that have no projectId
  const a2aTasks = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.sourceProtocol, "a2a"),
        isNull(tasks.deletedAt),
      ),
    )
    .all();

  const allTasks = [...taskRows];
  const seenIds = new Set(taskRows.map((t: typeof tasks.$inferSelect) => t.id));

  for (const t of a2aTasks) {
    if (!seenIds.has(t.id)) {
      allTasks.push(t);
    }
  }

  return rpcResult(
    id,
    allTasks.map(taskToA2A),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function handleA2ARequest(
  db: AnyDb,
  workspaceId: string,
  request: A2AJsonRpcRequest,
): A2AJsonRpcResponse {
  const { id, method, params } = request;

  switch (method) {
    case "a2a.SendMessage":
      return handleSendMessage(
        db,
        workspaceId,
        id,
        (params ?? {}) as unknown as A2ASendMessageParams,
      );

    case "a2a.GetTask":
      return handleGetTask(
        db,
        workspaceId,
        id,
        (params ?? {}) as unknown as A2AGetTaskParams,
      );

    case "a2a.CancelTask":
      return handleCancelTask(
        db,
        workspaceId,
        id,
        (params ?? {}) as unknown as A2ACancelTaskParams,
      );

    case "a2a.ListTasks":
      return handleListTasks(
        db,
        workspaceId,
        id,
        (params ?? {}) as unknown as A2AListTasksParams,
      );

    default:
      return rpcError(id, A2A_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`);
  }
}
