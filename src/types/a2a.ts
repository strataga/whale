/**
 * A2A (Agent-to-Agent) v0.3 protocol type definitions.
 * Matches the Google/Linux Foundation A2A spec.
 */

// ── Agent Card ──

export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion: string;
  capabilities: A2ACapabilities;
  skills: A2AAgentSkill[];
  securitySchemes?: Record<string, A2ASecurityScheme>;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export interface A2ACapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface A2AAgentSkill {
  id: string;
  name: string;
  description: string;
  inputModes?: string[];
  outputModes?: string[];
  tags?: string[];
  examples?: string[];
  price?: A2ASkillPrice;
}

export interface A2ASkillPrice {
  amount: number;
  currency: string;
  model: "per_task" | "per_minute" | "free";
}

export interface A2ASecurityScheme {
  type: "bearer" | "apiKey" | "oauth2";
  in?: "header" | "query";
  name?: string;
  flows?: Record<string, unknown>;
}

// ── Task States ──

export type A2ATaskState =
  | "submitted"
  | "working"
  | "input_required"
  | "auth_required"
  | "completed"
  | "failed"
  | "canceled"
  | "rejected";

// ── Messages & Parts ──

export type A2APartType = "text" | "file" | "data";

export interface A2ATextPart {
  type: "text";
  text: string;
}

export interface A2AFilePart {
  type: "file";
  file: {
    name?: string;
    mimeType?: string;
    bytes?: string;
    uri?: string;
  };
}

export interface A2ADataPart {
  type: "data";
  data: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2AFilePart | A2ADataPart;

export interface A2AMessage {
  role: "user" | "agent";
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

// ── Task ──

export interface A2AArtifact {
  name?: string;
  description?: string;
  parts: A2APart[];
  index: number;
}

export interface A2ATask {
  id: string;
  sessionId: string;
  status: A2ATaskStatus;
  messages: A2AMessage[];
  artifacts?: A2AArtifact[];
  metadata?: Record<string, unknown>;
}

export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp?: string;
}

// ── JSON-RPC ──

export interface A2AJsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: A2AMethod;
  params?: Record<string, unknown>;
}

export type A2AMethod =
  | "a2a.SendMessage"
  | "a2a.GetTask"
  | "a2a.CancelTask"
  | "a2a.ListTasks"
  | "a2a.SendStreamingMessage";

export interface A2AJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: A2AJsonRpcError;
}

export interface A2AJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// Standard JSON-RPC error codes
export const A2A_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  AUTH_REQUIRED: -32001,
  PAYMENT_REQUIRED: -32002,
  TASK_NOT_FOUND: -32003,
  RATE_LIMITED: -32004,
} as const;

// ── Negotiation (gap fix) ──

export interface A2AQuote {
  priceCents: number;
  currency: string;
  estimatedDurationMs: number;
  slaTerms?: {
    maxResponseMs: number;
    guaranteedAvailability: number;
  };
  paymentInstructions?: {
    method: "x402" | "stripe" | "manual";
    details: Record<string, unknown>;
  };
  expiresAt: string;
}

// ── SendMessage params ──

export interface A2ASendMessageParams {
  message: A2AMessage;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  acceptQuote?: boolean;
}

export interface A2AGetTaskParams {
  taskId: string;
}

export interface A2ACancelTaskParams {
  taskId: string;
  reason?: string;
}

export interface A2AListTasksParams {
  sessionId: string;
}
