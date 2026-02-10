import { eq, and, isNull } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { agents, apiTokens } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface A2AAuthResult {
  valid: boolean;
  agentId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an inbound A2A request against supported authentication schemes.
 *
 * Checks, in order:
 * 1. Bearer token — matches against agents table tokenHash or API tokens
 * 2. API key in custom header (x-agent-key)
 *
 * The `agentSecuritySchemes` parameter is a JSON string describing the
 * security schemes configured for the target agent (from agents.securitySchemes).
 * When empty or "{}",  authentication is optional (open access).
 */
export function validateA2AAuth(
  request: Request,
  agentSecuritySchemes: string,
): A2AAuthResult {
  // Parse schemes
  let schemes: Record<string, { type: string; in?: string; name?: string }> = {};
  try {
    schemes = JSON.parse(agentSecuritySchemes || "{}");
  } catch {
    schemes = {};
  }

  // If no security schemes are defined, allow open access
  if (Object.keys(schemes).length === 0) {
    return { valid: true };
  }

  // 1. Check Bearer token
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return { valid: false, error: "Empty bearer token" };
    }

    // Try to match against an agent by checking agents that have a non-empty
    // securitySchemes containing a bearer scheme. We hash the token and compare.
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Check if this token matches an API token (for workspace-level auth)
    const prefix = token.slice(0, 12);
    const apiToken = db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenPrefix, prefix))
      .get();

    if (apiToken) {
      const expected = Buffer.from(apiToken.tokenHash);
      const actual = Buffer.from(tokenHash);
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        // Valid API token; find any agent in the same workspace
        const agentRow = db
          .select({ id: agents.id })
          .from(agents)
          .where(
            and(
              eq(agents.workspaceId, apiToken.workspaceId),
              isNull(agents.deletedAt),
            ),
          )
          .get();

        return {
          valid: true,
          agentId: agentRow?.id,
        };
      }
    }

    // Check against agents that store a tokenHash in securitySchemes metadata
    // (agents may store a hash of their bearer token for inbound auth)
    const allAgents = db
      .select()
      .from(agents)
      .where(isNull(agents.deletedAt))
      .all();

    for (const agent of allAgents) {
      try {
        const agentSchemes = JSON.parse(agent.securitySchemes || "{}");
        const bearerScheme = agentSchemes.bearer ?? agentSchemes.Bearer;

        if (bearerScheme?.tokenHash) {
          if (safeEqual(bearerScheme.tokenHash, tokenHash)) {
            return { valid: true, agentId: agent.id };
          }
        }
      } catch {
        // Skip agents with malformed security schemes
      }
    }

    return { valid: false, error: "Invalid bearer token" };
  }

  // 2. Check API key in header
  for (const [, scheme] of Object.entries(schemes)) {
    if (scheme.type === "apiKey" && scheme.in === "header" && scheme.name) {
      const apiKeyValue = request.headers.get(scheme.name);
      if (apiKeyValue) {
        // Validate the API key against stored agents
        const keyHash = createHash("sha256").update(apiKeyValue).digest("hex");

        const allAgents = db
          .select()
          .from(agents)
          .where(isNull(agents.deletedAt))
          .all();

        for (const agent of allAgents) {
          try {
            const agentSchemes = JSON.parse(agent.securitySchemes || "{}");
            for (const [, s] of Object.entries(agentSchemes) as Array<[string, { type: string; keyHash?: string }]>) {
              if (s.type === "apiKey" && s.keyHash) {
                if (safeEqual(s.keyHash, keyHash)) {
                  return { valid: true, agentId: agent.id };
                }
              }
            }
          } catch {
            // Skip
          }
        }

        return { valid: false, error: "Invalid API key" };
      }
    }
  }

  // 3. Fallback: check x-agent-key header
  const agentKey = request.headers.get("x-agent-key");
  if (agentKey) {
    const keyHash = createHash("sha256").update(agentKey).digest("hex");

    const allAgents = db
      .select()
      .from(agents)
      .where(isNull(agents.deletedAt))
      .all();

    for (const agent of allAgents) {
      try {
        const agentSchemes = JSON.parse(agent.securitySchemes || "{}");
        for (const [, s] of Object.entries(agentSchemes) as Array<[string, { type: string; keyHash?: string }]>) {
          if (s.keyHash && safeEqual(s.keyHash, keyHash)) {
            return { valid: true, agentId: agent.id };
          }
        }
      } catch {
        // Skip
      }
    }

    return { valid: false, error: "Invalid agent key" };
  }

  return { valid: false, error: "No authentication credentials provided" };
}
