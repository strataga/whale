/**
 * Convex test setup helpers.
 * Provides convex-test based utilities for testing Convex functions.
 *
 * Usage:
 *   import { setupConvexTest, seedUser, seedProject, seedTask } from "../helpers/convex-setup";
 *   const { t, api } = setupConvexTest();
 *   const user = await seedUser(t);
 *   const project = await seedProject(t, user.workspaceId);
 */
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";

// Glob import of all Convex function modules
const modules = import.meta.glob("../../../convex/**/*.ts");

// Re-export api for tests
export { api, internal };

/**
 * Create a new convex-test instance with schema and all function modules loaded.
 */
export function setupConvexTest() {
  const t = convexTest(schema, modules);
  return { t, api, internal };
}

/**
 * Create an authenticated test context.
 * Sets up user identity so auth middleware passes.
 */
export function asUser(
  t: ReturnType<typeof convexTest>,
  opts: { email: string; name?: string },
) {
  return t.withIdentity({
    name: opts.name ?? "Test User",
    email: opts.email,
    subject: opts.email,
    tokenIdentifier: `test|${opts.email}`,
  });
}

// ── Seed Helpers ──
// These insert data directly into the test DB, bypassing auth middleware.

export async function seedWorkspace(
  t: ReturnType<typeof convexTest>,
  overrides: { name?: string } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("workspaces", {
      name: overrides.name ?? "Test Workspace",
      updatedAt: Date.now(),
    });
  });
  return { _id: id, name: overrides.name ?? "Test Workspace" };
}

export async function seedUser(
  t: ReturnType<typeof convexTest>,
  overrides: {
    email?: string;
    name?: string;
    role?: string;
    workspaceId?: string;
  } = {},
) {
  let workspaceId = overrides.workspaceId;
  if (!workspaceId) {
    const ws = await seedWorkspace(t);
    workspaceId = ws._id;
  }

  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2, 10)}@test.com`;
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      workspaceId: workspaceId!,
      email,
      passwordHash: "$2a$04$test-hash",
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "member",
      themePreference: "dark",
      totpEnabled: false,
      updatedAt: Date.now(),
    });
  });

  return { _id: id, workspaceId, email, name: overrides.name ?? "Test User", role: overrides.role ?? "member" };
}

export async function seedProject(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: { name?: string; description?: string; status?: string } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("projects", {
      workspaceId,
      name: overrides.name ?? "Test Project",
      description: overrides.description ?? "A test project",
      status: overrides.status ?? "active",
      visibility: "workspace",
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, name: overrides.name ?? "Test Project" };
}

export async function seedMilestone(
  t: ReturnType<typeof convexTest>,
  projectId: string,
  overrides: { name?: string; dueDate?: number | null; position?: number } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("milestones", {
      projectId,
      name: overrides.name ?? "Test Milestone",
      dueDate: overrides.dueDate ?? undefined,
      position: overrides.position ?? 0,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, projectId, name: overrides.name ?? "Test Milestone" };
}

export async function seedTask(
  t: ReturnType<typeof convexTest>,
  projectId: string,
  overrides: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    milestoneId?: string;
    assigneeId?: string;
    position?: number;
    dueDate?: number;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("tasks", {
      projectId,
      title: overrides.title ?? "Test Task",
      description: overrides.description ?? "",
      status: overrides.status ?? "todo",
      priority: overrides.priority ?? "medium",
      milestoneId: overrides.milestoneId ?? undefined,
      assigneeId: overrides.assigneeId ?? undefined,
      dueDate: overrides.dueDate ?? undefined,
      tags: [],
      position: overrides.position ?? 0,
      requiresApproval: false,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, projectId, title: overrides.title ?? "Test Task", status: overrides.status ?? "todo" };
}

export async function seedBot(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    name?: string;
    host?: string;
    status?: string;
    tokenPrefix?: string;
    tokenHash?: string;
    capabilities?: string[];
    maxConcurrentTasks?: number;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("bots", {
      workspaceId,
      name: overrides.name ?? "Test Bot",
      host: overrides.host ?? "localhost",
      status: overrides.status ?? "idle",
      tokenPrefix: overrides.tokenPrefix ?? "testpfx1",
      tokenHash: overrides.tokenHash ?? "testhash",
      capabilities: overrides.capabilities ?? [],
      maxConcurrentTasks: overrides.maxConcurrentTasks ?? 1,
      autoUpdate: false,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, name: overrides.name ?? "Test Bot" };
}

export async function seedBotTask(
  t: ReturnType<typeof convexTest>,
  botId: string,
  taskId: string,
  overrides: {
    status?: string;
    maxRetries?: number;
    retryCount?: number;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("botTasks", {
      botId,
      taskId,
      status: overrides.status ?? "pending",
      outputSummary: "",
      artifactLinks: [],
      retryCount: overrides.retryCount ?? 0,
      maxRetries: overrides.maxRetries ?? 0,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, botId, taskId, status: overrides.status ?? "pending" };
}

export async function seedAgent(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    name?: string;
    type?: string;
    status?: string;
    slug?: string;
    visibility?: string;
    reputation?: number;
    tags?: string[];
  } = {},
) {
  const slug = overrides.slug ?? `agent-${Math.random().toString(36).slice(2, 10)}`;
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("agents", {
      workspaceId,
      type: overrides.type ?? "local",
      name: overrides.name ?? "Test Agent",
      description: "",
      status: overrides.status ?? "idle",
      protocolVersion: "0.3",
      capabilities: {},
      securitySchemes: {},
      reputation: overrides.reputation ?? 50,
      verified: false,
      slug,
      tagline: "",
      bio: "",
      agentRole: "agent",
      visibility: overrides.visibility ?? "private",
      tags: overrides.tags ?? [],
      currency: "USD",
      links: {},
      featured: false,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, name: overrides.name ?? "Test Agent", slug };
}

export async function seedAutomationRule(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    name?: string;
    trigger?: string;
    conditions?: string;
    actions?: string;
    active?: boolean;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("automationRules", {
      workspaceId,
      name: overrides.name ?? "Test Rule",
      trigger: overrides.trigger ?? "task.created",
      conditions: overrides.conditions ?? "[]",
      actions: overrides.actions ?? "[]",
      active: overrides.active ?? true,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, name: overrides.name ?? "Test Rule" };
}

export async function seedNotification(
  t: ReturnType<typeof convexTest>,
  userId: string,
  overrides: {
    type?: string;
    title?: string;
    body?: string;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("notifications", {
      userId,
      type: overrides.type ?? "info",
      title: overrides.title ?? "Test Notification",
      body: overrides.body ?? "",
    });
  });
  return { _id: id, userId, title: overrides.title ?? "Test Notification" };
}

export async function seedWebhook(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    url?: string;
    secret?: string;
    events?: string[];
    active?: boolean;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("webhooks", {
      workspaceId,
      url: overrides.url ?? "https://example.com/webhook",
      secret: overrides.secret ?? "test-secret",
      events: overrides.events ?? ["*"],
      active: overrides.active ?? true,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, url: overrides.url ?? "https://example.com/webhook" };
}

export async function seedSprint(
  t: ReturnType<typeof convexTest>,
  projectId: string,
  overrides: {
    name?: string;
    startDate?: number;
    endDate?: number;
    status?: string;
  } = {},
) {
  const now = Date.now();
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("sprints", {
      projectId,
      name: overrides.name ?? "Sprint 1",
      startDate: overrides.startDate ?? now,
      endDate: overrides.endDate ?? now + 14 * 24 * 60 * 60 * 1000,
      status: overrides.status ?? "planning",
      updatedAt: now,
    });
  });
  return { _id: id, projectId, name: overrides.name ?? "Sprint 1", status: overrides.status ?? "planning" };
}

export async function seedTeam(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    name?: string;
    slug?: string;
    visibility?: string;
  } = {},
) {
  const slug = overrides.slug ?? `team-${Math.random().toString(36).slice(2, 10)}`;
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("teams", {
      workspaceId,
      name: overrides.name ?? "Test Team",
      slug,
      description: "",
      isDefault: false,
      visibility: overrides.visibility ?? "private",
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, name: overrides.name ?? "Test Team", slug };
}

export async function seedChannel(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    type?: string;
    name?: string;
    config?: Record<string, unknown>;
    events?: string[];
    active?: boolean;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("channels", {
      workspaceId,
      type: overrides.type ?? "webhook",
      name: overrides.name ?? "Test Channel",
      config: JSON.stringify(overrides.config ?? { url: "https://example.com/hook" }),
      events: overrides.events ?? ["*"],
      minSeverity: "info",
      active: overrides.active ?? true,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, type: overrides.type ?? "webhook", name: overrides.name ?? "Test Channel" };
}

export async function seedCheckoutSession(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    status?: string;
    totalCents?: number;
    lineItems?: string;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("checkoutSessions", {
      workspaceId,
      status: overrides.status ?? "open",
      lineItems: overrides.lineItems ?? "[]",
      totalCents: overrides.totalCents ?? 1000,
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, status: overrides.status ?? "open" };
}

export async function seedPaymentProvider(
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  overrides: {
    type?: string;
    name?: string;
    isDefault?: boolean;
  } = {},
) {
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("paymentProviders", {
      workspaceId,
      type: overrides.type ?? "stripe",
      name: overrides.name ?? "Test Provider",
      configEncrypted: "encrypted-config",
      isDefault: overrides.isDefault ?? true,
      status: "active",
      updatedAt: Date.now(),
    });
  });
  return { _id: id, workspaceId, type: overrides.type ?? "stripe" };
}
