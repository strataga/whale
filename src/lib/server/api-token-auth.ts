import { eq } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { apiTokens, users } from "@/lib/db/schema";
import type { AuthContext } from "@/lib/server/auth-context";

/**
 * Scope taxonomy for API tokens.
 */
export const SCOPE_TAXONOMY = {
  "bots:read": "Read bot information",
  "bots:write": "Create, update, delete bots",
  "tasks:read": "Read tasks and project data",
  "tasks:write": "Create, update, delete tasks",
  "tasks:create": "Submit tasks via public API",
  "admin:*": "Full admin access",
  "webhooks:read": "Read webhook configurations",
  "webhooks:write": "Manage webhooks",
  "webhooks:manage": "Subscribe to webhook events via public API",
  "reports:read": "View reports and analytics",
  "directory:read": "List and search agents in the public directory",
  "directory:write": "Register and update agent profiles",
} as const;

export type ApiScope = keyof typeof SCOPE_TAXONOMY;

/**
 * Authenticate a request using an API token (Bearer token).
 * Returns an AuthContext-compatible object if valid, null otherwise.
 */
export async function getApiTokenAuthContext(
  req: Request,
): Promise<(AuthContext & { scopes: string[] }) | null> {
  // Support both "Authorization: Bearer whl_..." and "X-Api-Key: whl_..." headers
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");

  let token: string;
  if (header?.startsWith("Bearer whl_")) {
    token = header.slice("Bearer ".length).trim();
  } else if (apiKeyHeader?.startsWith("whl_")) {
    token = apiKeyHeader.trim();
  } else {
    return null;
  }
  const prefix = token.slice(0, 12);
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const apiToken = db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenPrefix, prefix))
    .get();

  if (!apiToken) return null;

  // Timing-safe comparison of hashes
  const expected = Buffer.from(apiToken.tokenHash);
  const actual = Buffer.from(tokenHash);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  // Check expiry
  if (apiToken.expiresAt && apiToken.expiresAt < Date.now()) {
    return null;
  }

  // Update last used
  db.update(apiTokens)
    .set({ lastUsedAt: Date.now() })
    .where(eq(apiTokens.id, apiToken.id))
    .run();

  // Fetch user info
  const user = db
    .select({
      workspaceId: users.workspaceId,
      role: users.role,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, apiToken.userId))
    .get();

  if (!user) return null;

  const scopes: string[] = JSON.parse(apiToken.scopes);

  return {
    userId: apiToken.userId,
    workspaceId: user.workspaceId,
    role: (user.role as "admin" | "member" | "viewer") ?? "member",
    name: user.name,
    email: user.email,
    scopes,
  };
}

/**
 * Check if the given scopes include the required scope.
 * "admin:*" grants access to everything.
 */
export function hasScope(scopes: string[], required: ApiScope): boolean {
  if (scopes.includes("admin:*")) return true;
  if (scopes.includes(required)) return true;

  // Check wildcard: "bots:*" matches "bots:read" and "bots:write"
  const [category] = required.split(":");
  if (scopes.includes(`${category}:*`)) return true;

  return false;
}

/**
 * Middleware helper: check scope and return error response if denied.
 */
export function checkScope(
  scopes: string[],
  required: ApiScope,
): { error: string; status: number } | null {
  if (!hasScope(scopes, required)) {
    return {
      error: `Forbidden: missing scope '${required}'`,
      status: 403,
    };
  }
  return null;
}
