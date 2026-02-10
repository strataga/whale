/**
 * OpenAPI spec generator (#41).
 *
 * Scans src/app/api route files, extracts HTTP methods,
 * and outputs a minimal OpenAPI 3.1 spec to public/openapi.json.
 *
 * Usage: pnpm openapi
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const API_DIR = join(import.meta.dirname ?? __dirname, "..", "src", "app", "api");
const OUT_FILE = join(import.meta.dirname ?? __dirname, "..", "public", "openapi.json");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

interface RouteInfo {
  filePath: string;
  apiPath: string;
  methods: Lowercase<HttpMethod>[];
  tags: string[];
}

// ── Scan for route.ts files ──

function findRouteFiles(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findRouteFiles(full, results);
    } else if (entry === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

// ── Convert Next.js file path to OpenAPI path ──

function filePathToApiPath(filePath: string): string {
  const rel = relative(API_DIR, dirname(filePath));
  const segments = rel.split("/").filter(Boolean);
  const apiSegments = segments.map((seg) => {
    // [...nextauth] → catch-all, skip
    if (seg.startsWith("[...")) return null;
    // [id] → {id}
    if (seg.startsWith("[") && seg.endsWith("]")) {
      return `{${seg.slice(1, -1)}}`;
    }
    return seg;
  });

  // Skip catch-all routes (NextAuth)
  if (apiSegments.includes(null)) return "";

  return "/api/" + apiSegments.join("/");
}

// ── Extract exported HTTP methods from file content ──

function extractMethods(content: string): Lowercase<HttpMethod>[] {
  const methods: Lowercase<HttpMethod>[] = [];
  for (const method of HTTP_METHODS) {
    // Match: export async function GET  or  export function GET
    const pattern = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    if (pattern.test(content)) {
      methods.push(method.toLowerCase() as Lowercase<HttpMethod>);
    }
  }
  return methods;
}

// ── Derive tags from path ──

function deriveTags(apiPath: string): string[] {
  const parts = apiPath.replace("/api/", "").split("/");
  const first = parts[0];
  if (!first) return ["misc"];
  // Collapse sub-resources: /projects/{id}/tasks → "projects"
  return [first];
}

// ── Determine if route needs auth ──

function needsAuth(content: string): boolean {
  return (
    content.includes("getAuthContext") ||
    content.includes("requireAuthContext") ||
    content.includes("getBotAuthContext") ||
    content.includes("verifyApiToken")
  );
}

// ── Determine if route is bot-auth ──

function isBotAuth(content: string): boolean {
  return content.includes("getBotAuthContext");
}

// ── Determine if route is cron ──

function isCronRoute(apiPath: string): boolean {
  return apiPath.startsWith("/api/cron/");
}

// ── Build path parameters from {param} segments ──

function extractPathParams(apiPath: string): Array<{ name: string; in: "path"; required: true; schema: { type: string } }> {
  const matches = apiPath.match(/\{([^}]+)\}/g) ?? [];
  return matches.map((m) => ({
    name: m.slice(1, -1),
    in: "path" as const,
    required: true as const,
    schema: { type: "string" },
  }));
}

// ── Build description from method + path ──

function buildDescription(method: string, apiPath: string, content: string): string {
  // Check for rate limiting
  const rateLimit = content.includes("checkRateLimit") ? " (rate-limited)" : "";
  const auth = needsAuth(content)
    ? isBotAuth(content)
      ? " Requires bot authentication."
      : " Requires user authentication."
    : isCronRoute(apiPath)
      ? " Requires CRON_SECRET."
      : "";
  return `${method.toUpperCase()} ${apiPath}${rateLimit}.${auth}`;
}

// ── Main ──

function main() {
  const routeFiles = findRouteFiles(API_DIR);
  console.log(`Found ${routeFiles.length} route files`);

  const routes: RouteInfo[] = [];
  for (const file of routeFiles) {
    const apiPath = filePathToApiPath(file);
    if (!apiPath) continue; // skip catch-all

    const content = readFileSync(file, "utf-8");
    const methods = extractMethods(content);
    if (methods.length === 0) continue;

    routes.push({
      filePath: file,
      apiPath,
      methods,
      tags: deriveTags(apiPath),
    });
  }

  // Sort by path for stable output
  routes.sort((a, b) => a.apiPath.localeCompare(b.apiPath));

  // Collect all tags
  const allTags = [...new Set(routes.flatMap((r) => r.tags))].sort();

  // Build OpenAPI paths
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    if (!paths[route.apiPath]) paths[route.apiPath] = {};
    const content = readFileSync(route.filePath, "utf-8");
    const pathParams = extractPathParams(route.apiPath);

    for (const method of route.methods) {
      const operation: Record<string, unknown> = {
        tags: route.tags,
        summary: buildDescription(method, route.apiPath, content),
        operationId: `${method}_${route.apiPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
        responses: {
          "200": { description: "Success" },
          ...(needsAuth(content) ? { "401": { description: "Unauthorized" } } : {}),
          ...(content.includes("checkRole") ? { "403": { description: "Forbidden" } } : {}),
          ...(method === "post" || method === "put" || method === "patch"
            ? { "400": { description: "Validation error" } }
            : {}),
        },
      };

      if (pathParams.length > 0) {
        operation.parameters = pathParams;
      }

      if (method === "post" || method === "put" || method === "patch") {
        operation.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        };
      }

      // Auth
      if (needsAuth(content)) {
        operation.security = [{ bearerAuth: [] }];
      } else if (isCronRoute(route.apiPath)) {
        operation.security = [{ cronSecret: [] }];
      }

      paths[route.apiPath]![method] = operation;
    }
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Whale API",
      description:
        "AI-first project planner with bot orchestration. " +
        `Auto-generated from ${routes.length} route files.`,
      version: "0.3.0",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: allTags.map((t) => ({ name: t })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "NextAuth JWT session or API token",
        },
        cronSecret: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Bearer CRON_SECRET",
        },
      },
    },
  };

  // Ensure output directory exists
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(spec, null, 2));

  console.log(`Generated OpenAPI spec: ${OUT_FILE}`);
  console.log(`  Routes: ${routes.length}`);
  console.log(`  Paths: ${Object.keys(paths).length}`);
  console.log(`  Tags: ${allTags.join(", ")}`);

  // Summary of methods
  const methodCounts: Record<string, number> = {};
  for (const route of routes) {
    for (const m of route.methods) {
      methodCounts[m] = (methodCounts[m] ?? 0) + 1;
    }
  }
  console.log(`  Methods: ${Object.entries(methodCounts).map(([m, c]) => `${m.toUpperCase()}=${c}`).join(", ")}`);
}

main();
