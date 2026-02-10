/**
 * #44 Environment validation on startup.
 * Validates required/optional env vars with clear error messages.
 */

import { z } from "zod";

const envSchema = z.object({
  // Required
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required for session security"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required for data encryption"),

  // Optional with defaults
  DATABASE_URL: z.string().default("./whale.db"),
  NEXTAUTH_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),

  // AI providers (at least one should be set for AI features)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Stripe (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // x402 payments (optional)
  X402_FACILITATOR_URL: z.string().optional(),
  X402_WALLET_PRIVATE_KEY: z.string().optional(),
  X402_WALLET_ADDRESS: z.string().optional(),

  // Node
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[env] Environment validation failed:\n${errors}`);
    // In development, warn but don't crash (missing keys may be intentional)
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Environment validation failed:\n${errors}`);
    }
    // Return partial env with defaults for dev
    _env = envSchema.parse({
      ...process.env,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "dev-secret-change-me",
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "dev-encryption-key-change-me-32ch",
    });
    return _env;
  }

  _env = result.data;
  return _env;
}
