import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(200),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
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
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priority: taskPrioritySchema.optional(),
  milestoneId: z.string().uuid().optional(),
  dueDate: z.number().int().positive().optional(),
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
    artifactLinks: z.array(z.string().url().max(2000)).max(100).optional(),
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
