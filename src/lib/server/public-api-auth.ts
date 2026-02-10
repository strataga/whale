/**
 * M5: Public API authentication and rate limiting wrapper.
 *
 * Combines API token auth (X-Api-Key / Bearer) with IP-based rate limiting
 * for unauthenticated requests. Used by all /api/public/* routes.
 */
import { getApiTokenAuthContext, checkScope, type ApiScope } from "@/lib/server/api-token-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export interface PublicApiContext {
  authenticated: boolean;
  workspaceId?: string;
  userId?: string;
  scopes?: string[];
  ip: string;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

/**
 * Authenticate and rate-limit a public API request.
 * Returns context or a JSON error response.
 */
export async function getPublicApiContext(
  req: Request,
): Promise<PublicApiContext | Response> {
  const ip = getClientIp(req);

  // Try token auth first
  const tokenCtx = await getApiTokenAuthContext(req);

  if (tokenCtx) {
    // Authenticated: 600 req/min per token
    const rl = checkRateLimit(`token:${tokenCtx.userId}`, {
      limit: 600,
      windowMs: 60_000,
    });
    if (rl) {
      return Response.json(
        { error: rl.error },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        },
      );
    }
    return {
      authenticated: true,
      workspaceId: tokenCtx.workspaceId,
      userId: tokenCtx.userId,
      scopes: tokenCtx.scopes,
      ip,
    };
  }

  // Unauthenticated: 60 req/min per IP
  const rl = checkRateLimit(`ip:${ip}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (rl) {
    return Response.json(
      { error: rl.error },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      },
    );
  }

  return { authenticated: false, ip };
}

/**
 * Require authentication on a public API request.
 * Returns context or a 401/403/429 response.
 */
export async function requirePublicApiAuth(
  req: Request,
  requiredScope?: ApiScope,
): Promise<(PublicApiContext & { authenticated: true; workspaceId: string; userId: string; scopes: string[] }) | Response> {
  const ctx = await getPublicApiContext(req);
  if (ctx instanceof Response) return ctx;

  if (!ctx.authenticated) {
    return Response.json(
      { error: "Authentication required. Provide X-Api-Key or Authorization header." },
      { status: 401 },
    );
  }

  if (requiredScope) {
    const denied = checkScope(ctx.scopes!, requiredScope);
    if (denied) {
      return Response.json({ error: denied.error }, { status: denied.status });
    }
  }

  return ctx as PublicApiContext & { authenticated: true; workspaceId: string; userId: string; scopes: string[] };
}
