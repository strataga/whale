import "server-only";

import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

import { decrypt, encrypt, encryptionEnabled, isEncrypted } from "@/lib/crypto";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type AIProvider = "openai" | "anthropic" | "google";

const PROVIDER_MODELS: Record<AIProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5-20250929",
  google: "gemini-2.5-flash",
};

function maybeEncryptWorkspaceKey(workspaceId: string, aiApiKey: string | null | undefined): string | null {
  if (!aiApiKey) return null;
  if (isEncrypted(aiApiKey) || !encryptionEnabled()) return aiApiKey;

  const encrypted = encrypt(aiApiKey);
  db.update(workspaces)
    .set({ aiApiKey: encrypted, updatedAt: Date.now() })
    .where(eq(workspaces.id, workspaceId))
    .run();

  return encrypted;
}

/**
 * Resolves the AI model to use. Priority:
 * 1. Workspace DB config (provider + key stored via settings page)
 * 2. Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY)
 */
export function getModel(workspaceId?: string): LanguageModel {
  // Try workspace-level config first
  if (workspaceId) {
    const ws = db
      .select({ aiProvider: workspaces.aiProvider, aiApiKey: workspaces.aiApiKey })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .get();

    if (ws?.aiProvider && ws?.aiApiKey) {
      const storedKey = maybeEncryptWorkspaceKey(workspaceId, ws.aiApiKey);
      const apiKey = storedKey && isEncrypted(storedKey) ? decrypt(storedKey) : storedKey;
      if (apiKey) {
        return createModelForProvider(ws.aiProvider as AIProvider, apiKey);
      }
    }
  }

  // Fall back to env vars
  if (process.env.OPENAI_API_KEY) {
    return createModelForProvider("openai", process.env.OPENAI_API_KEY);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createModelForProvider("anthropic", process.env.ANTHROPIC_API_KEY);
  }
  if (process.env.GOOGLE_API_KEY) {
    return createModelForProvider("google", process.env.GOOGLE_API_KEY);
  }

  throw new Error(
    "No AI provider configured. Set an API key in Settings or via environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY).",
  );
}

function createModelForProvider(provider: AIProvider, apiKey: string): LanguageModel {
  const modelId = PROVIDER_MODELS[provider];

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Returns which provider is currently active for a workspace, for display purposes.
 */
export function getActiveProvider(workspaceId?: string): { provider: AIProvider; source: "workspace" | "env" } | null {
  if (workspaceId) {
    const ws = db
      .select({ aiProvider: workspaces.aiProvider, aiApiKey: workspaces.aiApiKey })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .get();

    if (ws?.aiProvider) {
      const storedKey = maybeEncryptWorkspaceKey(workspaceId, ws.aiApiKey ?? null);
      const apiKey = storedKey && isEncrypted(storedKey) ? decrypt(storedKey) : storedKey;
      if (apiKey) return { provider: ws.aiProvider as AIProvider, source: "workspace" };
    }
  }

  if (process.env.OPENAI_API_KEY) return { provider: "openai", source: "env" };
  if (process.env.ANTHROPIC_API_KEY) return { provider: "anthropic", source: "env" };
  if (process.env.GOOGLE_API_KEY) return { provider: "google", source: "env" };

  return null;
}

export const generatePlanSchema = z.object({
  scope: z.string(),
  milestones: z.array(
    z.object({
      name: z.string(),
      tasks: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          priority: z.enum(["low", "medium", "high", "urgent"]),
          estimatedDays: z.number().optional(),
        }),
      ),
    }),
  ),
  risks: z.array(z.string()),
  successCriteria: z.array(z.string()),
});

export const dailyPlanSchema = z.object({
  mustDo: z.array(z.object({ taskId: z.string(), reasoning: z.string() })).max(3),
  niceToDo: z.array(z.object({ taskId: z.string(), reasoning: z.string() })).max(2),
  finishThis: z.array(z.object({ taskId: z.string(), reasoning: z.string() })).max(1),
  overallReasoning: z.string(),
});

export const replanSchema = z.object({
  updates: z.array(
    z.object({
      taskId: z.string(),
      changes: z.object({
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
    }),
  ),
  newTasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      milestoneId: z.string().optional(),
    }),
  ),
  removals: z.array(z.string()),
  reasoning: z.string(),
});
