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
    slackWebhookUrl TEXT,
    discordWebhookUrl TEXT,
    securityPolicy TEXT,
    retentionDays INTEGER,
    onboardingCompletedAt INTEGER,
    slackTeamId TEXT,
    slackBotToken TEXT,
    whaleMdContent TEXT,
    whaleMdUpdatedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    themePreference TEXT NOT NULL DEFAULT 'dark',
    emailDigestFrequency TEXT,
    lastActiveAt INTEGER,
    totpSecret TEXT,
    totpEnabled INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    visibility TEXT NOT NULL DEFAULT 'workspace',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE milestones (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    dueDate INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    approvalWorkflowId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    projectId TEXT REFERENCES projects(id),
    milestoneId TEXT REFERENCES milestones(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigneeId TEXT REFERENCES users(id),
    dueDate INTEGER,
    tags TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    sortOrder INTEGER,
    estimatedMinutes INTEGER,
    recurrence TEXT,
    requiresApproval INTEGER NOT NULL DEFAULT 0,
    sourceAgentId TEXT,
    sourceProtocol TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
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
    allowedProjects TEXT,
    allowedTags TEXT,
    environment TEXT,
    labels TEXT,
    maxConcurrentTasks INTEGER NOT NULL DEFAULT 1,
    sandboxPolicy TEXT,
    previousTokenHash TEXT,
    tokenRotatedAt INTEGER,
    tokenGracePeriodMs INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE botTasks (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id),
    taskId TEXT NOT NULL REFERENCES tasks(id),
    status TEXT NOT NULL DEFAULT 'pending',
    outputSummary TEXT DEFAULT '',
    artifactLinks TEXT NOT NULL DEFAULT '[]',
    queuePosition INTEGER,
    outputSchema TEXT,
    outputData TEXT,
    cancelledAt INTEGER,
    cancelledBy TEXT,
    retryCount INTEGER NOT NULL DEFAULT 0,
    maxRetries INTEGER NOT NULL DEFAULT 0,
    retryAfter INTEGER,
    botGroupId TEXT,
    timeoutMinutes INTEGER,
    confidenceScore INTEGER,
    confidenceReason TEXT,
    fanOutGroupId TEXT,
    preemptedBy TEXT,
    preemptedAt INTEGER,
    reviewStatus TEXT,
    reviewedBy TEXT,
    reviewedAt INTEGER,
    structuredSpec TEXT,
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
    before TEXT,
    after TEXT,
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

  CREATE TABLE taskDependencies (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependsOnTaskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS task_attachments (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    filename TEXT NOT NULL,
    originalName TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL,
    uploadedBy TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE subtasks (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE taskComments (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    authorId TEXT,
    authorType TEXT NOT NULL DEFAULT 'user',
    body TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE taskTemplates (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    titlePattern TEXT,
    description TEXT,
    priority TEXT,
    tags TEXT,
    subtaskTitles TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE timeEntries (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    userId TEXT REFERENCES users(id),
    botId TEXT REFERENCES bots(id),
    minutes INTEGER NOT NULL,
    note TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE taskHandoffs (
    id TEXT PRIMARY KEY,
    fromBotTaskId TEXT NOT NULL REFERENCES botTasks(id),
    toBotTaskId TEXT NOT NULL REFERENCES botTasks(id),
    contextPayload TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE taskMentions (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id),
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botGroups (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    circuitState TEXT NOT NULL DEFAULT 'closed',
    lastTrippedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botGroupMembers (
    id TEXT PRIMARY KEY,
    botGroupId TEXT NOT NULL REFERENCES botGroups(id) ON DELETE CASCADE,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botSecrets (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    encryptedValue TEXT NOT NULL,
    rotateEveryDays INTEGER,
    lastRotatedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botMetrics (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    cpuPercent INTEGER,
    memoryMb INTEGER,
    diskPercent INTEGER,
    customMetrics TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botCommands (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    acknowledgedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE approvalGates (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    requiredRole TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'pending',
    reviewedBy TEXT REFERENCES users(id),
    reviewNote TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botTaskCheckpoints (
    id TEXT PRIMARY KEY,
    botTaskId TEXT NOT NULL REFERENCES botTasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    reviewedBy TEXT REFERENCES users(id),
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE escalationRules (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    trigger TEXT NOT NULL,
    threshold INTEGER NOT NULL DEFAULT 3,
    escalateToUserId TEXT REFERENCES users(id),
    escalateToRole TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE approvalWorkflows (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    stages TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE webhooks (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE webhookDeliveries (
    id TEXT PRIMARY KEY,
    webhookId TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    lastAttemptAt INTEGER,
    responseStatus INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE inboundWebhooks (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    secretToken TEXT NOT NULL,
    actionType TEXT NOT NULL,
    actionConfig TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE emailQueue (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    sentAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE apiTokens (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    userId TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    tokenPrefix TEXT NOT NULL,
    tokenHash TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]',
    expiresAt INTEGER,
    lastUsedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE sprints (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    startDate INTEGER NOT NULL,
    endDate INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE sprintTasks (
    id TEXT PRIMARY KEY,
    sprintId TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    taskId TEXT NOT NULL REFERENCES tasks(id),
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    acknowledgedAt INTEGER,
    acknowledgedBy TEXT REFERENCES users(id),
    notificationsSent INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE aiUsageLog (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    operation TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    inputTokens INTEGER NOT NULL DEFAULT 0,
    outputTokens INTEGER NOT NULL DEFAULT 0,
    estimatedCostCents INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE automationRules (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    conditions TEXT NOT NULL DEFAULT '[]',
    actions TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botTaskFeedback (
    id TEXT PRIMARY KEY,
    botTaskId TEXT NOT NULL REFERENCES botTasks(id) ON DELETE CASCADE,
    reviewerId TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    feedback TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE projectMembers (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE userAvailability (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    date INTEGER NOT NULL,
    hoursAvailable INTEGER NOT NULL DEFAULT 8,
    note TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE sharedBots (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    sourceWorkspaceId TEXT NOT NULL REFERENCES workspaces(id),
    targetWorkspaceId TEXT NOT NULL REFERENCES workspaces(id),
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botTaskEvents (
    id TEXT PRIMARY KEY,
    botTaskId TEXT NOT NULL REFERENCES botTasks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE dashboardWidgets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    widgetType TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botSessions (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    startedAt INTEGER NOT NULL,
    endedAt INTEGER,
    taskCount INTEGER NOT NULL DEFAULT 0,
    errorCount INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    definition TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE workflowRuns (
    id TEXT PRIMARY KEY,
    workflowId TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running',
    result TEXT,
    startedAt INTEGER NOT NULL,
    completedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE configImports (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    summary TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botMemory (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'task',
    expiresAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botSkills (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    skillName TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    inputSchema TEXT NOT NULL DEFAULT '{}',
    outputSchema TEXT NOT NULL DEFAULT '{}',
    successRate INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE agentThreads (
    id TEXT PRIMARY KEY,
    taskId TEXT REFERENCES tasks(id),
    subject TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE agentMessages (
    id TEXT PRIMARY KEY,
    threadId TEXT NOT NULL REFERENCES agentThreads(id) ON DELETE CASCADE,
    senderBotId TEXT REFERENCES bots(id),
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE costBudgets (
    id TEXT PRIMARY KEY,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    monthlyLimitCents INTEGER NOT NULL,
    currentSpendCents INTEGER NOT NULL DEFAULT 0,
    alertThresholdPercent INTEGER NOT NULL DEFAULT 80,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE botConfigVersions (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    configSnapshot TEXT NOT NULL,
    changedBy TEXT,
    changeReason TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE taskSuggestions (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id),
    botTaskId TEXT REFERENCES botTasks(id),
    suggestedTitle TEXT NOT NULL,
    suggestedDescription TEXT NOT NULL DEFAULT '',
    reasoning TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE pipelineTemplates (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    workflowDefinition TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE fanOutGroups (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id),
    expectedCount INTEGER NOT NULL,
    completedCount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE botMetricRollups (
    id TEXT PRIMARY KEY,
    botId TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    periodStart INTEGER NOT NULL,
    avgCpu INTEGER,
    avgMemory INTEGER,
    avgDisk INTEGER,
    taskCount INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE savedViews (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    entityType TEXT NOT NULL DEFAULT 'tasks',
    filters TEXT NOT NULL DEFAULT '{}',
    isShared INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT,
    readAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE passwordResetTokens (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    tokenHash TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    usedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE userSessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id),
    deviceInfo TEXT,
    ipAddress TEXT,
    lastActiveAt INTEGER NOT NULL,
    revokedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE githubLinks (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    repoOwner TEXT NOT NULL,
    repoName TEXT NOT NULL,
    issueNumber INTEGER,
    prNumber INTEGER,
    syncEnabled INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE connectors (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE workflowRunSteps (
    id TEXT PRIMARY KEY,
    workflowRunId TEXT NOT NULL REFERENCES workflowRuns(id) ON DELETE CASCADE,
    stepId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    botTaskId TEXT,
    result TEXT,
    startedAt INTEGER,
    completedAt INTEGER,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL DEFAULT 'local',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    url TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    botId TEXT REFERENCES bots(id),
    protocolVersion TEXT NOT NULL DEFAULT '0.3',
    capabilities TEXT NOT NULL DEFAULT '{}',
    securitySchemes TEXT NOT NULL DEFAULT '{}',
    reputation INTEGER NOT NULL DEFAULT 50,
    verified INTEGER NOT NULL DEFAULT 0,
    did TEXT,
    agentCardCache TEXT,
    agentCardCachedAt INTEGER,
    slug TEXT UNIQUE,
    tagline TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    agentRole TEXT NOT NULL DEFAULT 'agent',
    visibility TEXT NOT NULL DEFAULT 'private',
    tags TEXT NOT NULL DEFAULT '[]',
    hourlyRate INTEGER,
    currency TEXT NOT NULL DEFAULT 'USD',
    timezone TEXT,
    links TEXT NOT NULL DEFAULT '{}',
    featured INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE agentSkills (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skillId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    inputModes TEXT NOT NULL DEFAULT '[]',
    outputModes TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    examples TEXT NOT NULL DEFAULT '[]',
    priceCents INTEGER,
    pricingModel TEXT NOT NULL DEFAULT 'free',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE serviceAgreements (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skillId TEXT,
    maxResponseMs INTEGER,
    maxDurationMs INTEGER,
    guaranteedAvailability INTEGER,
    priceCents INTEGER,
    penaltyPolicy TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE x402Prices (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    routePattern TEXT NOT NULL,
    agentSkillId TEXT REFERENCES agentSkills(id),
    amountUsdc TEXT NOT NULL,
    network TEXT NOT NULL DEFAULT 'base',
    description TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE x402Transactions (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    payerAddress TEXT NOT NULL,
    amount TEXT NOT NULL,
    asset TEXT NOT NULL DEFAULT 'USDC',
    network TEXT NOT NULL DEFAULT 'base',
    txHash TEXT,
    status TEXT NOT NULL DEFAULT 'authorized',
    taskId TEXT REFERENCES tasks(id),
    verifiedAt INTEGER,
    settledAt INTEGER,
    refundedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE paymentMandates (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    payerIdentity TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'authorized',
    signature TEXT NOT NULL,
    expiresAt INTEGER,
    capturedAt INTEGER,
    settledAt INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE paymentProviders (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    configEncrypted TEXT NOT NULL,
    isDefault INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE agentProducts (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skillId TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priceCents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    pricingModel TEXT NOT NULL DEFAULT 'per_task',
    active INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE checkoutSessions (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    buyerAgentId TEXT REFERENCES agents(id),
    status TEXT NOT NULL DEFAULT 'open',
    lineItems TEXT NOT NULL DEFAULT '[]',
    totalCents INTEGER NOT NULL,
    paymentProviderId TEXT REFERENCES paymentProviders(id),
    paymentRef TEXT,
    mandateId TEXT REFERENCES paymentMandates(id),
    expiresAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    checkoutSessionId TEXT NOT NULL REFERENCES checkoutSessions(id),
    status TEXT NOT NULL DEFAULT 'pending_fulfillment',
    agentTaskId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE paymentDisputes (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    checkoutSessionId TEXT REFERENCES checkoutSessions(id),
    x402TransactionId TEXT REFERENCES x402Transactions(id),
    reason TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open',
    resolvedBy TEXT REFERENCES users(id),
    resolvedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE channels (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    events TEXT NOT NULL DEFAULT '["*"]',
    minSeverity TEXT NOT NULL DEFAULT 'info',
    active INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE channelDeliveries (
    id TEXT PRIMARY KEY,
    channelId TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    lastAttemptAt INTEGER,
    responseStatus INTEGER,
    errorMessage TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    isDefault INTEGER NOT NULL DEFAULT 0,
    visibility TEXT NOT NULL DEFAULT 'private',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deletedAt INTEGER
  );

  CREATE TABLE teamMembers (
    id TEXT PRIMARY KEY,
    teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    memberType TEXT NOT NULL DEFAULT 'user',
    userId TEXT REFERENCES users(id),
    botId TEXT REFERENCES bots(id),
    role TEXT NOT NULL DEFAULT 'member',
    joinedAt INTEGER NOT NULL,
    removedAt INTEGER
  );

  CREATE TABLE teamCollaborations (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    sourceTeamId TEXT NOT NULL REFERENCES teams(id),
    targetTeamId TEXT NOT NULL REFERENCES teams(id),
    scope TEXT NOT NULL DEFAULT 'tasks',
    direction TEXT NOT NULL DEFAULT 'bidirectional',
    active INTEGER NOT NULL DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE webhookSubscriptions (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL REFERENCES workspaces(id),
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '["*"]',
    active INTEGER NOT NULL DEFAULT 1,
    lastDeliveredAt INTEGER,
    failCount INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`;

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const ddl = CREATE_TABLES_SQL;
  sqlite.exec(ddl);
  // #19 Indexes matching production
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(projectId, status)",
    "CREATE INDEX IF NOT EXISTS idx_bot_tasks_bot_status ON botTasks(botId, status)",
    "CREATE INDEX IF NOT EXISTS idx_bot_tasks_task ON botTasks(taskId)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(userId, readAt)",
    "CREATE INDEX IF NOT EXISTS idx_bots_workspace_status ON bots(workspaceId, status)",
    "CREATE INDEX IF NOT EXISTS idx_automation_rules_workspace_trigger ON automationRules(workspaceId, trigger)",
  ];
  for (const idx of indexes) sqlite.prepare(idx).run();
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

export function createTestBot(
  db: TestDb,
  workspaceId: string,
  overrides: {
    name?: string;
    host?: string;
    status?: string;
    tokenPrefix?: string;
    tokenHash?: string;
    capabilities?: string;
    environment?: string;
    maxConcurrentTasks?: number;
  } = {},
): {
  id: string;
  workspaceId: string;
  name: string;
} {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Bot";
  const now = Date.now();

  db.insert(schema.bots)
    .values({
      id,
      workspaceId,
      name,
      host: overrides.host ?? "localhost",
      status: overrides.status ?? "idle",
      tokenPrefix: overrides.tokenPrefix ?? "testpfx1",
      tokenHash: overrides.tokenHash ?? "testhash",
      capabilities: overrides.capabilities ?? "[]",
      environment: overrides.environment ?? null,
      maxConcurrentTasks: overrides.maxConcurrentTasks ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, name };
}

export function createTestBotTask(
  db: TestDb,
  botId: string,
  taskId: string,
  overrides: {
    status?: string;
    maxRetries?: number;
    retryCount?: number;
    timeoutMinutes?: number;
    startedAt?: number;
    completedAt?: number;
    botGroupId?: string;
    structuredSpec?: string;
  } = {},
): {
  id: string;
  botId: string;
  taskId: string;
  status: string;
} {
  const id = crypto.randomUUID();
  const status = overrides.status ?? "pending";
  const now = Date.now();

  db.insert(schema.botTasks)
    .values({
      id,
      botId,
      taskId,
      status,
      maxRetries: overrides.maxRetries ?? 0,
      retryCount: overrides.retryCount ?? 0,
      timeoutMinutes: overrides.timeoutMinutes ?? undefined,
      startedAt: overrides.startedAt ?? undefined,
      completedAt: overrides.completedAt ?? undefined,
      botGroupId: overrides.botGroupId ?? undefined,
      structuredSpec: overrides.structuredSpec ?? undefined,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, botId, taskId, status };
}

// #9 Expanded test helpers

export function createTestWorkflow(
  db: TestDb,
  workspaceId: string,
  overrides: {
    name?: string;
    definition?: string;
  } = {},
): { id: string; workspaceId: string; name: string } {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Workflow";
  const now = Date.now();

  db.insert(schema.workflows)
    .values({
      id,
      workspaceId,
      name,
      definition: overrides.definition ?? JSON.stringify({ steps: [] }),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, name };
}

export function createTestAutomationRule(
  db: TestDb,
  workspaceId: string,
  overrides: {
    name?: string;
    trigger?: string;
    conditions?: string;
    actions?: string;
    active?: number;
  } = {},
): { id: string; workspaceId: string; name: string } {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Rule";
  const now = Date.now();

  db.insert(schema.automationRules)
    .values({
      id,
      workspaceId,
      name,
      trigger: overrides.trigger ?? "task.created",
      conditions: overrides.conditions ?? "[]",
      actions: overrides.actions ?? "[]",
      active: overrides.active ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, name };
}

export function createTestEscalationRule(
  db: TestDb,
  workspaceId: string,
  overrides: {
    trigger?: string;
    threshold?: number;
    escalateToUserId?: string;
    escalateToRole?: string;
  } = {},
): { id: string; workspaceId: string; trigger: string } {
  const id = crypto.randomUUID();
  const trigger = overrides.trigger ?? "bot_failure";
  const now = Date.now();

  db.insert(schema.escalationRules)
    .values({
      id,
      workspaceId,
      trigger,
      threshold: overrides.threshold ?? 3,
      escalateToUserId: overrides.escalateToUserId ?? null,
      escalateToRole: overrides.escalateToRole ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, trigger };
}

export function createTestSprint(
  db: TestDb,
  projectId: string,
  overrides: {
    name?: string;
    startDate?: number;
    endDate?: number;
    status?: string;
  } = {},
): { id: string; projectId: string; name: string; status: string } {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Sprint 1";
  const status = overrides.status ?? "planning";
  const now = Date.now();

  db.insert(schema.sprints)
    .values({
      id,
      projectId,
      name,
      startDate: overrides.startDate ?? now,
      endDate: overrides.endDate ?? now + 14 * 24 * 60 * 60 * 1000,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, projectId, name, status };
}

export function createTestWebhook(
  db: TestDb,
  workspaceId: string,
  overrides: {
    url?: string;
    secret?: string;
    events?: string[];
    active?: number;
  } = {},
): { id: string; workspaceId: string; url: string } {
  const id = crypto.randomUUID();
  const url = overrides.url ?? "https://example.com/webhook";
  const now = Date.now();

  db.insert(schema.webhooks)
    .values({
      id,
      workspaceId,
      url,
      secret: overrides.secret ?? "test-secret",
      events: JSON.stringify(overrides.events ?? ["*"]),
      active: overrides.active ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, url };
}

export function createTestNotification(
  db: TestDb,
  userId: string,
  overrides: {
    type?: string;
    title?: string;
    body?: string;
    link?: string;
    readAt?: number | null;
  } = {},
): { id: string; userId: string; title: string } {
  const id = crypto.randomUUID();
  const title = overrides.title ?? "Test Notification";
  const now = Date.now();

  db.insert(schema.notifications)
    .values({
      id,
      userId,
      type: overrides.type ?? "info",
      title,
      body: overrides.body ?? "",
      link: overrides.link ?? null,
      readAt: overrides.readAt ?? null,
      createdAt: now,
    })
    .run();

  return { id, userId, title };
}

export function createTestApiToken(
  db: TestDb,
  workspaceId: string,
  userId: string,
  overrides: {
    name?: string;
    scopes?: string[];
    expiresAt?: number | null;
  } = {},
): { id: string; workspaceId: string; name: string; tokenPrefix: string } {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Token";
  const tokenPrefix = "whk_test";
  const now = Date.now();

  db.insert(schema.apiTokens)
    .values({
      id,
      workspaceId,
      userId,
      name,
      tokenPrefix,
      tokenHash: "testhash",
      scopes: JSON.stringify(overrides.scopes ?? ["read"]),
      expiresAt: overrides.expiresAt ?? null,
      createdAt: now,
    })
    .run();

  return { id, workspaceId, name, tokenPrefix };
}

// ── Round 4 Test Helpers ──

export function createTestAgent(
  db: TestDb,
  workspaceId: string,
  overrides: {
    name?: string;
    type?: string;
    url?: string;
    status?: string;
    botId?: string | null;
    reputation?: number;
    did?: string | null;
    capabilities?: string;
    securitySchemes?: string;
    slug?: string | null;
    tagline?: string;
    bio?: string;
    avatar?: string | null;
    agentRole?: string;
    visibility?: string;
    tags?: string[];
    hourlyRate?: number | null;
    featured?: number;
  } = {},
): { id: string; workspaceId: string; name: string; type: string; slug: string | null } {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Agent";
  const type = overrides.type ?? "local";
  const slug = overrides.slug !== undefined ? overrides.slug : `agent-${id.slice(0, 8)}`;
  const now = Date.now();

  db.insert(schema.agents)
    .values({
      id,
      workspaceId,
      type,
      name,
      url: overrides.url ?? null,
      status: overrides.status ?? "idle",
      botId: overrides.botId ?? null,
      capabilities: overrides.capabilities ?? "{}",
      securitySchemes: overrides.securitySchemes ?? "{}",
      reputation: overrides.reputation ?? 50,
      did: overrides.did ?? null,
      slug,
      tagline: overrides.tagline ?? "",
      bio: overrides.bio ?? "",
      avatar: overrides.avatar ?? null,
      agentRole: overrides.agentRole ?? "agent",
      visibility: overrides.visibility ?? "private",
      tags: JSON.stringify(overrides.tags ?? []),
      hourlyRate: overrides.hourlyRate ?? null,
      featured: overrides.featured ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, name, type, slug };
}

export function createTestAgentSkill(
  db: TestDb,
  agentId: string,
  overrides: {
    skillId?: string;
    name?: string;
    description?: string;
    tags?: string[];
    priceCents?: number | null;
    pricingModel?: string;
  } = {},
): { id: string; agentId: string; skillId: string; name: string } {
  const id = crypto.randomUUID();
  const skillId = overrides.skillId ?? `skill-${id.slice(0, 8)}`;
  const name = overrides.name ?? "Test Skill";
  const now = Date.now();

  db.insert(schema.agentSkills)
    .values({
      id,
      agentId,
      skillId,
      name,
      description: overrides.description ?? "",
      tags: JSON.stringify(overrides.tags ?? []),
      priceCents: overrides.priceCents ?? null,
      pricingModel: overrides.pricingModel ?? "free",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, agentId, skillId, name };
}

export function createTestCheckoutSession(
  db: TestDb,
  workspaceId: string,
  overrides: {
    buyerAgentId?: string | null;
    status?: string;
    totalCents?: number;
    lineItems?: string;
    paymentProviderId?: string | null;
    expiresAt?: number | null;
  } = {},
): { id: string; workspaceId: string; status: string } {
  const id = crypto.randomUUID();
  const status = overrides.status ?? "open";
  const now = Date.now();

  db.insert(schema.checkoutSessions)
    .values({
      id,
      workspaceId,
      buyerAgentId: overrides.buyerAgentId ?? null,
      status,
      lineItems: overrides.lineItems ?? "[]",
      totalCents: overrides.totalCents ?? 1000,
      paymentProviderId: overrides.paymentProviderId ?? null,
      expiresAt: overrides.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, status };
}

// ── M5 Test Helpers ──

export function createTestChannel(
  db: TestDb,
  workspaceId: string,
  overrides: {
    type?: string;
    name?: string;
    config?: Record<string, unknown>;
    events?: string[];
    minSeverity?: string;
    active?: number;
  } = {},
): { id: string; workspaceId: string; type: string; name: string } {
  const id = crypto.randomUUID();
  const type = overrides.type ?? "webhook";
  const name = overrides.name ?? "Test Channel";
  const now = Date.now();

  db.insert(schema.channels)
    .values({
      id,
      workspaceId,
      type,
      name,
      config: JSON.stringify(overrides.config ?? { url: "https://example.com/hook" }),
      events: JSON.stringify(overrides.events ?? ["*"]),
      minSeverity: overrides.minSeverity ?? "info",
      active: overrides.active ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, type, name };
}

export function createTestTeam(
  db: TestDb,
  workspaceId: string,
  overrides: {
    name?: string;
    slug?: string;
    description?: string;
    isDefault?: number;
    visibility?: string;
  } = {},
): { id: string; workspaceId: string; name: string; slug: string } {
  const id = crypto.randomUUID();
  const name = overrides.name ?? "Test Team";
  const slug = overrides.slug ?? `team-${id.slice(0, 8)}`;
  const now = Date.now();

  db.insert(schema.teams)
    .values({
      id,
      workspaceId,
      name,
      slug,
      description: overrides.description ?? "",
      isDefault: overrides.isDefault ?? 0,
      visibility: overrides.visibility ?? "private",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, name, slug };
}

export function createTestTeamMember(
  db: TestDb,
  teamId: string,
  overrides: {
    memberType?: string;
    userId?: string | null;
    botId?: string | null;
    role?: string;
  } = {},
): { id: string; teamId: string; memberType: string } {
  const id = crypto.randomUUID();
  const memberType = overrides.memberType ?? "user";

  db.insert(schema.teamMembers)
    .values({
      id,
      teamId,
      memberType,
      userId: overrides.userId ?? null,
      botId: overrides.botId ?? null,
      role: overrides.role ?? "member",
      joinedAt: Date.now(),
    })
    .run();

  return { id, teamId, memberType };
}

export function createTestPaymentProvider(
  db: TestDb,
  workspaceId: string,
  overrides: {
    type?: string;
    name?: string;
    configEncrypted?: string;
    isDefault?: number;
  } = {},
): { id: string; workspaceId: string; type: string } {
  const id = crypto.randomUUID();
  const type = overrides.type ?? "stripe";
  const now = Date.now();

  db.insert(schema.paymentProviders)
    .values({
      id,
      workspaceId,
      type,
      name: overrides.name ?? "Test Provider",
      configEncrypted: overrides.configEncrypted ?? "encrypted-config",
      isDefault: overrides.isDefault ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, workspaceId, type };
}
