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
  // #20 Slack/Discord notification channels (encrypted)
  slackWebhookUrl: text("slackWebhookUrl"),
  discordWebhookUrl: text("discordWebhookUrl"),
  // #45 Security policies JSON
  securityPolicy: text("securityPolicy"),
  // #47 Data retention
  retentionDays: integer("retentionDays"),
  // R2 #47 Onboarding wizard
  onboardingCompletedAt: integer("onboardingCompletedAt"),
  // R2 #42 Slack App
  slackTeamId: text("slackTeamId"),
  slackBotToken: text("slackBotToken"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  // M5 whale.md support
  whaleMdContent: text("whaleMdContent"),
  whaleMdUpdatedAt: integer("whaleMdUpdatedAt"),
  // #18 Soft delete
  deletedAt: integer("deletedAt"),
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
  themePreference: text("themePreference").notNull().default("dark"),
  // #21 Email digest
  emailDigestFrequency: text("emailDigestFrequency"),
  // #33 User presence
  lastActiveAt: integer("lastActiveAt"),
  // R2 #35 Two-Factor Authentication
  totpSecret: text("totpSecret"),
  totpEnabled: integer("totpEnabled").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  // #18 Soft delete
  deletedAt: integer("deletedAt"),
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
  // #32 Project-level access control
  visibility: text("visibility").notNull().default("workspace"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  // #18 Soft delete
  deletedAt: integer("deletedAt"),
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
  // #17 Approval workflow link
  approvalWorkflowId: text("approvalWorkflowId"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  // #18 Soft delete
  deletedAt: integer("deletedAt"),
});

export const tasks = sqliteTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId").references(() => projects.id),
  milestoneId: text("milestoneId").references(() => milestones.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: text("assigneeId").references(() => users.id),
  dueDate: integer("dueDate"),
  tags: text("tags").notNull().default("[]"),
  position: integer("position").notNull().default(0),
  sortOrder: integer("sortOrder").notNull().default(0),
  estimatedMinutes: integer("estimatedMinutes"),
  recurrence: text("recurrence"),
  // #13 Approval gates
  requiresApproval: integer("requiresApproval").notNull().default(0),
  // R4: A2A/ACP inbound task provenance
  sourceAgentId: text("sourceAgentId"),
  sourceProtocol: text("sourceProtocol"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  // #18 Soft delete
  deletedAt: integer("deletedAt"),
});

export const taskDependencies = sqliteTable("taskDependencies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: text("dependsOnTaskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const taskAttachments = sqliteTable("task_attachments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id),
  filename: text("filename").notNull(),
  originalName: text("originalName").notNull(),
  mimeType: text("mimeType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  uploadedBy: text("uploadedBy")
    .notNull()
    .references(() => users.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const subtasks = sqliteTable("subtasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: integer("done").notNull().default(0),
  position: integer("position").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const taskComments = sqliteTable("taskComments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: text("authorId"),
  authorType: text("authorType").notNull().default("user"),
  body: text("body").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const taskTemplates = sqliteTable("taskTemplates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  titlePattern: text("titlePattern").notNull().default(""),
  description: text("description").notNull().default(""),
  priority: text("priority").notNull().default("medium"),
  tags: text("tags").notNull().default("[]"),
  subtaskTitles: text("subtaskTitles").notNull().default("[]"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const timeEntries = sqliteTable("timeEntries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("userId").references(() => users.id),
  botId: text("botId").references(() => bots.id),
  minutes: integer("minutes").notNull(),
  note: text("note").notNull().default(""),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const taskHandoffs = sqliteTable("taskHandoffs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fromBotTaskId: text("fromBotTaskId")
    .notNull()
    .references(() => botTasks.id),
  toBotTaskId: text("toBotTaskId")
    .notNull()
    .references(() => botTasks.id),
  contextPayload: text("contextPayload").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const taskMentions = sqliteTable("taskMentions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  createdAt: integer("createdAt")
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
  // #4 Bot permission scopes
  allowedProjects: text("allowedProjects"),
  allowedTags: text("allowedTags"),
  // #8 Environment labels
  environment: text("environment"),
  labels: text("labels"),
  // #9 Concurrent task limit
  maxConcurrentTasks: integer("maxConcurrentTasks").notNull().default(1),
  // R2 #10 Agent sandboxing
  sandboxPolicy: text("sandboxPolicy"),
  // #44 Token rotation
  previousTokenHash: text("previousTokenHash"),
  tokenRotatedAt: integer("tokenRotatedAt"),
  tokenGracePeriodMs: integer("tokenGracePeriodMs"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  // #18 Soft delete
  deletedAt: integer("deletedAt"),
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
  queuePosition: integer("queuePosition"),
  outputSummary: text("outputSummary").default(""),
  outputSchema: text("outputSchema"),
  outputData: text("outputData"),
  artifactLinks: text("artifactLinks").notNull().default("[]"),
  // #1 Cancellation
  cancelledAt: integer("cancelledAt"),
  cancelledBy: text("cancelledBy"),
  // #2 Retry logic
  retryCount: integer("retryCount").notNull().default(0),
  maxRetries: integer("maxRetries").notNull().default(0),
  retryAfter: integer("retryAfter"),
  // #3 Bot group targeting
  botGroupId: text("botGroupId"),
  // #10 Timeout
  timeoutMinutes: integer("timeoutMinutes"),
  // R2 #3 Agent confidence scoring
  confidenceScore: integer("confidenceScore"),
  confidenceReason: text("confidenceReason"),
  // R2 #15 Fan-out group
  fanOutGroupId: text("fanOutGroupId"),
  // R2 #17 Preemption
  preemptedBy: text("preemptedBy"),
  preemptedAt: integer("preemptedAt"),
  // #14 Review queue
  reviewStatus: text("reviewStatus"),
  reviewedBy: text("reviewedBy"),
  reviewedAt: integer("reviewedAt"),
  // #27 Structured spec
  structuredSpec: text("structuredSpec"),
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
  // #43 Before/after diffs
  before: text("before"),
  after: text("after"),
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

// #3 Bot Groups and Resource Pools
export const botGroups = sqliteTable("botGroups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // R2 #16 Circuit breaker
  circuitState: text("circuitState").notNull().default("closed"),
  lastTrippedAt: integer("lastTrippedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const botGroupMembers = sqliteTable("botGroupMembers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botGroupId: text("botGroupId")
    .notNull()
    .references(() => botGroups.id, { onDelete: "cascade" }),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #5 Bot Secrets Vault
export const botSecrets = sqliteTable("botSecrets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  encryptedValue: text("encryptedValue").notNull(),
  // R2 #39 Secret rotation schedule
  rotateEveryDays: integer("rotateEveryDays"),
  lastRotatedAt: integer("lastRotatedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #11 Bot Heartbeat Resource Metrics
export const botMetrics = sqliteTable("botMetrics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  cpuPercent: integer("cpuPercent"),
  memoryMb: integer("memoryMb"),
  diskPercent: integer("diskPercent"),
  customMetrics: text("customMetrics").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #12 Bot Command Channel
export const botCommands = sqliteTable("botCommands", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  command: text("command").notNull(),
  payload: text("payload").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  acknowledgedAt: integer("acknowledgedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #13 Approval Gates
export const approvalGates = sqliteTable("approvalGates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  requiredRole: text("requiredRole").notNull().default("admin"),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewedBy").references(() => users.id),
  reviewNote: text("reviewNote"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #15 Checkpoint-Based Bot Workflows
export const botTaskCheckpoints = sqliteTable("botTaskCheckpoints", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botTaskId: text("botTaskId")
    .notNull()
    .references(() => botTasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  data: text("data").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewedBy").references(() => users.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #16 Escalation Rules
export const escalationRules = sqliteTable("escalationRules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  trigger: text("trigger").notNull(),
  threshold: integer("threshold").notNull().default(3),
  escalateToUserId: text("escalateToUserId").references(() => users.id),
  escalateToRole: text("escalateToRole"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #17 Approval Workflow Templates
export const approvalWorkflows = sqliteTable("approvalWorkflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  stages: text("stages").notNull().default("[]"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #18 Outbound Webhooks
export const webhooks = sqliteTable("webhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull().default("[]"),
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const webhookDeliveries = sqliteTable("webhookDeliveries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  webhookId: text("webhookId")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: integer("lastAttemptAt"),
  responseStatus: integer("responseStatus"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #19 Inbound Webhooks
export const inboundWebhooks = sqliteTable("inboundWebhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  secretToken: text("secretToken").notNull(),
  actionType: text("actionType").notNull(),
  actionConfig: text("actionConfig").notNull().default("{}"),
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #21 Email Queue
export const emailQueue = sqliteTable("emailQueue", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: integer("sentAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #22 API Token Management
export const apiTokens = sqliteTable("apiTokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  tokenPrefix: text("tokenPrefix").notNull(),
  tokenHash: text("tokenHash").notNull(),
  scopes: text("scopes").notNull().default("[]"),
  expiresAt: integer("expiresAt"),
  lastUsedAt: integer("lastUsedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #23 Sprints
export const sprints = sqliteTable("sprints", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  startDate: integer("startDate").notNull(),
  endDate: integer("endDate").notNull(),
  status: text("status").notNull().default("planning"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const sprintTasks = sqliteTable("sprintTasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sprintId: text("sprintId")
    .notNull()
    .references(() => sprints.id, { onDelete: "cascade" }),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #26 Anomaly Detection Alerts
export const alerts = sqliteTable("alerts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("warning"),
  message: text("message").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  acknowledgedAt: integer("acknowledgedAt"),
  acknowledgedBy: text("acknowledgedBy").references(() => users.id),
  // R2 #20 Notification dispatch tracking
  notificationsSent: integer("notificationsSent").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #28 AI Cost Tracking
export const aiUsageLog = sqliteTable("aiUsageLog", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  operation: text("operation").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("inputTokens").notNull().default(0),
  outputTokens: integer("outputTokens").notNull().default(0),
  estimatedCostCents: integer("estimatedCostCents").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #29 Automation Rules Engine
export const automationRules = sqliteTable("automationRules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  conditions: text("conditions").notNull().default("[]"),
  actions: text("actions").notNull().default("[]"),
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #30 Bot Task Feedback
export const botTaskFeedback = sqliteTable("botTaskFeedback", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botTaskId: text("botTaskId")
    .notNull()
    .references(() => botTasks.id, { onDelete: "cascade" }),
  reviewerId: text("reviewerId")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  feedback: text("feedback").notNull().default(""),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #32 Project Members
export const projectMembers = sqliteTable("projectMembers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("projectId")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull().default("member"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #34 Team Availability Calendar
export const userAvailability = sqliteTable("userAvailability", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  date: integer("date").notNull(),
  hoursAvailable: integer("hoursAvailable").notNull().default(8),
  note: text("note"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #36 Shared Bots Across Workspaces
export const sharedBots = sqliteTable("sharedBots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  sourceWorkspaceId: text("sourceWorkspaceId")
    .notNull()
    .references(() => workspaces.id),
  targetWorkspaceId: text("targetWorkspaceId")
    .notNull()
    .references(() => workspaces.id),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #39 Bot Task Events (Timeline)
export const botTaskEvents = sqliteTable("botTaskEvents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botTaskId: text("botTaskId")
    .notNull()
    .references(() => botTasks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #42 Custom Dashboard Widgets
export const dashboardWidgets = sqliteTable("dashboardWidgets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  widgetType: text("widgetType").notNull(),
  config: text("config").notNull().default("{}"),
  position: integer("position").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #46 Bot Sessions
export const botSessions = sqliteTable("botSessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  startedAt: integer("startedAt").notNull(),
  endedAt: integer("endedAt"),
  taskCount: integer("taskCount").notNull().default(0),
  errorCount: integer("errorCount").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #48 Visual Workflow Editor
export const workflows = sqliteTable("workflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  definition: text("definition").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const workflowRuns = sqliteTable("workflowRuns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workflowId: text("workflowId")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("running"),
  result: text("result"),
  startedAt: integer("startedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  completedAt: integer("completedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// #50 Configuration as Code
export const configImports = sqliteTable("configImports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  filename: text("filename").notNull(),
  status: text("status").notNull().default("pending"),
  summary: text("summary"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// ── Round 2 New Tables ──

// R2 #1 Agent Memory / Persistent Context
export const botMemory = sqliteTable("botMemory", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  scope: text("scope").notNull().default("task"),
  expiresAt: integer("expiresAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #2 Agent Skill Registry
export const botSkills = sqliteTable("botSkills", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  skillName: text("skillName").notNull(),
  version: text("version").notNull().default("1.0.0"),
  inputSchema: text("inputSchema").notNull().default("{}"),
  outputSchema: text("outputSchema").notNull().default("{}"),
  successRate: integer("successRate"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #4 Agent Collaboration Threads
export const agentThreads = sqliteTable("agentThreads", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId").references(() => tasks.id),
  subject: text("subject").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const agentMessages = sqliteTable("agentMessages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  threadId: text("threadId")
    .notNull()
    .references(() => agentThreads.id, { onDelete: "cascade" }),
  senderBotId: text("senderBotId").references(() => bots.id),
  content: text("content").notNull(),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #6 Agent Cost Budgets
export const costBudgets = sqliteTable("costBudgets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  entityType: text("entityType").notNull(),
  entityId: text("entityId").notNull(),
  monthlyLimitCents: integer("monthlyLimitCents").notNull(),
  currentSpendCents: integer("currentSpendCents").notNull().default(0),
  alertThresholdPercent: integer("alertThresholdPercent").notNull().default(80),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #7 Agent Config Versioning
export const botConfigVersions = sqliteTable("botConfigVersions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  configSnapshot: text("configSnapshot").notNull(),
  changedBy: text("changedBy"),
  changeReason: text("changeReason"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #8 Autonomous Task Suggestions
export const taskSuggestions = sqliteTable("taskSuggestions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id),
  botTaskId: text("botTaskId").references(() => botTasks.id),
  suggestedTitle: text("suggestedTitle").notNull(),
  suggestedDescription: text("suggestedDescription").notNull().default(""),
  reasoning: text("reasoning").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #14 Pipeline Templates
export const pipelineTemplates = sqliteTable("pipelineTemplates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("general"),
  workflowDefinition: text("workflowDefinition").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #15 Fan-Out Groups
export const fanOutGroups = sqliteTable("fanOutGroups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id),
  expectedCount: integer("expectedCount").notNull(),
  completedCount: integer("completedCount").notNull().default(0),
  status: text("status").notNull().default("running"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #19 Bot Metric Rollups
export const botMetricRollups = sqliteTable("botMetricRollups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  botId: text("botId")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  periodStart: integer("periodStart").notNull(),
  avgCpu: integer("avgCpu"),
  avgMemory: integer("avgMemory"),
  avgDisk: integer("avgDisk"),
  taskCount: integer("taskCount").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #28 Saved Views & Filters
export const savedViews = sqliteTable("savedViews", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  entityType: text("entityType").notNull().default("tasks"),
  filters: text("filters").notNull().default("{}"),
  isShared: integer("isShared").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #29 In-App Notifications
export const notifications = sqliteTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  link: text("link"),
  readAt: integer("readAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #36 Password Reset Tokens
export const passwordResetTokens = sqliteTable("passwordResetTokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  tokenHash: text("tokenHash").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  usedAt: integer("usedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #40 User Sessions
export const userSessions = sqliteTable("userSessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  deviceInfo: text("deviceInfo"),
  ipAddress: text("ipAddress"),
  lastActiveAt: integer("lastActiveAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  revokedAt: integer("revokedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #41 GitHub Integration
export const githubLinks = sqliteTable("githubLinks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("taskId")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  repoOwner: text("repoOwner").notNull(),
  repoName: text("repoName").notNull(),
  issueNumber: integer("issueNumber"),
  prNumber: integer("prNumber"),
  syncEnabled: integer("syncEnabled").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #44 External Tool Connectors
export const connectors = sqliteTable("connectors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  config: text("config").notNull().default("{}"),
  status: text("status").notNull().default("active"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R2 #11 Workflow Run Steps (for workflow engine)
export const workflowRunSteps = sqliteTable("workflowRunSteps", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workflowRunId: text("workflowRunId")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  stepId: text("stepId").notNull(),
  status: text("status").notNull().default("pending"),
  botTaskId: text("botTaskId"),
  result: text("result"),
  startedAt: integer("startedAt"),
  completedAt: integer("completedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// ── Round 4: Agentic Economy Hub ──

// R4 0.1 Unified agent abstraction (wraps local bots + external A2A peers)
export const agents = sqliteTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull().default("local"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  url: text("url"),
  status: text("status").notNull().default("offline"),
  botId: text("botId").references(() => bots.id),
  protocolVersion: text("protocolVersion").notNull().default("0.3"),
  capabilities: text("capabilities").notNull().default("{}"),
  securitySchemes: text("securitySchemes").notNull().default("{}"),
  reputation: integer("reputation").notNull().default(50),
  verified: integer("verified").notNull().default(0),
  did: text("did"),
  agentCardCache: text("agentCardCache"),
  agentCardCachedAt: integer("agentCardCachedAt"),
  // M5 profile columns
  slug: text("slug").unique(),
  tagline: text("tagline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  avatar: text("avatar"),
  agentRole: text("agentRole").notNull().default("agent"),
  visibility: text("visibility").notNull().default("private"),
  tags: text("tags").notNull().default("[]"),
  hourlyRate: integer("hourlyRate"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone"),
  links: text("links").notNull().default("{}"),
  featured: integer("featured").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

// R4 0.2 Agent skills (normalized, linked to agent not bot)
export const agentSkills = sqliteTable("agentSkills", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agentId")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  skillId: text("skillId").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  inputModes: text("inputModes").notNull().default("[]"),
  outputModes: text("outputModes").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  examples: text("examples").notNull().default("[]"),
  priceCents: integer("priceCents"),
  pricingModel: text("pricingModel").notNull().default("free"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 1.9 SLA / service agreements
export const serviceAgreements = sqliteTable("serviceAgreements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agentId")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  skillId: text("skillId"),
  maxResponseMs: integer("maxResponseMs"),
  maxDurationMs: integer("maxDurationMs"),
  guaranteedAvailability: integer("guaranteedAvailability"),
  priceCents: integer("priceCents"),
  penaltyPolicy: text("penaltyPolicy").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 2.3 x402 pricing configuration
export const x402Prices = sqliteTable("x402Prices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  routePattern: text("routePattern").notNull(),
  agentSkillId: text("agentSkillId").references(() => agentSkills.id),
  amountUsdc: text("amountUsdc").notNull(),
  network: text("network").notNull().default("base"),
  description: text("description").notNull().default(""),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 2.4 x402 transactions (escrow-based)
export const x402Transactions = sqliteTable("x402Transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  payerAddress: text("payerAddress").notNull(),
  amount: text("amount").notNull(),
  asset: text("asset").notNull().default("USDC"),
  network: text("network").notNull().default("base"),
  txHash: text("txHash"),
  status: text("status").notNull().default("authorized"),
  taskId: text("taskId").references(() => tasks.id),
  verifiedAt: integer("verifiedAt"),
  settledAt: integer("settledAt"),
  refundedAt: integer("refundedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 2.7 AP2 payment mandates
export const paymentMandates = sqliteTable("paymentMandates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull(),
  payerIdentity: text("payerIdentity").notNull(),
  amount: text("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("authorized"),
  signature: text("signature").notNull(),
  expiresAt: integer("expiresAt"),
  capturedAt: integer("capturedAt"),
  settledAt: integer("settledAt"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 3.1 Payment providers
export const paymentProviders = sqliteTable("paymentProviders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  configEncrypted: text("configEncrypted").notNull(),
  isDefault: integer("isDefault").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 3.2 ACP product catalog
export const agentProducts = sqliteTable("agentProducts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  agentId: text("agentId")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  skillId: text("skillId"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("priceCents").notNull(),
  currency: text("currency").notNull().default("USD"),
  pricingModel: text("pricingModel").notNull().default("per_task"),
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 3.3 ACP checkout sessions (escrow lifecycle)
export const checkoutSessions = sqliteTable("checkoutSessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  buyerAgentId: text("buyerAgentId").references(() => agents.id),
  status: text("status").notNull().default("open"),
  lineItems: text("lineItems").notNull().default("[]"),
  totalCents: integer("totalCents").notNull(),
  paymentProviderId: text("paymentProviderId").references(() => paymentProviders.id),
  paymentRef: text("paymentRef"),
  mandateId: text("mandateId").references(() => paymentMandates.id),
  expiresAt: integer("expiresAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 3.6 Order fulfillment
export const orders = sqliteTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  checkoutSessionId: text("checkoutSessionId")
    .notNull()
    .references(() => checkoutSessions.id),
  status: text("status").notNull().default("pending_fulfillment"),
  agentTaskId: text("agentTaskId"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// R4 4.6 Payment disputes
export const paymentDisputes = sqliteTable("paymentDisputes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  checkoutSessionId: text("checkoutSessionId").references(() => checkoutSessions.id),
  x402TransactionId: text("x402TransactionId").references(() => x402Transactions.id),
  reason: text("reason").notNull(),
  evidence: text("evidence").notNull().default("{}"),
  status: text("status").notNull().default("open"),
  resolvedBy: text("resolvedBy").references(() => users.id),
  resolvedAt: integer("resolvedAt"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// ── M5 Tables ──

// M5 1.1 Channel dispatch
export const channels = sqliteTable("channels", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  type: text("type").notNull(), // slack_webhook | discord_webhook | webhook | in_app | email
  name: text("name").notNull(),
  config: text("config").notNull().default("{}"), // type-specific config JSON
  events: text("events").notNull().default('["*"]'), // event glob patterns
  minSeverity: text("minSeverity").notNull().default("info"),
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const channelDeliveries = sqliteTable("channelDeliveries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  channelId: text("channelId")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull().default("{}"),
  status: text("status").notNull().default("pending"), // pending | delivered | failed
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: integer("lastAttemptAt"),
  responseStatus: integer("responseStatus"),
  errorMessage: text("errorMessage"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// M5 1.1 Teams
export const teams = sqliteTable("teams", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  avatar: text("avatar"),
  isDefault: integer("isDefault").notNull().default(0),
  visibility: text("visibility").notNull().default("private"), // public | unlisted | private
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

export const teamMembers = sqliteTable("teamMembers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  teamId: text("teamId")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  memberType: text("memberType").notNull().default("user"), // user | bot
  userId: text("userId").references(() => users.id),
  botId: text("botId").references(() => bots.id),
  role: text("role").notNull().default("member"), // lead | member | observer
  joinedAt: integer("joinedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  removedAt: integer("removedAt"),
});

export const teamCollaborations = sqliteTable("teamCollaborations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  sourceTeamId: text("sourceTeamId")
    .notNull()
    .references(() => teams.id),
  targetTeamId: text("targetTeamId")
    .notNull()
    .references(() => teams.id),
  scope: text("scope").notNull().default("tasks"), // tasks | bots | all
  direction: text("direction").notNull().default("bidirectional"), // inbound | outbound | bidirectional
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// M5 1.1 Webhook subscriptions (public API)
export const webhookSubscriptions = sqliteTable("webhookSubscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull().default('["*"]'),
  active: integer("active").notNull().default(1),
  lastDeliveredAt: integer("lastDeliveredAt"),
  failCount: integer("failCount").notNull().default(0),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// ── M5 Relations ──

export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [channels.workspaceId], references: [workspaces.id] }),
  deliveries: many(channelDeliveries),
}));

export const channelDeliveriesRelations = relations(channelDeliveries, ({ one }) => ({
  channel: one(channels, { fields: [channelDeliveries.channelId], references: [channels.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [teams.workspaceId], references: [workspaces.id] }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  bot: one(bots, { fields: [teamMembers.botId], references: [bots.id] }),
}));

export const teamCollaborationsRelations = relations(teamCollaborations, ({ one }) => ({
  workspace: one(workspaces, { fields: [teamCollaborations.workspaceId], references: [workspaces.id] }),
  sourceTeam: one(teams, { fields: [teamCollaborations.sourceTeamId], references: [teams.id] }),
  targetTeam: one(teams, { fields: [teamCollaborations.targetTeamId], references: [teams.id] }),
}));

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one }) => ({
  workspace: one(workspaces, { fields: [webhookSubscriptions.workspaceId], references: [workspaces.id] }),
}));

// ── Round 4 Relations ──

export const agentsRelations = relations(agents, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [agents.workspaceId], references: [workspaces.id] }),
  bot: one(bots, { fields: [agents.botId], references: [bots.id] }),
  skills: many(agentSkills),
  products: many(agentProducts),
  serviceAgreements: many(serviceAgreements),
}));

export const agentSkillsRelations = relations(agentSkills, ({ one }) => ({
  agent: one(agents, { fields: [agentSkills.agentId], references: [agents.id] }),
}));

export const serviceAgreementsRelations = relations(serviceAgreements, ({ one }) => ({
  agent: one(agents, { fields: [serviceAgreements.agentId], references: [agents.id] }),
}));

export const x402PricesRelations = relations(x402Prices, ({ one }) => ({
  workspace: one(workspaces, { fields: [x402Prices.workspaceId], references: [workspaces.id] }),
  agentSkill: one(agentSkills, { fields: [x402Prices.agentSkillId], references: [agentSkills.id] }),
}));

export const x402TransactionsRelations = relations(x402Transactions, ({ one }) => ({
  workspace: one(workspaces, { fields: [x402Transactions.workspaceId], references: [workspaces.id] }),
  task: one(tasks, { fields: [x402Transactions.taskId], references: [tasks.id] }),
}));

export const paymentMandatesRelations = relations(paymentMandates, ({ one }) => ({
  workspace: one(workspaces, { fields: [paymentMandates.workspaceId], references: [workspaces.id] }),
}));

export const paymentProvidersRelations = relations(paymentProviders, ({ one }) => ({
  workspace: one(workspaces, { fields: [paymentProviders.workspaceId], references: [workspaces.id] }),
}));

export const agentProductsRelations = relations(agentProducts, ({ one }) => ({
  agent: one(agents, { fields: [agentProducts.agentId], references: [agents.id] }),
}));

export const checkoutSessionsRelations = relations(checkoutSessions, ({ one }) => ({
  workspace: one(workspaces, { fields: [checkoutSessions.workspaceId], references: [workspaces.id] }),
  buyerAgent: one(agents, { fields: [checkoutSessions.buyerAgentId], references: [agents.id] }),
  paymentProvider: one(paymentProviders, { fields: [checkoutSessions.paymentProviderId], references: [paymentProviders.id] }),
  mandate: one(paymentMandates, { fields: [checkoutSessions.mandateId], references: [paymentMandates.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  checkoutSession: one(checkoutSessions, { fields: [orders.checkoutSessionId], references: [checkoutSessions.id] }),
}));

export const paymentDisputesRelations = relations(paymentDisputes, ({ one }) => ({
  workspace: one(workspaces, { fields: [paymentDisputes.workspaceId], references: [workspaces.id] }),
  checkoutSession: one(checkoutSessions, { fields: [paymentDisputes.checkoutSessionId], references: [checkoutSessions.id] }),
  x402Transaction: one(x402Transactions, { fields: [paymentDisputes.x402TransactionId], references: [x402Transactions.id] }),
  resolver: one(users, { fields: [paymentDisputes.resolvedBy], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  projects: many(projects),
  bots: many(bots),
  pairingTokens: many(pairingTokens),
  auditLogs: many(auditLogs),
  botGuidelines: many(botGuidelines),
  botReleaseNotes: many(botReleaseNotes),
  taskTemplates: many(taskTemplates),
  botGroups: many(botGroups),
  webhooks: many(webhooks),
  inboundWebhooks: many(inboundWebhooks),
  escalationRules: many(escalationRules),
  approvalWorkflows: many(approvalWorkflows),
  alerts: many(alerts),
  aiUsageLog: many(aiUsageLog),
  automationRules: many(automationRules),
  workflows: many(workflows),
  configImports: many(configImports),
  channels: many(channels),
  teams: many(teams),
  webhookSubscriptions: many(webhookSubscriptions),
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
  subtasks: many(subtasks),
  comments: many(taskComments),
  timeEntries: many(timeEntries),
  mentions: many(taskMentions),
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

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
  }),
  dependsOn: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
  }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
  uploader: one(users, {
    fields: [taskAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [taskTemplates.workspaceId],
    references: [workspaces.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  task: one(tasks, {
    fields: [timeEntries.taskId],
    references: [tasks.id],
  }),
}));

export const taskHandoffsRelations = relations(taskHandoffs, ({ one }) => ({
  fromBotTask: one(botTasks, {
    fields: [taskHandoffs.fromBotTaskId],
    references: [botTasks.id],
  }),
  toBotTask: one(botTasks, {
    fields: [taskHandoffs.toBotTaskId],
    references: [botTasks.id],
  }),
}));

export const taskMentionsRelations = relations(taskMentions, ({ one }) => ({
  task: one(tasks, {
    fields: [taskMentions.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskMentions.userId],
    references: [users.id],
  }),
}));

export const botGroupsRelations = relations(botGroups, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [botGroups.workspaceId],
    references: [workspaces.id],
  }),
  members: many(botGroupMembers),
}));

export const botGroupMembersRelations = relations(botGroupMembers, ({ one }) => ({
  group: one(botGroups, {
    fields: [botGroupMembers.botGroupId],
    references: [botGroups.id],
  }),
  bot: one(bots, {
    fields: [botGroupMembers.botId],
    references: [bots.id],
  }),
}));

export const botSecretsRelations = relations(botSecrets, ({ one }) => ({
  bot: one(bots, {
    fields: [botSecrets.botId],
    references: [bots.id],
  }),
  workspace: one(workspaces, {
    fields: [botSecrets.workspaceId],
    references: [workspaces.id],
  }),
}));

export const botMetricsRelations = relations(botMetrics, ({ one }) => ({
  bot: one(bots, {
    fields: [botMetrics.botId],
    references: [bots.id],
  }),
}));

export const botCommandsRelations = relations(botCommands, ({ one }) => ({
  bot: one(bots, {
    fields: [botCommands.botId],
    references: [bots.id],
  }),
}));

export const approvalGatesRelations = relations(approvalGates, ({ one }) => ({
  task: one(tasks, {
    fields: [approvalGates.taskId],
    references: [tasks.id],
  }),
  reviewer: one(users, {
    fields: [approvalGates.reviewedBy],
    references: [users.id],
  }),
}));

export const botTaskCheckpointsRelations = relations(botTaskCheckpoints, ({ one }) => ({
  botTask: one(botTasks, {
    fields: [botTaskCheckpoints.botTaskId],
    references: [botTasks.id],
  }),
  reviewer: one(users, {
    fields: [botTaskCheckpoints.reviewedBy],
    references: [users.id],
  }),
}));

export const escalationRulesRelations = relations(escalationRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [escalationRules.workspaceId],
    references: [workspaces.id],
  }),
  escalateToUser: one(users, {
    fields: [escalationRules.escalateToUserId],
    references: [users.id],
  }),
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [approvalWorkflows.workspaceId],
    references: [workspaces.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [webhooks.workspaceId],
    references: [workspaces.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

export const inboundWebhooksRelations = relations(inboundWebhooks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [inboundWebhooks.workspaceId],
    references: [workspaces.id],
  }),
}));

export const emailQueueRelations = relations(emailQueue, ({ one }) => ({
  user: one(users, {
    fields: [emailQueue.userId],
    references: [users.id],
  }),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiTokens.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.id],
  }),
}));

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project: one(projects, {
    fields: [sprints.projectId],
    references: [projects.id],
  }),
  sprintTasks: many(sprintTasks),
}));

export const sprintTasksRelations = relations(sprintTasks, ({ one }) => ({
  sprint: one(sprints, {
    fields: [sprintTasks.sprintId],
    references: [sprints.id],
  }),
  task: one(tasks, {
    fields: [sprintTasks.taskId],
    references: [tasks.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [alerts.workspaceId],
    references: [workspaces.id],
  }),
  acknowledger: one(users, {
    fields: [alerts.acknowledgedBy],
    references: [users.id],
  }),
}));

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [aiUsageLog.workspaceId],
    references: [workspaces.id],
  }),
}));

export const automationRulesRelations = relations(automationRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [automationRules.workspaceId],
    references: [workspaces.id],
  }),
}));

export const botTaskFeedbackRelations = relations(botTaskFeedback, ({ one }) => ({
  botTask: one(botTasks, {
    fields: [botTaskFeedback.botTaskId],
    references: [botTasks.id],
  }),
  reviewer: one(users, {
    fields: [botTaskFeedback.reviewerId],
    references: [users.id],
  }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const userAvailabilityRelations = relations(userAvailability, ({ one }) => ({
  user: one(users, {
    fields: [userAvailability.userId],
    references: [users.id],
  }),
}));

export const sharedBotsRelations = relations(sharedBots, ({ one }) => ({
  bot: one(bots, {
    fields: [sharedBots.botId],
    references: [bots.id],
  }),
}));

export const botTaskEventsRelations = relations(botTaskEvents, ({ one }) => ({
  botTask: one(botTasks, {
    fields: [botTaskEvents.botTaskId],
    references: [botTasks.id],
  }),
}));

export const dashboardWidgetsRelations = relations(dashboardWidgets, ({ one }) => ({
  user: one(users, {
    fields: [dashboardWidgets.userId],
    references: [users.id],
  }),
}));

export const botSessionsRelations = relations(botSessions, ({ one }) => ({
  bot: one(bots, {
    fields: [botSessions.botId],
    references: [bots.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [workflows.workspaceId],
    references: [workspaces.id],
  }),
  runs: many(workflowRuns),
}));

export const workflowRunsRelations = relations(workflowRuns, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowRuns.workflowId],
    references: [workflows.id],
  }),
}));

export const configImportsRelations = relations(configImports, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [configImports.workspaceId],
    references: [workspaces.id],
  }),
}));

// ── Round 2 Relations ──

export const botMemoryRelations = relations(botMemory, ({ one }) => ({
  bot: one(bots, { fields: [botMemory.botId], references: [bots.id] }),
}));

export const botSkillsRelations = relations(botSkills, ({ one }) => ({
  bot: one(bots, { fields: [botSkills.botId], references: [bots.id] }),
}));

export const agentThreadsRelations = relations(agentThreads, ({ one, many }) => ({
  task: one(tasks, { fields: [agentThreads.taskId], references: [tasks.id] }),
  messages: many(agentMessages),
}));

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  thread: one(agentThreads, { fields: [agentMessages.threadId], references: [agentThreads.id] }),
  sender: one(bots, { fields: [agentMessages.senderBotId], references: [bots.id] }),
}));

export const costBudgetsRelations = relations(costBudgets, () => ({}));

export const botConfigVersionsRelations = relations(botConfigVersions, ({ one }) => ({
  bot: one(bots, { fields: [botConfigVersions.botId], references: [bots.id] }),
}));

export const taskSuggestionsRelations = relations(taskSuggestions, ({ one }) => ({
  bot: one(bots, { fields: [taskSuggestions.botId], references: [bots.id] }),
  botTask: one(botTasks, { fields: [taskSuggestions.botTaskId], references: [botTasks.id] }),
}));

export const pipelineTemplatesRelations = relations(pipelineTemplates, ({ one }) => ({
  workspace: one(workspaces, { fields: [pipelineTemplates.workspaceId], references: [workspaces.id] }),
}));

export const fanOutGroupsRelations = relations(fanOutGroups, ({ one }) => ({
  task: one(tasks, { fields: [fanOutGroups.taskId], references: [tasks.id] }),
}));

export const botMetricRollupsRelations = relations(botMetricRollups, ({ one }) => ({
  bot: one(bots, { fields: [botMetricRollups.botId], references: [bots.id] }),
}));

export const savedViewsRelations = relations(savedViews, ({ one }) => ({
  user: one(users, { fields: [savedViews.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const githubLinksRelations = relations(githubLinks, ({ one }) => ({
  task: one(tasks, { fields: [githubLinks.taskId], references: [tasks.id] }),
}));

export const connectorsRelations = relations(connectors, ({ one }) => ({
  workspace: one(workspaces, { fields: [connectors.workspaceId], references: [workspaces.id] }),
}));

export const workflowRunStepsRelations = relations(workflowRunSteps, ({ one }) => ({
  workflowRun: one(workflowRuns, { fields: [workflowRunSteps.workflowRunId], references: [workflowRuns.id] }),
}));
