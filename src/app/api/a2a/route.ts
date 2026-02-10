import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { handleA2ARequest } from "@/lib/server/a2a-gateway";
import { validateA2AAuth } from "@/lib/server/a2a-auth";
import { A2A_ERROR_CODES } from "@/types/a2a";
import type { A2AJsonRpcRequest, A2AJsonRpcResponse } from "@/types/a2a";

export const runtime = "nodejs";

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
): A2AJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? 0,
    error: { code, message },
  };
}

/**
 * POST /api/a2a
 *
 * Core A2A JSON-RPC endpoint. Accepts JSON-RPC 2.0 requests,
 * authenticates the caller, and dispatches to the A2A gateway.
 */
export async function POST(req: Request) {
  // Parse JSON-RPC request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      rpcError(null, A2A_ERROR_CODES.PARSE_ERROR, "Invalid JSON"),
    );
  }

  // Validate JSON-RPC structure
  const rpcReq = body as Record<string, unknown>;

  if (
    !rpcReq ||
    typeof rpcReq !== "object" ||
    rpcReq.jsonrpc !== "2.0" ||
    !rpcReq.method ||
    typeof rpcReq.method !== "string"
  ) {
    return NextResponse.json(
      rpcError(
        (rpcReq?.id as string | number) ?? null,
        A2A_ERROR_CODES.INVALID_REQUEST,
        "Invalid JSON-RPC 2.0 request",
      ),
    );
  }

  const request: A2AJsonRpcRequest = {
    jsonrpc: "2.0",
    id: (rpcReq.id as string | number) ?? 0,
    method: rpcReq.method as A2AJsonRpcRequest["method"],
    params: (rpcReq.params as Record<string, unknown>) ?? undefined,
  };

  // Determine workspace — use the first workspace (single-tenant default)
  // or from x-workspace-id header
  const workspaceIdHeader = req.headers.get("x-workspace-id");
  let workspaceId: string | undefined;

  if (workspaceIdHeader) {
    const ws = db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceIdHeader))
      .get();
    workspaceId = ws?.id;
  } else {
    const ws = db
      .select({ id: workspaces.id })
      .from(workspaces)
      .limit(1)
      .get();
    workspaceId = ws?.id;
  }

  if (!workspaceId) {
    return NextResponse.json(
      rpcError(
        request.id,
        A2A_ERROR_CODES.INTERNAL_ERROR,
        "No workspace configured",
      ),
    );
  }

  // Authenticate
  // For the hub endpoint, we use the workspace-level security schemes
  // (empty = open access for now; can be configured per-workspace)
  const authResult = validateA2AAuth(req, "{}");
  if (!authResult.valid) {
    return NextResponse.json(
      rpcError(
        request.id,
        A2A_ERROR_CODES.AUTH_REQUIRED,
        authResult.error ?? "Authentication failed",
      ),
    );
  }

  // Dispatch to gateway
  const response = handleA2ARequest(db, workspaceId, request);

  return NextResponse.json(response);
}
