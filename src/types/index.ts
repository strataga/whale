import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Minimal Drizzle-compatible db interface for testable server functions.
 * Allows passing either the real `db` singleton or a test double.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = { select: any; insert: any; update: any; delete: any };

export type UserRole = "admin" | "member" | "viewer";
export type ProjectStatus = "draft" | "active" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Workspace = InferSelectModel<
  (typeof import("@/lib/db/schema"))["workspaces"]
>;
export type NewWorkspace = InferInsertModel<
  (typeof import("@/lib/db/schema"))["workspaces"]
>;

export type User = InferSelectModel<(typeof import("@/lib/db/schema"))["users"]>;
export type NewUser = InferInsertModel<
  (typeof import("@/lib/db/schema"))["users"]
>;

export type Project = InferSelectModel<
  (typeof import("@/lib/db/schema"))["projects"]
>;
export type NewProject = InferInsertModel<
  (typeof import("@/lib/db/schema"))["projects"]
>;

export type Milestone = InferSelectModel<
  (typeof import("@/lib/db/schema"))["milestones"]
>;
export type NewMilestone = InferInsertModel<
  (typeof import("@/lib/db/schema"))["milestones"]
>;

export type Task = InferSelectModel<(typeof import("@/lib/db/schema"))["tasks"]>;
export type NewTask = InferInsertModel<
  (typeof import("@/lib/db/schema"))["tasks"]
>;

export type AuditLog = InferSelectModel<
  (typeof import("@/lib/db/schema"))["auditLogs"]
>;
export type NewAuditLog = InferInsertModel<
  (typeof import("@/lib/db/schema"))["auditLogs"]
>;

export type Subtask = InferSelectModel<
  (typeof import("@/lib/db/schema"))["subtasks"]
>;
export type TaskComment = InferSelectModel<
  (typeof import("@/lib/db/schema"))["taskComments"]
>;
export type TaskTemplate = InferSelectModel<
  (typeof import("@/lib/db/schema"))["taskTemplates"]
>;
export type TimeEntry = InferSelectModel<
  (typeof import("@/lib/db/schema"))["timeEntries"]
>;
export type TaskDependency = InferSelectModel<
  (typeof import("@/lib/db/schema"))["taskDependencies"]
>;
export type Bot = InferSelectModel<
  (typeof import("@/lib/db/schema"))["bots"]
>;
export type BotTask = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botTasks"]
>;

export type BotGroup = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botGroups"]
>;
export type BotGroupMember = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botGroupMembers"]
>;
export type BotSecret = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botSecrets"]
>;
export type BotMetric = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botMetrics"]
>;
export type BotCommand = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botCommands"]
>;
export type ApprovalGate = InferSelectModel<
  (typeof import("@/lib/db/schema"))["approvalGates"]
>;
export type BotTaskCheckpoint = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botTaskCheckpoints"]
>;
export type EscalationRule = InferSelectModel<
  (typeof import("@/lib/db/schema"))["escalationRules"]
>;
export type ApprovalWorkflow = InferSelectModel<
  (typeof import("@/lib/db/schema"))["approvalWorkflows"]
>;
export type Webhook = InferSelectModel<
  (typeof import("@/lib/db/schema"))["webhooks"]
>;
export type WebhookDelivery = InferSelectModel<
  (typeof import("@/lib/db/schema"))["webhookDeliveries"]
>;
export type InboundWebhook = InferSelectModel<
  (typeof import("@/lib/db/schema"))["inboundWebhooks"]
>;
export type EmailQueueItem = InferSelectModel<
  (typeof import("@/lib/db/schema"))["emailQueue"]
>;
export type ApiToken = InferSelectModel<
  (typeof import("@/lib/db/schema"))["apiTokens"]
>;
export type Sprint = InferSelectModel<
  (typeof import("@/lib/db/schema"))["sprints"]
>;
export type SprintTask = InferSelectModel<
  (typeof import("@/lib/db/schema"))["sprintTasks"]
>;
export type Alert = InferSelectModel<
  (typeof import("@/lib/db/schema"))["alerts"]
>;
export type AiUsageLogEntry = InferSelectModel<
  (typeof import("@/lib/db/schema"))["aiUsageLog"]
>;
export type AutomationRule = InferSelectModel<
  (typeof import("@/lib/db/schema"))["automationRules"]
>;
export type BotTaskFeedbackEntry = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botTaskFeedback"]
>;
export type ProjectMember = InferSelectModel<
  (typeof import("@/lib/db/schema"))["projectMembers"]
>;
export type UserAvailabilityEntry = InferSelectModel<
  (typeof import("@/lib/db/schema"))["userAvailability"]
>;
export type SharedBot = InferSelectModel<
  (typeof import("@/lib/db/schema"))["sharedBots"]
>;
export type BotTaskEvent = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botTaskEvents"]
>;
export type DashboardWidget = InferSelectModel<
  (typeof import("@/lib/db/schema"))["dashboardWidgets"]
>;
export type BotSession = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botSessions"]
>;
export type Workflow = InferSelectModel<
  (typeof import("@/lib/db/schema"))["workflows"]
>;
export type WorkflowRun = InferSelectModel<
  (typeof import("@/lib/db/schema"))["workflowRuns"]
>;
export type ConfigImport = InferSelectModel<
  (typeof import("@/lib/db/schema"))["configImports"]
>;

// Round 2 types
export type BotMemoryEntry = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botMemory"]
>;
export type BotSkill = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botSkills"]
>;
export type AgentThread = InferSelectModel<
  (typeof import("@/lib/db/schema"))["agentThreads"]
>;
export type AgentMessage = InferSelectModel<
  (typeof import("@/lib/db/schema"))["agentMessages"]
>;
export type CostBudget = InferSelectModel<
  (typeof import("@/lib/db/schema"))["costBudgets"]
>;
export type BotConfigVersion = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botConfigVersions"]
>;
export type TaskSuggestion = InferSelectModel<
  (typeof import("@/lib/db/schema"))["taskSuggestions"]
>;
export type PipelineTemplate = InferSelectModel<
  (typeof import("@/lib/db/schema"))["pipelineTemplates"]
>;
export type FanOutGroup = InferSelectModel<
  (typeof import("@/lib/db/schema"))["fanOutGroups"]
>;
export type BotMetricRollup = InferSelectModel<
  (typeof import("@/lib/db/schema"))["botMetricRollups"]
>;
export type SavedView = InferSelectModel<
  (typeof import("@/lib/db/schema"))["savedViews"]
>;
export type Notification = InferSelectModel<
  (typeof import("@/lib/db/schema"))["notifications"]
>;
export type PasswordResetToken = InferSelectModel<
  (typeof import("@/lib/db/schema"))["passwordResetTokens"]
>;
export type UserSession = InferSelectModel<
  (typeof import("@/lib/db/schema"))["userSessions"]
>;
export type GithubLink = InferSelectModel<
  (typeof import("@/lib/db/schema"))["githubLinks"]
>;
export type Connector = InferSelectModel<
  (typeof import("@/lib/db/schema"))["connectors"]
>;
export type WorkflowRunStep = InferSelectModel<
  (typeof import("@/lib/db/schema"))["workflowRunSteps"]
>;

// M5 types
export type Channel = InferSelectModel<
  (typeof import("@/lib/db/schema"))["channels"]
>;
export type ChannelDelivery = InferSelectModel<
  (typeof import("@/lib/db/schema"))["channelDeliveries"]
>;
export type Team = InferSelectModel<
  (typeof import("@/lib/db/schema"))["teams"]
>;
export type TeamMember = InferSelectModel<
  (typeof import("@/lib/db/schema"))["teamMembers"]
>;
export type TeamCollaboration = InferSelectModel<
  (typeof import("@/lib/db/schema"))["teamCollaborations"]
>;
export type WebhookSubscription = InferSelectModel<
  (typeof import("@/lib/db/schema"))["webhookSubscriptions"]
>;

export type ChannelType = "slack_webhook" | "discord_webhook" | "webhook" | "in_app" | "email";
export type ChannelDeliveryStatus = "pending" | "delivered" | "failed";
export type AgentVisibility = "public" | "unlisted" | "private";
export type AgentRole = "agent" | "specialist" | "reviewer" | "orchestrator";
export type TeamRole = "lead" | "member" | "observer";
export type TeamMemberType = "user" | "bot";
export type CollaborationScope = "tasks" | "bots" | "all";
export type CollaborationDirection = "inbound" | "outbound" | "bidirectional";

export type BotTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type BotEnvironment = "dev" | "staging" | "prod";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ReviewStatus = "approved" | "rejected" | "needs_changes";
export type AlertSeverity = "info" | "warning" | "critical" | "predictive";
export type SprintStatus = "planning" | "active" | "completed";
export type ProjectVisibility = "workspace" | "private";
export type CircuitState = "closed" | "open" | "half-open";
export type MemoryScope = "task" | "project" | "global";
export type SuggestionStatus = "pending" | "approved" | "rejected";
export type BudgetEntityType = "bot" | "project";
export type ConnectorStatus = "active" | "inactive" | "error";

