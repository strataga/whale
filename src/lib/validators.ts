import { z } from "zod";
import { sanitizeHtml } from "@/lib/sanitize";

// #17 Password strength validation
const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// #15 Sanitized text fields
const sanitizedText = (max: number) =>
  z.string().trim().max(max).transform(sanitizeHtml);

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: strongPasswordSchema,
  name: z.string().trim().min(1).max(200).transform(sanitizeHtml),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).transform(sanitizeHtml),
  description: z.string().trim().max(5000).transform(sanitizeHtml).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  })
  .strict();

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).transform(sanitizeHtml),
  description: z.string().trim().max(5000).transform(sanitizeHtml).optional(),
  priority: taskPrioritySchema.optional(),
  milestoneId: z.string().uuid().optional(),
  dueDate: z.number().int().positive().optional(),
  estimatedMinutes: z.number().int().positive().max(2400).optional(),
  templateId: z.string().uuid().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    priority: taskPrioritySchema.optional(),
    milestoneId: z.string().uuid().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: z.number().int().positive().nullable().optional(),
    tags: z.array(z.string().max(100)).max(100).optional(),
    estimatedMinutes: z.number().int().positive().max(2400).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    recurrence: z
      .object({
        interval: z.number().int().positive().max(365),
        unit: z.enum(["day", "week", "month"]),
      })
      .nullable()
      .optional(),
  })
  .strict();

export const createMilestoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dueDate: z.number().int().positive().optional(),
});

export const botStatusSchema = z.enum([
  "offline",
  "idle",
  "working",
  "waiting",
  "error",
  "recovering",
]);

export const botTaskStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const registerBotSchema = z
  .object({
    pairingToken: z
      .string()
      .trim()
      .regex(/^[0-9a-f]+$/i)
      .length(64),
    name: z.string().trim().min(1).max(200),
    host: z.string().trim().min(1).max(500),
    deviceId: z.string().trim().min(1).max(200),
    capabilities: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
    version: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const createPairingTokenSchema = z.object({}).strict();

export const assignBotSchema = z
  .object({
    botId: z.string().uuid(),
  })
  .strict();

export const updateBotTaskSchema = z
  .object({
    status: botTaskStatusSchema.optional(),
    outputSummary: z.string().trim().max(5000).optional(),
    outputData: z.record(z.string(), z.unknown()).optional(),
    artifactLinks: z.array(z.string().url().max(2000)).max(100).optional(),
    queuePosition: z.number().int().min(0).optional(),
  })
  .strict();

export const botHeartbeatSchema = z
  .object({
    status: botStatusSchema,
    statusReason: z.string().trim().max(500).optional(),
    version: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const inviteUserSchema = z
  .object({
    email: z.string().email().max(255),
    name: z.string().trim().min(1).max(200),
    role: z.enum(["admin", "member", "viewer"]),
  })
  .strict();

export const updateUserRoleSchema = z
  .object({
    role: z.enum(["admin", "member", "viewer"]),
  })
  .strict();

// Bot activity logs (whale-tfv)
export const botLogLevelSchema = z.enum(["info", "warn", "error", "debug"]);

export const createBotLogSchema = z
  .object({
    level: botLogLevelSchema.optional().default("info"),
    message: z.string().trim().min(1).max(5000),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
    botTaskId: z.string().uuid().optional(),
  })
  .strict();

// Bot onboarding guidelines (whale-wqk)
export const createBotGuidelineSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(10000),
  })
  .strict();

export const ackOnboardingSchema = z
  .object({
    acknowledged: z.literal(true),
  })
  .strict();

// Bot release notes (whale-fyj)
export const createReleaseNoteSchema = z
  .object({
    version: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    releaseUrl: z.string().url().max(2000).optional(),
  })
  .strict();

// #1 Task Dependencies
export const addDependencySchema = z
  .object({
    dependsOnTaskId: z.string().uuid(),
  })
  .strict();

// #4 Subtasks
export const createSubtaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const updateSubtaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict();

// #5 Time Tracking
export const createTimeEntrySchema = z
  .object({
    minutes: z.number().int().positive().max(1440),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// #6 Task Comments
export const createTaskCommentSchema = z
  .object({
    body: z.string().trim().min(1).max(5000).transform(sanitizeHtml),
  })
  .strict();

// #3 Task Templates
export const createTaskTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    titlePattern: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: taskPrioritySchema.optional(),
    tags: z.array(z.string().max(100)).max(100).optional(),
    subtaskTitles: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  })
  .strict();

export const updateTaskTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    titlePattern: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: taskPrioritySchema.optional(),
    tags: z.array(z.string().max(100)).max(100).optional(),
    subtaskTitles: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  })
  .strict();

// #2 Recurring Tasks
export const recurrenceSchema = z
  .object({
    interval: z.number().int().positive().max(365),
    unit: z.enum(["day", "week", "month"]),
  })
  .strict();

// #9 Estimated Minutes
export const taskEstimateSchema = z
  .object({
    estimatedMinutes: z.number().int().positive().max(2400).nullable(),
  })
  .strict();

// #11 Natural Language Task Creation
export const naturalLanguageTaskSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
  })
  .strict();

// #13 Bot Task Handoffs
export const createHandoffSchema = z
  .object({
    fromBotTaskId: z.string().uuid(),
    toBotTaskId: z.string().uuid(),
    contextPayload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// #14 Structured Bot Output
export const botOutputDataSchema = z
  .object({
    outputData: z.record(z.string(), z.unknown()),
  })
  .strict();

// #23 Export
export const exportQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("json"),
  projectId: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
});

// #28 Search
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
  type: z.enum(["all", "tasks", "projects", "bots", "milestones"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// #29 Theme
export const updateThemeSchema = z
  .object({
    theme: z.enum(["dark", "light", "system"]),
  })
  .strict();

// #17 Bot task queue position
export const updateBotTaskQueueSchema = z
  .object({
    queuePosition: z.number().int().min(0),
  })
  .strict();

// ── Plan items 1-50 validators ──

// #1 Bot Task Cancellation
export const cancelBotTaskSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// #2 Retry config on task assignment
export const botTaskRetryConfigSchema = z
  .object({
    maxRetries: z.number().int().min(0).max(10).optional(),
    timeoutMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .strict();

// #3 Bot Groups
export const createBotGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

export const updateBotGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

export const botGroupMemberSchema = z
  .object({
    botId: z.string().uuid(),
  })
  .strict();

// #4 Bot Permission Scopes
export const updateBotPermissionsSchema = z
  .object({
    allowedProjects: z.array(z.string().uuid()).max(100).nullable().optional(),
    allowedTags: z.array(z.string().max(100)).max(100).nullable().optional(),
  })
  .strict();

// #5 Bot Secrets Vault
export const createBotSecretSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(10000),
  })
  .strict();

// #8 Bot Environment Labels
export const updateBotLabelsSchema = z
  .object({
    environment: z.enum(["dev", "staging", "prod"]).nullable().optional(),
    labels: z.array(z.string().max(100)).max(50).nullable().optional(),
  })
  .strict();

// #9 Concurrent Task Limit
export const updateBotConcurrencySchema = z
  .object({
    maxConcurrentTasks: z.number().int().min(1).max(100),
  })
  .strict();

// #11 Bot Heartbeat with Metrics
export const botHeartbeatWithMetricsSchema = z
  .object({
    status: botStatusSchema,
    statusReason: z.string().trim().max(500).optional(),
    version: z.string().trim().min(1).max(100).optional(),
    metrics: z
      .object({
        cpuPercent: z.number().min(0).max(100).optional(),
        memoryMb: z.number().min(0).optional(),
        diskPercent: z.number().min(0).max(100).optional(),
        custom: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  })
  .strict();

// #12 Bot Commands
export const createBotCommandSchema = z
  .object({
    command: z.string().trim().min(1).max(200),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const ackBotCommandSchema = z
  .object({
    status: z.enum(["acknowledged", "completed", "failed"]),
  })
  .strict();

// #13 Approval Gates
export const createApprovalGateSchema = z
  .object({
    requiredRole: z.enum(["admin", "member", "viewer"]).optional(),
  })
  .strict();

export const reviewApprovalGateSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    reviewNote: z.string().trim().max(2000).optional(),
  })
  .strict();

// #14 Bot Output Review
export const reviewBotTaskSchema = z
  .object({
    reviewStatus: z.enum(["approved", "rejected", "needs_changes"]),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

// #15 Bot Task Checkpoints
export const createCheckpointSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const reviewCheckpointSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

// #16 Escalation Rules
export const createEscalationRuleSchema = z
  .object({
    trigger: z.enum(["bot_failure", "task_overdue", "approval_timeout"]),
    threshold: z.number().int().min(1).max(100).optional(),
    escalateToUserId: z.string().uuid().optional(),
    escalateToRole: z.enum(["admin", "member"]).optional(),
  })
  .strict();

// #17 Approval Workflows
export const createApprovalWorkflowSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    stages: z.array(
      z.object({
        name: z.string().trim().min(1).max(200),
        requiredRole: z.enum(["admin", "member", "viewer"]),
      }),
    ).min(1).max(10),
  })
  .strict();

// #18 Outbound Webhooks
export const createWebhookSchema = z
  .object({
    url: z.string().url().max(2000),
    events: z.array(z.string().max(100)).min(1).max(50),
  })
  .strict();

export const updateWebhookSchema = z
  .object({
    url: z.string().url().max(2000).optional(),
    events: z.array(z.string().max(100)).min(1).max(50).optional(),
    active: z.boolean().optional(),
  })
  .strict();

// #19 Inbound Webhooks
export const createInboundWebhookSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    actionType: z.enum(["create_task", "assign_bot", "update_status"]),
    actionConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// #20 Slack/Discord Notifications
export const updateNotificationChannelsSchema = z
  .object({
    slackWebhookUrl: z.string().url().max(2000).nullable().optional(),
    discordWebhookUrl: z.string().url().max(2000).nullable().optional(),
  })
  .strict();

// #21 Email Digest
export const updateEmailDigestSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "none"]),
  })
  .strict();

// #22 API Tokens
export const createApiTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    scopes: z.array(z.string().max(100)).max(50).optional(),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

// #23 Sprints
export const createSprintSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    startDate: z.number().int().positive(),
    endDate: z.number().int().positive(),
  })
  .strict();

export const updateSprintSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["planning", "active", "completed"]).optional(),
    startDate: z.number().int().positive().optional(),
    endDate: z.number().int().positive().optional(),
  })
  .strict();

export const addSprintTaskSchema = z
  .object({
    taskId: z.string().uuid(),
  })
  .strict();

// #26 Alerts
export const acknowledgeAlertSchema = z
  .object({
    acknowledged: z.literal(true),
  })
  .strict();

// #27 Natural Language Bot Spec
export const generateBotSpecSchema = z
  .object({
    description: z.string().trim().min(1).max(5000),
  })
  .strict();

// #29 Automation Rules
export const createAutomationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    trigger: z.enum(["task.created", "task.updated", "bot_task.failed", "bot_task.completed"]),
    conditions: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
    actions: z.array(z.record(z.string(), z.unknown())).min(1).max(10),
  })
  .strict();

// #30 Bot Task Feedback
export const createBotTaskFeedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    feedback: z.string().trim().max(2000).optional(),
  })
  .strict();

// #32 Project Members
export const addProjectMemberSchema = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "member", "viewer"]).optional(),
  })
  .strict();

// #33 User Presence (update heartbeat)
export const userPresenceSchema = z
  .object({
    active: z.literal(true),
  })
  .strict();

// #34 Team Availability
export const setAvailabilitySchema = z
  .object({
    date: z.number().int().positive(),
    hoursAvailable: z.number().int().min(0).max(24),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// #42 Dashboard Widgets
export const createWidgetSchema = z
  .object({
    widgetType: z.enum(["bot_success_rate", "overdue_tasks", "sprint_velocity", "recent_activity", "bot_fleet_status", "ai_cost"]),
    config: z.record(z.string(), z.unknown()).optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict();

// #45 Security Policies
export const updateSecurityPolicySchema = z
  .object({
    minHeartbeatIntervalMs: z.number().int().positive().optional(),
    maxTokenAgeDays: z.number().int().positive().max(365).optional(),
    requireEncryption: z.boolean().optional(),
    mandatoryApprovals: z.boolean().optional(),
  })
  .strict();

// #47 Data Retention
export const updateRetentionSchema = z
  .object({
    retentionDays: z.number().int().min(7).max(3650),
  })
  .strict();

// #48 Workflows
export const createWorkflowSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    definition: z.record(z.string(), z.unknown()),
  })
  .strict();

export const updateWorkflowSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    definition: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// #50 Config Import
export const configImportSchema = z
  .object({
    config: z.record(z.string(), z.unknown()),
  })
  .strict();

// ── Round 2 Validators ──

// R2 #1 Agent Memory
export const createBotMemorySchema = z
  .object({
    key: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(50000),
    scope: z.enum(["task", "project", "global"]).optional(),
    expiresAt: z.number().int().positive().optional(),
  })
  .strict();

// R2 #2 Agent Skills
export const createBotSkillSchema = z
  .object({
    skillName: z.string().trim().min(1).max(200),
    version: z.string().trim().min(1).max(50).optional(),
    inputSchema: z.record(z.string(), z.unknown()).optional(),
    outputSchema: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateBotSkillSchema = z
  .object({
    version: z.string().trim().min(1).max(50).optional(),
    inputSchema: z.record(z.string(), z.unknown()).optional(),
    outputSchema: z.record(z.string(), z.unknown()).optional(),
    successRate: z.number().int().min(0).max(100).optional(),
  })
  .strict();

// R2 #3 Confidence Scoring (extends updateBotTaskSchema)
export const botTaskConfidenceSchema = z
  .object({
    confidenceScore: z.number().int().min(0).max(100),
    confidenceReason: z.string().trim().max(500).optional(),
  })
  .strict();

// R2 #4 Agent Collaboration Threads
export const createAgentThreadSchema = z
  .object({
    taskId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(200),
  })
  .strict();

export const createAgentMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(10000),
  })
  .strict();

// R2 #6 Cost Budgets
export const createCostBudgetSchema = z
  .object({
    entityType: z.enum(["bot", "project"]),
    entityId: z.string().uuid(),
    monthlyLimitCents: z.number().int().positive(),
    alertThresholdPercent: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const updateCostBudgetSchema = z
  .object({
    monthlyLimitCents: z.number().int().positive().optional(),
    alertThresholdPercent: z.number().int().min(1).max(100).optional(),
    currentSpendCents: z.number().int().min(0).optional(),
  })
  .strict();

// R2 #7 Config Versioning
export const configRollbackSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();

// R2 #8 Task Suggestions
export const createTaskSuggestionSchema = z
  .object({
    suggestedTitle: z.string().trim().min(1).max(200),
    suggestedDescription: z.string().trim().max(5000).optional(),
    reasoning: z.string().trim().max(2000).optional(),
    botTaskId: z.string().uuid().optional(),
  })
  .strict();

export const updateTaskSuggestionSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

// R2 #10 Sandbox Policy
export const updateSandboxPolicySchema = z
  .object({
    maxDurationMinutes: z.number().int().positive().max(1440).optional(),
    allowedEndpoints: z.array(z.string().max(500)).max(50).optional(),
    fileSystemPaths: z.array(z.string().max(500)).max(50).optional(),
    networkAccess: z.boolean().optional(),
  })
  .strict();

// R2 #14 Pipeline Templates
export const createPipelineTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(100).optional(),
    workflowDefinition: z.record(z.string(), z.unknown()),
  })
  .strict();

// R2 #15 Fan-Out
export const fanOutSchema = z
  .object({
    botIds: z.array(z.string().uuid()).min(2).max(50),
    spec: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// R2 #27 Bulk Operations
export const bulkTasksSchema = z
  .object({
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    operation: z.enum(["assign", "status", "sprint", "priority", "delete"]),
    value: z.string().max(500).optional(),
  })
  .strict();

// R2 #28 Saved Views
export const createSavedViewSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    entityType: z.enum(["tasks", "bots"]).optional(),
    filters: z.record(z.string(), z.unknown()),
    isShared: z.boolean().optional(),
  })
  .strict();

export const updateSavedViewSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    isShared: z.boolean().optional(),
  })
  .strict();

// R2 #31 Kanban Reorder
export const reorderTasksSchema = z
  .object({
    items: z.array(
      z.object({
        taskId: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        position: z.number().int().min(0),
      }),
    ).min(1).max(200),
  })
  .strict();

// R2 #33 Task Templates from History
export const createTemplateFromTaskSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .strict();

// R2 #35 2FA
export const verify2faSchema = z
  .object({
    code: z.string().trim().length(6),
  })
  .strict();

// R2 #36 Password Reset
export const forgotPasswordSchema = z
  .object({
    email: z.string().email().max(255),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1).max(500),
    newPassword: strongPasswordSchema,
  })
  .strict();

// R2 #40 Session Management
export const revokeSessionSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

// R2 #41 GitHub Links
export const createGithubLinkSchema = z
  .object({
    taskId: z.string().uuid(),
    repoOwner: z.string().trim().min(1).max(200),
    repoName: z.string().trim().min(1).max(200),
    issueNumber: z.number().int().positive().optional(),
    prNumber: z.number().int().positive().optional(),
  })
  .strict();

// R2 #44 Connectors
export const createConnectorSchema = z
  .object({
    type: z.enum(["github_actions", "jenkins", "aws", "gcp", "datadog", "custom"]),
    name: z.string().trim().min(1).max(200),
    config: z.record(z.string(), z.unknown()),
  })
  .strict();

export const updateConnectorSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

// ── Round 4: Agentic Economy Hub ──

export const createAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(["local", "external", "hybrid"]).optional(),
    description: z.string().trim().max(2000).optional(),
    url: z.string().url().optional(),
    botId: z.string().uuid().optional(),
    did: z.string().max(500).optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
    securitySchemes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    type: z.enum(["local", "external", "hybrid"]).optional(),
    description: z.string().trim().max(2000).optional(),
    url: z.string().url().nullable().optional(),
    status: z.string().max(50).optional(),
    did: z.string().max(500).nullable().optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
    securitySchemes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const discoverAgentSchema = z
  .object({
    url: z.string().url(),
  })
  .strict();

export const createAgentSkillSchema = z
  .object({
    agentId: z.string().uuid(),
    skillId: z.string().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    inputModes: z.array(z.string()).optional(),
    outputModes: z.array(z.string()).optional(),
    tags: z.array(z.string().max(100)).optional(),
    examples: z.array(z.string().max(500)).optional(),
    priceCents: z.number().int().min(0).optional(),
    pricingModel: z.enum(["per_task", "per_minute", "free"]).optional(),
  })
  .strict();

export const createProductSchema = z
  .object({
    agentId: z.string().uuid(),
    skillId: z.string().max(200).optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3).optional(),
    pricingModel: z.enum(["per_task", "per_minute", "free"]).optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    priceCents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    pricingModel: z.enum(["per_task", "per_minute", "free"]).optional(),
    active: z.number().int().min(0).max(1).optional(),
  })
  .strict();

export const createCheckoutSessionSchema = z
  .object({
    lineItems: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    ).min(1),
    buyerAgentId: z.string().uuid().optional(),
    paymentProviderId: z.string().uuid().optional(),
  })
  .strict();

export const createPaymentProviderSchema = z
  .object({
    type: z.enum(["stripe", "x402", "manual"]),
    name: z.string().trim().min(1).max(200),
    config: z.record(z.string(), z.unknown()),
    isDefault: z.number().int().min(0).max(1).optional(),
  })
  .strict();

export const updatePaymentProviderSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    isDefault: z.number().int().min(0).max(1).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const createX402PriceSchema = z
  .object({
    routePattern: z.string().min(1).max(500),
    amountUsdc: z.string().min(1),
    network: z.enum(["base", "solana"]).optional(),
    description: z.string().max(500).optional(),
    agentSkillId: z.string().uuid().optional(),
  })
  .strict();

export const updateX402PriceSchema = z
  .object({
    routePattern: z.string().min(1).max(500).optional(),
    amountUsdc: z.string().min(1).optional(),
    network: z.enum(["base", "solana"]).optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

export const createDisputeSchema = z
  .object({
    checkoutSessionId: z.string().uuid().optional(),
    x402TransactionId: z.string().uuid().optional(),
    reason: z.string().trim().min(1).max(2000),
  })
  .refine(
    (data) => data.checkoutSessionId || data.x402TransactionId,
    "Either checkoutSessionId or x402TransactionId is required",
  );

export const resolveDisputeSchema = z
  .object({
    status: z.enum(["resolved_buyer", "resolved_seller"]),
    evidence: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const a2aJsonRpcSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number()]),
    method: z.enum([
      "a2a.SendMessage",
      "a2a.GetTask",
      "a2a.CancelTask",
      "a2a.ListTasks",
      "a2a.SendStreamingMessage",
    ]),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const createServiceAgreementSchema = z
  .object({
    agentId: z.string().uuid(),
    skillId: z.string().max(200).optional(),
    maxResponseMs: z.number().int().positive().optional(),
    maxDurationMs: z.number().int().positive().optional(),
    guaranteedAvailability: z.number().int().min(0).max(100).optional(),
    priceCents: z.number().int().min(0).optional(),
    penaltyPolicy: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// ── M5 Schemas ──

// Channel schemas
export const channelTypeSchema = z.enum([
  "slack_webhook",
  "discord_webhook",
  "webhook",
  "in_app",
  "email",
]);

export const createChannelSchema = z
  .object({
    type: channelTypeSchema,
    name: sanitizedText(200),
    config: z.record(z.string(), z.unknown()).default({}),
    events: z.array(z.string().max(200)).max(50).default(["*"]),
    minSeverity: z.enum(["info", "warning", "critical"]).default("info"),
    active: z.boolean().default(true),
  })
  .strict();

export const updateChannelSchema = z
  .object({
    name: sanitizedText(200).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    events: z.array(z.string().max(200)).max(50).optional(),
    minSeverity: z.enum(["info", "warning", "critical"]).optional(),
    active: z.boolean().optional(),
  })
  .strict();

// Team schemas
export const createTeamSchema = z
  .object({
    name: sanitizedText(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
    description: z.string().trim().max(2000).optional(),
    visibility: z.enum(["public", "unlisted", "private"]).default("private"),
  })
  .strict();

export const updateTeamSchema = z
  .object({
    name: sanitizedText(200).optional(),
    description: z.string().trim().max(2000).optional(),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
    avatar: z.string().url().max(2000).nullable().optional(),
  })
  .strict();

export const addTeamMemberSchema = z
  .object({
    memberType: z.enum(["user", "bot"]),
    userId: z.string().uuid().optional(),
    botId: z.string().uuid().optional(),
    role: z.enum(["lead", "member", "observer"]).default("member"),
  })
  .strict()
  .refine(
    (data) => (data.memberType === "user" ? !!data.userId : !!data.botId),
    { message: "userId required for user members, botId required for bot members" },
  );

export const updateTeamMemberSchema = z
  .object({
    role: z.enum(["lead", "member", "observer"]),
  })
  .strict();

export const createTeamCollaborationSchema = z
  .object({
    targetTeamId: z.string().uuid(),
    scope: z.enum(["tasks", "bots", "all"]).default("tasks"),
    direction: z.enum(["inbound", "outbound", "bidirectional"]).default("bidirectional"),
  })
  .strict();

export const updateTeamCollaborationSchema = z
  .object({
    scope: z.enum(["tasks", "bots", "all"]).optional(),
    direction: z.enum(["inbound", "outbound", "bidirectional"]).optional(),
    active: z.boolean().optional(),
  })
  .strict();

// Agent profile schemas
export const agentRoleSchema = z.enum(["agent", "specialist", "reviewer", "orchestrator"]);
export const agentVisibilitySchema = z.enum(["public", "unlisted", "private"]);

export const updateAgentProfileSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    tagline: z.string().trim().max(500).optional(),
    bio: z.string().trim().max(5000).optional(),
    avatar: z.string().url().max(2000).nullable().optional(),
    agentRole: agentRoleSchema.optional(),
    visibility: agentVisibilitySchema.optional(),
    tags: z.array(z.string().trim().max(100)).max(20).optional(),
    hourlyRate: z.number().int().min(0).nullable().optional(),
    currency: z.string().trim().max(10).optional(),
    timezone: z.string().trim().max(100).optional(),
    links: z.record(z.string(), z.string().url().max(2000)).optional(),
  })
  .strict();

export const registerAgentSchema = z
  .object({
    url: z.string().url().max(2000),
    name: sanitizedText(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
    tagline: z.string().trim().max(500).optional(),
    tags: z.array(z.string().trim().max(100)).max(20).optional(),
    visibility: agentVisibilitySchema.default("public"),
  })
  .strict();

// Webhook subscription schemas
export const createWebhookSubscriptionSchema = z
  .object({
    url: z.string().url().max(2000),
    events: z.array(z.string().max(200)).min(1).max(50),
  })
  .strict();

// Public task submission
export const submitTaskSchema = z
  .object({
    agentSlug: z.string().trim().min(1).max(100),
    title: sanitizedText(200),
    description: z.string().trim().max(5000).optional(),
    priority: taskPrioritySchema.optional(),
    inputData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// whale.md
export const updateWhaleMdSchema = z
  .object({
    content: z.string().max(50000),
  })
  .strict();
