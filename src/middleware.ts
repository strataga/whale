/**
 * #16 CSP and security headers.
 * #24 Request tracing with correlation IDs.
 * M5: CORS for public API routes.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
  "Access-Control-Max-Age": "86400",
  "X-API-Version": "2026-02-08",
};

function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith("/api/public/") || pathname.startsWith("/.well-known/");
}

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  // M5: Handle OPTIONS preflight for public routes
  if (isPublicRoute(pathname) && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        "X-Request-Id": requestId,
      },
    });
  }

  const response = NextResponse.next();

  // Correlation ID for request tracing
  response.headers.set("X-Request-Id", requestId);

  // M5: CORS headers for public routes
  if (isPublicRoute(pathname)) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' wss://*.convex.cloud https://*.convex.cloud",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Pass request ID via header for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-Request-Id", requestId);

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
