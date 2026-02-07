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

export const botStatusSchema = z.enum(["online", "offline", "busy", "error"]);

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
