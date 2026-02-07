import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { hash } from "bcryptjs";
import * as schema from "@/lib/db/schema";

const CREATE_TABLES_SQL = `
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    aiProvider TEXT,
    aiApiKey TEXT,
    ipAllowlist TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE milestones (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    dueDate INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id),
    milestoneId TEXT REFERENCES milestones(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigneeId TEXT REFERENCES users(id),
    dueDate INTEGER,
    tags TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE bots (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    deviceId TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    statusReason TEXT,
    statusChangedAt INTEGER,
    capabilities TEXT NOT NULL DEFAULT '[]',
    lastSeenAt INTEGER,
    tokenPrefix TEXT NOT NULL,
    tokenHash TEXT NOT NULL,
    currentBotTaskId TEXT,
    onboardedAt INTEGER,
    version TEXT,
    autoUpdate INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botTasks (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id),
    taskId TEXT NOT NULL REFERENCES tasks(id),
    status TEXT NOT NULL DEFAULT 'pending',
    outputSummary TEXT DEFAULT '',
    artifactLinks TEXT NOT NULL DEFAULT '[]',
    startedAt INTEGER,
    completedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE pairingTokens (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    tokenHash TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    consumedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE auditLogs (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    userId TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botLogs (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id),
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    botTaskId TEXT REFERENCES botTasks(id),
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botGuidelines (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botReleaseNotes (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    releaseUrl TEXT,
    createdAt INTEGER NOT NULL
  );
`;

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(CREATE_TABLES_SQL);
  return drizzle(sqlite, { schema });
}

export async function createTestUser(
  db: TestDb,
  overrides: {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    workspaceId?: string;
  } = {},
): Promise<{
  userId: string;
  workspaceId: string;
  email: string;
  password: string;
}> {
  const workspaceId = overrides.workspaceId ?? crypto.randomUUID();
  const email = overrides.email ?? `user-${crypto.randomUUID().slice(0, 8)}@test.com`;
  const password = overrides.password ?? "TestPass123!";
  const name = overrides.name ?? "Test User";
  const role = overrides.role ?? "member";

  // Create workspace if needed (only if we generated a new one)
  if (!overrides.workspaceId) {
    const now = Date.now();
    db.insert(schema.workspaces)
      .values({
        id: workspaceId,
        name: "Test Workspace",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hash(password, 4); // Lower rounds for faster tests
  const now = Date.now();

  db.insert(schema.users)
    .values({
      id: userId,
      workspaceId,
      email,
      passwordHash,
      name,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { userId, workspaceId, email, password };
}

export function createTestProject(
  db: TestDb,
  workspaceId: string,
  overrides: {
    name?: string;
    description?: string;
    status?: string;
  } = {},
): {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: string;
} {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Project";
  const description = overrides.description ?? "A test project";
  const status = overrides.status ?? "active";
  const now = Date.now();

  db.insert(schema.projects)
    .values({
      id,
      workspaceId,
      name,
      description,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, name, description, status };
}

export function createTestMilestone(
  db: TestDb,
  projectId: string,
  overrides: {
    name?: string;
    dueDate?: number | null;
    position?: number;
  } = {},
): {
  id: string;
  projectId: string;
  name: string;
} {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Milestone";
  const now = Date.now();

  db.insert(schema.milestones)
    .values({
      id,
      projectId,
      name,
      dueDate: overrides.dueDate ?? null,
      position: overrides.position ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, projectId, name };
}

export function createTestTask(
  db: TestDb,
  projectId: string,
  overrides: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    milestoneId?: string | null;
    assigneeId?: string | null;
    position?: number;
  } = {},
): {
  id: string;
  projectId: string;
  title: string;
  status: string;
} {
  const id = crypto.randomUUID();
  const title = overrides.title ?? "Test Task";
  const status = overrides.status ?? "todo";
  const now = Date.now();

  db.insert(schema.tasks)
    .values({
      id,
      projectId,
      milestoneId: overrides.milestoneId ?? null,
      title,
      description: overrides.description ?? "",
      status,
      priority: overrides.priority ?? "medium",
      assigneeId: overrides.assigneeId ?? null,
      dueDate: null,
      tags: "[]",
      position: overrides.position ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, projectId, title, status };
}
