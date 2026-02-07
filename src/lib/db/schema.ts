import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  aiProvider: text("aiProvider"),
  aiApiKey: text("aiApiKey"),
  ipAllowlist: text("ipAllowlist"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name"),
  role: text("role").notNull().default("member"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const milestones = sqliteTable("milestones", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  dueDate: integer("dueDate"),
  position: integer("position").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id),
  milestoneId: text("milestoneId").references(() => milestones.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: text("assigneeId").references(() => users.id),
  dueDate: integer("dueDate"),
  tags: text("tags").notNull().default("[]"),
  position: integer("position").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const bots = sqliteTable("bots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  host: text("host").notNull(),
  deviceId: text("deviceId"),
  status: text("status").notNull().default("offline"),
  statusReason: text("statusReason"),
  statusChangedAt: integer("statusChangedAt"),
  capabilities: text("capabilities").notNull().default("[]"),
  lastSeenAt: integer("lastSeenAt"),
  tokenPrefix: text("tokenPrefix").notNull(),
  tokenHash: text("tokenHash").notNull(),
  currentBotTaskId: text("currentBotTaskId"),
  onboardedAt: integer("onboardedAt"),
  version: text("version"),
  autoUpdate: integer("autoUpdate").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const botTasks = sqliteTable("botTasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id),
  status: text("status").notNull().default("pending"),
  outputSummary: text("outputSummary").default(""),
  artifactLinks: text("artifactLinks").notNull().default("[]"),
  startedAt: integer("startedAt"),
  completedAt: integer("completedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const pairingTokens = sqliteTable("pairingTokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  tokenHash: text("tokenHash").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  consumedAt: integer("consumedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const auditLogs = sqliteTable("auditLogs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  userId: text("userId").references(() => users.id),
  action: text("action").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const botLogs = sqliteTable("botLogs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  botTaskId: text("botTaskId").references(() => botTasks.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const botGuidelines = sqliteTable("botGuidelines", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const botReleaseNotes = sqliteTable("botReleaseNotes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  version: text("version").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  releaseUrl: text("releaseUrl"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  projects: many(projects),
  bots: many(bots),
  pairingTokens: many(pairingTokens),
  auditLogs: many(auditLogs),
  botGuidelines: many(botGuidelines),
  botReleaseNotes: many(botReleaseNotes),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.workspaceId],
    references: [workspaces.id],
  }),
  assignedTasks: many(tasks),
  auditLogs: many(auditLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  milestones: many(milestones),
  tasks: many(tasks),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  milestone: one(milestones, {
    fields: [tasks.milestoneId],
    references: [milestones.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  botTasks: many(botTasks),
}));

export const botsRelations = relations(bots, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [bots.workspaceId],
    references: [workspaces.id],
  }),
  botTasks: many(botTasks),
  botLogs: many(botLogs),
}));

export const botTasksRelations = relations(botTasks, ({ one }) => ({
  bot: one(bots, {
    fields: [botTasks.botId],
    references: [bots.id],
  }),
  task: one(tasks, {
    fields: [botTasks.taskId],
    references: [tasks.id],
  }),
}));

export const pairingTokensRelations = relations(pairingTokens, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [pairingTokens.workspaceId],
    references: [workspaces.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const botLogsRelations = relations(botLogs, ({ one }) => ({
  bot: one(bots, {
    fields: [botLogs.botId],
    references: [bots.id],
  }),
  workspace: one(workspaces, {
    fields: [botLogs.workspaceId],
    references: [workspaces.id],
  }),
  botTask: one(botTasks, {
    fields: [botLogs.botTaskId],
    references: [botTasks.id],
  }),
}));

export const botGuidelinesRelations = relations(botGuidelines, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [botGuidelines.workspaceId],
    references: [workspaces.id],
  }),
}));

export const botReleaseNotesRelations = relations(botReleaseNotes, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [botReleaseNotes.workspaceId],
    references: [workspaces.id],
  }),
}));
