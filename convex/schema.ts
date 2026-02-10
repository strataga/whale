import { defineEnt, defineEntSchema, getEntDefinitions } from "convex-ents";
import { v } from "convex/values";

// ── Core Tables ──

const workspaces = defineEnt({
  name: v.string(),
  timezone: v.optional(v.string()),
  aiProvider: v.optional(v.string()),
  aiApiKey: v.optional(v.string()),
  ipAllowlist: v.optional(v.string()),
  slackWebhookUrl: v.optional(v.string()),
  discordWebhookUrl: v.optional(v.string()),
  securityPolicy: v.optional(v.string()),
  retentionDays: v.optional(v.number()),
  onboardingCompletedAt: v.optional(v.number()),
  slackTeamId: v.optional(v.string()),
  slackBotToken: v.optional(v.string()),
  updatedAt: v.number(),
  whaleMdContent: v.optional(v.string()),
  whaleMdUpdatedAt: v.optional(v.number()),
})
  .deletion("soft")
  .edges("users", { ref: true })
  .edges("projects", { ref: true })
  .edges("bots", { ref: true })
  .edges("pairingTokens", { ref: true })
  .edges("auditLogs", { ref: true })
  .edges("botGuidelines", { ref: true })
  .edges("botReleaseNotes", { ref: true })
  .edges("taskTemplates", { ref: true })
  .edges("botGroups", { ref: true })
  .edges("webhooks", { ref: true })
  .edges("inboundWebhooks", { ref: true })
  .edges("escalationRules", { ref: true })
  .edges("approvalWorkflows", { ref: true })
  .edges("alerts", { ref: true })
  .edges("aiUsageLogs", { ref: true })
  .edges("automationRules", { ref: true })
  .edges("workflows", { ref: true })
  .edges("configImports", { ref: true })
  .edges("channels", { ref: true })
  .edges("teams", { ref: true })
  .edges("webhookSubscriptions", { ref: true })
  .edges("agents", { ref: true })
  .edges("x402Prices", { ref: true })
  .edges("x402Transactions", { ref: true })
  .edges("paymentMandates", { ref: true })
  .edges("paymentProviders", { ref: true })
  .edges("paymentDisputes", { ref: true })
  .edges("checkoutSessions", { ref: true })
  .edges("costBudgets", { ref: "workspaceId", name: "costBudgets_by_workspace" })
  .edges("apiTokens", { ref: true })
  .edges("connectors", { ref: true })
  .edges("pipelineTemplates", { ref: true })
  .edges("botSecrets", { ref: "workspaceId", name: "botSecrets_by_workspace" })
  .edges("missionStatements", { ref: true });

const users = defineEnt({
  workspaceId: v.id("workspaces"),
  email: v.string(),
  passwordHash: v.string(),
  name: v.optional(v.string()),
  role: v.string(),
  themePreference: v.string(),
  emailDigestFrequency: v.optional(v.string()),
  lastActiveAt: v.optional(v.number()),
  totpSecret: v.optional(v.string()),
  totpEnabled: v.boolean(),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("workspace")
  .index("by_email", ["email"])
  .index("by_workspace", ["workspaceId"])
  .edges("notifications", { ref: true })
  .edges("savedViews", { ref: true })
  .edges("dashboardWidgets", { ref: true })
  .edges("userAvailability", { ref: true })
  .edges("userSessions", { ref: true })
  .edges("passwordResetTokens", { ref: true })
  .edges("apiTokens", { ref: "userId", name: "apiTokens_by_user" });

const projects = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  description: v.string(),
  status: v.string(),
  visibility: v.string(),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .edges("milestones", { ref: true })
  .edges("tasks", { ref: true, name: "tasks_project" })
  .edges("missionStatements", { ref: true })
  .edges("sprints", { ref: true })
  .edges("projectMembers", { ref: true });

const missionStatements = defineEnt({
  workspaceId: v.id("workspaces"),
  projectId: v.id("projects"),
  body: v.string(),
  createdByUserId: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("workspace")
  .edge("project")
  .index("by_workspace", ["workspaceId"])
  .index("by_project", ["projectId"])
  .index("by_project_createdAt", ["projectId", "createdAt"]);

const milestones = defineEnt({
  projectId: v.id("projects"),
  name: v.string(),
  dueDate: v.optional(v.number()),
  position: v.number(),
  approvalWorkflowId: v.optional(v.id("approvalWorkflows")),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("project")
  .index("by_project", ["projectId"])
  .edges("tasks", { ref: "milestoneId", name: "tasks_by_milestone" });

const tasks = defineEnt({
  projectId: v.optional(v.id("projects")),
  milestoneId: v.optional(v.id("milestones")),
  title: v.string(),
  description: v.string(),
  status: v.string(),
  priority: v.string(),
  assigneeId: v.optional(v.id("users")),
  dueDate: v.optional(v.number()),
  tags: v.array(v.string()),
  position: v.number(),
  sortOrder: v.number(),
  estimatedMinutes: v.optional(v.number()),
  recurrence: v.optional(v.string()),
  requiresApproval: v.boolean(),
  sourceAgentId: v.optional(v.string()),
  sourceProtocol: v.optional(v.string()),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("project", { field: "projectId" })
  .edge("milestone", { field: "milestoneId" })
  .index("by_project", ["projectId"])
  .index("by_milestone", ["milestoneId"])
  .index("by_assignee", ["assigneeId"])
  .index("by_status", ["status"])
  .edges("subtasks", { ref: true })
  .edges("taskComments", { ref: true })
  .edges("timeEntries", { ref: true })
  .edges("taskMentions", { ref: true })
  .edges("taskDependencies", { ref: true, name: "taskDependencies_task" })
  .edges("taskAttachments", { ref: true })
  .edges("botTasks", { ref: true })
  .edges("approvalGates", { ref: true })
  .edges("agentThreads", { ref: true })
  .edges("fanOutGroups", { ref: true })
  .edges("githubLinks", { ref: true })
  .edges("sprintTasks", { ref: true });

const taskDependencies = defineEnt({
  taskId: v.id("tasks"),
  dependsOnTaskId: v.id("tasks"),
})
  .edge("task", { field: "taskId" })
  .index("by_task", ["taskId"]);

const taskAttachments = defineEnt({
  taskId: v.id("tasks"),
  filename: v.string(),
  originalName: v.string(),
  mimeType: v.string(),
  sizeBytes: v.number(),
  uploadedBy: v.id("users"),
})
  .edge("task", { field: "taskId" })
  .index("by_task", ["taskId"]);

const subtasks = defineEnt({
  taskId: v.id("tasks"),
  title: v.string(),
  done: v.boolean(),
  position: v.number(),
})
  .edge("task")
  .index("by_task", ["taskId"]);

const taskComments = defineEnt({
  taskId: v.id("tasks"),
  authorId: v.optional(v.string()),
  authorType: v.string(),
  body: v.string(),
})
  .edge("task")
  .index("by_task", ["taskId"]);

const taskTemplates = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  titlePattern: v.string(),
  description: v.string(),
  priority: v.string(),
  tags: v.array(v.string()),
  subtaskTitles: v.array(v.string()),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const timeEntries = defineEnt({
  taskId: v.id("tasks"),
  userId: v.optional(v.id("users")),
  botId: v.optional(v.id("bots")),
  minutes: v.number(),
  note: v.string(),
})
  .edge("task")
  .index("by_task", ["taskId"]);

const taskHandoffs = defineEnt({
  fromBotTaskId: v.id("botTasks"),
  toBotTaskId: v.id("botTasks"),
  contextPayload: v.string(),
});

const taskMentions = defineEnt({
  taskId: v.id("tasks"),
  userId: v.id("users"),
})
  .edge("task")
  .index("by_task", ["taskId"]);

// ── Bot Tables ──

const bots = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  host: v.string(),
  deviceId: v.optional(v.string()),
  status: v.string(),
  statusReason: v.optional(v.string()),
  statusChangedAt: v.optional(v.number()),
  capabilities: v.array(v.string()),
  lastSeenAt: v.optional(v.number()),
  tokenPrefix: v.string(),
  tokenHash: v.string(),
  currentBotTaskId: v.optional(v.string()),
  onboardedAt: v.optional(v.number()),
  version: v.optional(v.string()),
  autoUpdate: v.boolean(),
  allowedProjects: v.optional(v.string()),
  allowedTags: v.optional(v.string()),
  environment: v.optional(v.string()),
  labels: v.optional(v.string()),
  maxConcurrentTasks: v.number(),
  sandboxPolicy: v.optional(v.string()),
  previousTokenHash: v.optional(v.string()),
  tokenRotatedAt: v.optional(v.number()),
  tokenGracePeriodMs: v.optional(v.number()),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .index("by_status", ["status"])
  .edges("botTasks", { ref: true })
  .edges("botLogs", { ref: true })
  .edges("botMetrics", { ref: true })
  .edges("botCommands", { ref: true })
  .edges("botSessions", { ref: true })
  .edges("botMemory", { ref: true })
  .edges("botSkills", { ref: true })
  .edges("botConfigVersions", { ref: true })
  .edges("botSecrets", { ref: "botId", name: "botSecrets_by_bot" })
  .edges("botGroupMembers", { ref: "botId", name: "botGroupMembers_by_bot" });

const botTasks = defineEnt({
  botId: v.id("bots"),
  taskId: v.id("tasks"),
  status: v.string(),
  queuePosition: v.optional(v.number()),
  outputSummary: v.optional(v.string()),
  outputSchema: v.optional(v.string()),
  outputData: v.optional(v.string()),
  artifactLinks: v.array(v.string()),
  cancelledAt: v.optional(v.number()),
  cancelledBy: v.optional(v.string()),
  retryCount: v.number(),
  maxRetries: v.number(),
  retryAfter: v.optional(v.number()),
  botGroupId: v.optional(v.string()),
  timeoutMinutes: v.optional(v.number()),
  confidenceScore: v.optional(v.number()),
  confidenceReason: v.optional(v.string()),
  fanOutGroupId: v.optional(v.string()),
  preemptedBy: v.optional(v.string()),
  preemptedAt: v.optional(v.number()),
  reviewStatus: v.optional(v.string()),
  reviewedBy: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  structuredSpec: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("bot")
  .edge("task")
  .index("by_bot", ["botId"])
  .index("by_task", ["taskId"])
  .index("by_status", ["status"])
  .edges("botTaskCheckpoints", { ref: true })
  .edges("botTaskEvents", { ref: true })
  .edges("botTaskFeedback", { ref: true, name: "botTaskFeedback_botTask" });

const pairingTokens = defineEnt({
  workspaceId: v.id("workspaces"),
  tokenHash: v.string(),
  expiresAt: v.number(),
  consumedAt: v.optional(v.number()),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const auditLogs = defineEnt({
  workspaceId: v.id("workspaces"),
  userId: v.optional(v.id("users")),
  action: v.string(),
  metadata: v.string(),
  before: v.optional(v.string()),
  after: v.optional(v.string()),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const botLogs = defineEnt({
  botId: v.id("bots"),
  workspaceId: v.id("workspaces"),
  level: v.string(),
  message: v.string(),
  metadata: v.string(),
  botTaskId: v.optional(v.id("botTasks")),
})
  .edge("bot")
  .index("by_bot", ["botId"])
  .index("by_workspace", ["workspaceId"]);

const botGuidelines = defineEnt({
  workspaceId: v.id("workspaces"),
  title: v.string(),
  content: v.string(),
  version: v.number(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const botReleaseNotes = defineEnt({
  workspaceId: v.id("workspaces"),
  version: v.string(),
  title: v.string(),
  body: v.string(),
  releaseUrl: v.optional(v.string()),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const botGroups = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  description: v.string(),
  circuitState: v.string(),
  lastTrippedAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .edges("botGroupMembers", { ref: true, name: "botGroupMembers_group" });

const botGroupMembers = defineEnt({
  botGroupId: v.id("botGroups"),
  botId: v.id("bots"),
})
  .edge("botGroup", { field: "botGroupId" })
  .edge("bot", { field: "botId" })
  .index("by_group", ["botGroupId"])
  .index("by_bot", ["botId"]);

const botSecrets = defineEnt({
  botId: v.id("bots"),
  workspaceId: v.id("workspaces"),
  name: v.string(),
  encryptedValue: v.string(),
  rotateEveryDays: v.optional(v.number()),
  lastRotatedAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("bot")
  .edge("workspace")
  .index("by_bot", ["botId"])
  .index("by_workspace", ["workspaceId"]);

const botMetrics = defineEnt({
  botId: v.id("bots"),
  cpuPercent: v.optional(v.number()),
  memoryMb: v.optional(v.number()),
  diskPercent: v.optional(v.number()),
  customMetrics: v.string(),
})
  .edge("bot")
  .index("by_bot", ["botId"]);

const botCommands = defineEnt({
  botId: v.id("bots"),
  command: v.string(),
  payload: v.string(),
  status: v.string(),
  acknowledgedAt: v.optional(v.number()),
})
  .edge("bot")
  .index("by_bot", ["botId"]);

const approvalGates = defineEnt({
  taskId: v.id("tasks"),
  requiredRole: v.string(),
  status: v.string(),
  reviewedBy: v.optional(v.id("users")),
  reviewNote: v.optional(v.string()),
  updatedAt: v.number(),
})
  .edge("task")
  .index("by_task", ["taskId"]);

const botTaskCheckpoints = defineEnt({
  botTaskId: v.id("botTasks"),
  name: v.string(),
  data: v.string(),
  status: v.string(),
  reviewedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
})
  .edge("botTask")
  .index("by_botTask", ["botTaskId"]);

const escalationRules = defineEnt({
  workspaceId: v.id("workspaces"),
  trigger: v.string(),
  threshold: v.number(),
  escalateToUserId: v.optional(v.id("users")),
  escalateToRole: v.optional(v.string()),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const approvalWorkflows = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  stages: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const webhooks = defineEnt({
  workspaceId: v.id("workspaces"),
  url: v.string(),
  secret: v.string(),
  events: v.array(v.string()),
  active: v.boolean(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .edges("webhookDeliveries", { ref: true });

const webhookDeliveries = defineEnt({
  webhookId: v.id("webhooks"),
  event: v.string(),
  payload: v.string(),
  status: v.string(),
  attempts: v.number(),
  lastAttemptAt: v.optional(v.number()),
  responseStatus: v.optional(v.number()),
})
  .edge("webhook")
  .index("by_webhook", ["webhookId"]);

const inboundWebhooks = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  secretToken: v.string(),
  actionType: v.string(),
  actionConfig: v.string(),
  active: v.boolean(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const emailQueue = defineEnt({
  userId: v.id("users"),
  subject: v.string(),
  body: v.string(),
  status: v.string(),
  sentAt: v.optional(v.number()),
});

const apiTokens = defineEnt({
  workspaceId: v.id("workspaces"),
  userId: v.id("users"),
  name: v.string(),
  tokenPrefix: v.string(),
  tokenHash: v.string(),
  scopes: v.array(v.string()),
  expiresAt: v.optional(v.number()),
  lastUsedAt: v.optional(v.number()),
})
  .edge("workspace")
  .edge("user", { field: "userId" })
  .index("by_workspace", ["workspaceId"])
  .index("by_user", ["userId"]);

const sprints = defineEnt({
  projectId: v.id("projects"),
  name: v.string(),
  startDate: v.number(),
  endDate: v.number(),
  status: v.string(),
  updatedAt: v.number(),
})
  .edge("project")
  .index("by_project", ["projectId"])
  .edges("sprintTasks", { ref: true });

const sprintTasks = defineEnt({
  sprintId: v.id("sprints"),
  taskId: v.id("tasks"),
})
  .edge("sprint")
  .edge("task")
  .index("by_sprint", ["sprintId"])
  .index("by_task", ["taskId"]);

const alerts = defineEnt({
  workspaceId: v.id("workspaces"),
  type: v.string(),
  severity: v.string(),
  message: v.string(),
  metadata: v.string(),
  acknowledgedAt: v.optional(v.number()),
  acknowledgedBy: v.optional(v.id("users")),
  notificationsSent: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const aiUsageLogs = defineEnt({
  workspaceId: v.id("workspaces"),
  operation: v.string(),
  provider: v.string(),
  model: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  estimatedCostCents: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const automationRules = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  trigger: v.string(),
  conditions: v.string(),
  actions: v.string(),
  active: v.boolean(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const botTaskFeedback = defineEnt({
  botTaskId: v.id("botTasks"),
  reviewerId: v.id("users"),
  rating: v.number(),
  feedback: v.string(),
})
  .edge("botTask", { field: "botTaskId" })
  .index("by_botTask", ["botTaskId"]);

const projectMembers = defineEnt({
  projectId: v.id("projects"),
  userId: v.id("users"),
  role: v.string(),
})
  .edge("project")
  .index("by_project", ["projectId"]);

const userAvailability = defineEnt({
  userId: v.id("users"),
  date: v.number(),
  hoursAvailable: v.number(),
  note: v.optional(v.string()),
})
  .edge("user")
  .index("by_user", ["userId"]);

const sharedBots = defineEnt({
  botId: v.id("bots"),
  sourceWorkspaceId: v.id("workspaces"),
  targetWorkspaceId: v.id("workspaces"),
});

const botTaskEvents = defineEnt({
  botTaskId: v.id("botTasks"),
  event: v.string(),
  metadata: v.string(),
})
  .edge("botTask")
  .index("by_botTask", ["botTaskId"]);

const dashboardWidgets = defineEnt({
  userId: v.id("users"),
  widgetType: v.string(),
  config: v.string(),
  position: v.number(),
  updatedAt: v.number(),
})
  .edge("user")
  .index("by_user", ["userId"]);

const botSessions = defineEnt({
  botId: v.id("bots"),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  taskCount: v.number(),
  errorCount: v.number(),
})
  .edge("bot")
  .index("by_bot", ["botId"]);

const workflows = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  definition: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .edges("workflowRuns", { ref: true });

const workflowRuns = defineEnt({
  workflowId: v.id("workflows"),
  status: v.string(),
  result: v.optional(v.string()),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .edge("workflow")
  .index("by_workflow", ["workflowId"])
  .edges("workflowRunSteps", { ref: true });

const configImports = defineEnt({
  workspaceId: v.id("workspaces"),
  filename: v.string(),
  status: v.string(),
  summary: v.optional(v.string()),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

// ── Round 2 Tables ──

const botMemory = defineEnt({
  botId: v.id("bots"),
  key: v.string(),
  value: v.string(),
  scope: v.string(),
  expiresAt: v.optional(v.number()),
})
  .edge("bot")
  .index("by_bot", ["botId"]);

const botSkills = defineEnt({
  botId: v.id("bots"),
  skillName: v.string(),
  version: v.string(),
  inputSchema: v.string(),
  outputSchema: v.string(),
  successRate: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("bot")
  .index("by_bot", ["botId"]);

const agentThreads = defineEnt({
  taskId: v.optional(v.id("tasks")),
  subject: v.string(),
})
  .edge("task", { field: "taskId" })
  .index("by_task", ["taskId"])
  .edges("agentMessages", { ref: true });

const agentMessages = defineEnt({
  threadId: v.id("agentThreads"),
  senderBotId: v.optional(v.id("bots")),
  content: v.string(),
})
  .edge("agentThread", { field: "threadId" })
  .index("by_thread", ["threadId"]);

const costBudgets = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  limitCents: v.number(),
  spentCents: v.number(),
  periodType: v.string(),
  alertThresholdPercent: v.number(),
  scope: v.string(),
  periodStart: v.number(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const botConfigVersions = defineEnt({
  botId: v.id("bots"),
  version: v.number(),
  configSnapshot: v.string(),
  changedBy: v.optional(v.string()),
  changeReason: v.optional(v.string()),
})
  .edge("bot")
  .index("by_bot", ["botId"]);

const taskSuggestions = defineEnt({
  botId: v.id("bots"),
  botTaskId: v.optional(v.id("botTasks")),
  suggestedTitle: v.string(),
  suggestedDescription: v.string(),
  reasoning: v.string(),
  status: v.string(),
  updatedAt: v.number(),
}).index("by_bot", ["botId"]);

const pipelineTemplates = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  description: v.string(),
  category: v.string(),
  workflowDefinition: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const fanOutGroups = defineEnt({
  taskId: v.id("tasks"),
  expectedCount: v.number(),
  completedCount: v.number(),
  status: v.string(),
})
  .edge("task")
  .index("by_task", ["taskId"]);

const botMetricRollups = defineEnt({
  botId: v.id("bots"),
  period: v.string(),
  periodStart: v.number(),
  avgCpu: v.optional(v.number()),
  avgMemory: v.optional(v.number()),
  avgDisk: v.optional(v.number()),
  taskCount: v.number(),
}).index("by_bot", ["botId"]);

const savedViews = defineEnt({
  userId: v.id("users"),
  name: v.string(),
  entityType: v.string(),
  filters: v.string(),
  isShared: v.boolean(),
  updatedAt: v.number(),
})
  .edge("user")
  .index("by_user", ["userId"]);

const notifications = defineEnt({
  userId: v.id("users"),
  type: v.string(),
  title: v.string(),
  body: v.string(),
  link: v.optional(v.string()),
  readAt: v.optional(v.number()),
})
  .edge("user")
  .index("by_user", ["userId"])
  .index("by_user_unread", ["userId", "readAt"]);

const passwordResetTokens = defineEnt({
  userId: v.id("users"),
  tokenHash: v.string(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
})
  .edge("user")
  .index("by_user", ["userId"]);

const userSessions = defineEnt({
  userId: v.id("users"),
  deviceInfo: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  lastActiveAt: v.number(),
  revokedAt: v.optional(v.number()),
})
  .edge("user")
  .index("by_user", ["userId"]);

const githubLinks = defineEnt({
  taskId: v.id("tasks"),
  repoOwner: v.string(),
  repoName: v.string(),
  issueNumber: v.optional(v.number()),
  prNumber: v.optional(v.number()),
  syncEnabled: v.boolean(),
})
  .edge("task")
  .index("by_task", ["taskId"]);

const connectors = defineEnt({
  workspaceId: v.id("workspaces"),
  type: v.string(),
  name: v.string(),
  config: v.string(),
  status: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const workflowRunSteps = defineEnt({
  workflowRunId: v.id("workflowRuns"),
  stepId: v.string(),
  status: v.string(),
  botTaskId: v.optional(v.string()),
  result: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
})
  .edge("workflowRun")
  .index("by_workflowRun", ["workflowRunId"]);

// ── Round 4: Agentic Economy Hub ──

const agents = defineEnt({
  workspaceId: v.id("workspaces"),
  type: v.string(),
  name: v.string(),
  description: v.string(),
  url: v.optional(v.string()),
  status: v.string(),
  botId: v.optional(v.id("bots")),
  protocolVersion: v.string(),
  capabilities: v.string(),
  securitySchemes: v.string(),
  reputation: v.number(),
  verified: v.boolean(),
  did: v.optional(v.string()),
  agentCardCache: v.optional(v.string()),
  agentCardCachedAt: v.optional(v.number()),
  slug: v.optional(v.string()),
  tagline: v.string(),
  bio: v.string(),
  avatar: v.optional(v.string()),
  agentRole: v.string(),
  visibility: v.string(),
  tags: v.array(v.string()),
  hourlyRate: v.optional(v.number()),
  currency: v.string(),
  timezone: v.optional(v.string()),
  links: v.string(),
  featured: v.boolean(),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .index("by_slug", ["slug"])
  .edges("agentSkills", { ref: true })
  .edges("agentProducts", { ref: true })
  .edges("serviceAgreements", { ref: true });

const agentSkills = defineEnt({
  agentId: v.id("agents"),
  skillId: v.string(),
  name: v.string(),
  description: v.string(),
  inputModes: v.array(v.string()),
  outputModes: v.array(v.string()),
  tags: v.array(v.string()),
  examples: v.array(v.string()),
  priceCents: v.optional(v.number()),
  pricingModel: v.string(),
  updatedAt: v.number(),
})
  .edge("agent")
  .index("by_agent", ["agentId"]);

const serviceAgreements = defineEnt({
  agentId: v.id("agents"),
  skillId: v.optional(v.string()),
  maxResponseMs: v.optional(v.number()),
  maxDurationMs: v.optional(v.number()),
  guaranteedAvailability: v.optional(v.number()),
  priceCents: v.optional(v.number()),
  penaltyPolicy: v.string(),
  updatedAt: v.number(),
})
  .edge("agent")
  .index("by_agent", ["agentId"]);

const x402Prices = defineEnt({
  workspaceId: v.id("workspaces"),
  routePattern: v.string(),
  agentSkillId: v.optional(v.id("agentSkills")),
  amountUsdc: v.string(),
  network: v.string(),
  description: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const x402Transactions = defineEnt({
  workspaceId: v.id("workspaces"),
  payerAddress: v.string(),
  amount: v.string(),
  asset: v.string(),
  network: v.string(),
  txHash: v.optional(v.string()),
  status: v.string(),
  taskId: v.optional(v.id("tasks")),
  verifiedAt: v.optional(v.number()),
  settledAt: v.optional(v.number()),
  refundedAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const paymentMandates = defineEnt({
  workspaceId: v.id("workspaces"),
  type: v.string(),
  payerIdentity: v.string(),
  amount: v.string(),
  currency: v.string(),
  status: v.string(),
  signature: v.string(),
  expiresAt: v.optional(v.number()),
  capturedAt: v.optional(v.number()),
  settledAt: v.optional(v.number()),
  metadata: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const paymentProviders = defineEnt({
  workspaceId: v.id("workspaces"),
  type: v.string(),
  name: v.string(),
  configEncrypted: v.string(),
  isDefault: v.boolean(),
  status: v.string(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const agentProducts = defineEnt({
  agentId: v.id("agents"),
  skillId: v.optional(v.string()),
  name: v.string(),
  description: v.string(),
  priceCents: v.number(),
  currency: v.string(),
  pricingModel: v.string(),
  active: v.boolean(),
  updatedAt: v.number(),
})
  .edge("agent")
  .index("by_agent", ["agentId"]);

const checkoutSessions = defineEnt({
  workspaceId: v.id("workspaces"),
  buyerAgentId: v.optional(v.id("agents")),
  status: v.string(),
  lineItems: v.string(),
  totalCents: v.number(),
  paymentProviderId: v.optional(v.id("paymentProviders")),
  paymentRef: v.optional(v.string()),
  mandateId: v.optional(v.id("paymentMandates")),
  expiresAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

const orders = defineEnt({
  checkoutSessionId: v.id("checkoutSessions"),
  status: v.string(),
  agentTaskId: v.optional(v.string()),
  updatedAt: v.number(),
}).index("by_checkout", ["checkoutSessionId"]);

const paymentDisputes = defineEnt({
  workspaceId: v.id("workspaces"),
  checkoutSessionId: v.optional(v.id("checkoutSessions")),
  x402TransactionId: v.optional(v.id("x402Transactions")),
  reason: v.string(),
  evidence: v.string(),
  status: v.string(),
  resolvedBy: v.optional(v.id("users")),
  resolvedAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

// ── M5 Tables ──

const channels = defineEnt({
  workspaceId: v.id("workspaces"),
  type: v.string(),
  name: v.string(),
  config: v.string(),
  events: v.array(v.string()),
  minSeverity: v.string(),
  active: v.boolean(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .edges("channelDeliveries", { ref: true });

const channelDeliveries = defineEnt({
  channelId: v.id("channels"),
  event: v.string(),
  payload: v.string(),
  status: v.string(),
  attempts: v.number(),
  lastAttemptAt: v.optional(v.number()),
  responseStatus: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
})
  .edge("channel")
  .index("by_channel", ["channelId"]);

const teams = defineEnt({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  slug: v.string(),
  description: v.string(),
  avatar: v.optional(v.string()),
  isDefault: v.boolean(),
  visibility: v.string(),
  updatedAt: v.number(),
})
  .deletion("soft")
  .edge("workspace")
  .index("by_workspace", ["workspaceId"])
  .edges("teamMembers", { ref: true });

const teamMembers = defineEnt({
  teamId: v.id("teams"),
  memberType: v.string(),
  userId: v.optional(v.id("users")),
  botId: v.optional(v.id("bots")),
  role: v.string(),
  joinedAt: v.number(),
  removedAt: v.optional(v.number()),
})
  .edge("team")
  .index("by_team", ["teamId"]);

const teamCollaborations = defineEnt({
  workspaceId: v.id("workspaces"),
  sourceTeamId: v.id("teams"),
  targetTeamId: v.id("teams"),
  scope: v.string(),
  direction: v.string(),
  active: v.boolean(),
  updatedAt: v.number(),
}).index("by_workspace", ["workspaceId"]);

const webhookSubscriptions = defineEnt({
  workspaceId: v.id("workspaces"),
  url: v.string(),
  secret: v.string(),
  events: v.array(v.string()),
  active: v.boolean(),
  lastDeliveredAt: v.optional(v.number()),
  failCount: v.number(),
  updatedAt: v.number(),
})
  .edge("workspace")
  .index("by_workspace", ["workspaceId"]);

// ── Schema Definition ──

const schema = defineEntSchema({
  workspaces,
  users,
  projects,
  missionStatements,
  milestones,
  tasks,
  taskDependencies,
  taskAttachments,
  subtasks,
  taskComments,
  taskTemplates,
  timeEntries,
  taskHandoffs,
  taskMentions,
  bots,
  botTasks,
  pairingTokens,
  auditLogs,
  botLogs,
  botGuidelines,
  botReleaseNotes,
  botGroups,
  botGroupMembers,
  botSecrets,
  botMetrics,
  botCommands,
  approvalGates,
  botTaskCheckpoints,
  escalationRules,
  approvalWorkflows,
  webhooks,
  webhookDeliveries,
  inboundWebhooks,
  emailQueue,
  apiTokens,
  sprints,
  sprintTasks,
  alerts,
  aiUsageLogs,
  automationRules,
  botTaskFeedback,
  projectMembers,
  userAvailability,
  sharedBots,
  botTaskEvents,
  dashboardWidgets,
  botSessions,
  workflows,
  workflowRuns,
  configImports,
  botMemory,
  botSkills,
  agentThreads,
  agentMessages,
  costBudgets,
  botConfigVersions,
  taskSuggestions,
  pipelineTemplates,
  fanOutGroups,
  botMetricRollups,
  savedViews,
  notifications,
  passwordResetTokens,
  userSessions,
  githubLinks,
  connectors,
  workflowRunSteps,
  agents,
  agentSkills,
  serviceAgreements,
  x402Prices,
  x402Transactions,
  paymentMandates,
  paymentProviders,
  agentProducts,
  checkoutSessions,
  orders,
  paymentDisputes,
  channels,
  channelDeliveries,
  teams,
  teamMembers,
  teamCollaborations,
  webhookSubscriptions,
});

export default schema;

export const entDefinitions = getEntDefinitions(schema);
