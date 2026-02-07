import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { getActiveProvider, type AIProvider } from "@/lib/ai";
import { decrypt, encrypt, isEncrypted } from "@/lib/crypto";
import { requireAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

async function updateWorkspace(formData: FormData) {
  "use server";

  const ctx = await requireAuthContext();
  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return; // silently reject — server action can't return errors easily

  const { workspaceId } = ctx;

  const name = String(formData.get("workspaceName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const ipAllowlist = String(formData.get("ipAllowlist") ?? "").trim();

  if (!name) return;
  if (!timezone) return;

  db.update(workspaces)
    .set({
      name,
      timezone,
      ipAllowlist: ipAllowlist ? ipAllowlist : null,
      updatedAt: Date.now(),
    })
    .where(eq(workspaces.id, workspaceId))
    .run();

  revalidatePath("/dashboard/settings");
}

async function updateAIProvider(formData: FormData) {
  "use server";

  const ctx = await requireAuthContext();
  const aiRoleCheck = checkRole(ctx, "admin");
  if (aiRoleCheck) return;

  const { workspaceId } = ctx;

  const provider = String(formData.get("aiProvider") ?? "").trim();
  const apiKey = String(formData.get("aiApiKey") ?? "").trim();

  const validProviders: AIProvider[] = ["openai", "anthropic", "google"];
  if (!validProviders.includes(provider as AIProvider)) return;

  // Only update the key if the user provided a new one (empty = keep existing)
  const updateFields: Record<string, unknown> = { aiProvider: provider, updatedAt: Date.now() };
  if (apiKey) {
    updateFields.aiApiKey = encrypt(apiKey);
  }

  db.update(workspaces)
    .set(updateFields)
    .where(eq(workspaces.id, workspaceId))
    .run();

  revalidatePath("/dashboard/settings");
}

async function updateProfile(formData: FormData) {
  "use server";

  const { userId } = await requireAuthContext();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  db.update(users).set({ name }).where(eq(users.id, userId)).run();

  revalidatePath("/dashboard/settings");
}

export default async function SettingsPage() {
  const ctx = await requireAuthContext();

  const workspace = db
    .select({
      name: workspaces.name,
      timezone: workspaces.timezone,
      aiProvider: workspaces.aiProvider,
      aiApiKey: workspaces.aiApiKey,
      ipAllowlist: workspaces.ipAllowlist,
    })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .get();

  // Never send the full API key to the client — mask it
  const decryptedKey =
    workspace?.aiApiKey && isEncrypted(workspace.aiApiKey) ? decrypt(workspace.aiApiKey) : workspace?.aiApiKey;
  const maskedKey = decryptedKey ? `••••${decryptedKey.slice(-4)}` : "";

  const user = db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .get();

  const active = getActiveProvider(ctx.workspaceId);

  const providerLabels: Record<AIProvider, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google Gemini",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace, AI provider configuration, and your profile.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Workspace</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Name and timezone are used for planning and daily summaries.
          </p>

          <form action={updateWorkspace} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="workspaceName" className="text-sm font-medium">
                Workspace name
              </label>
              <input
                id="workspaceName"
                name="workspaceName"
                defaultValue={workspace?.name ?? ""}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </label>
              <input
                id="timezone"
                name="timezone"
                defaultValue={workspace?.timezone ?? "UTC"}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="America/Los_Angeles"
              />
              <p className="text-xs text-muted-foreground">
                Use an IANA timezone (e.g. <code className="font-mono">America/New_York</code>).
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="ipAllowlist" className="text-sm font-medium">
                IP allowlist (optional)
              </label>
              <textarea
                id="ipAllowlist"
                name="ipAllowlist"
                defaultValue={workspace?.ipAllowlist ?? ""}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="203.0.113.10, 203.0.113.0/24"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated IPs or CIDR ranges. Leave blank to allow any IP.
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Save
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">AI Provider</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your AI provider and enter your API key. Use your own OpenAI, Anthropic, or Google subscription.
          </p>

          {active ? (
            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                Active: <span className="font-medium text-foreground">{providerLabels[active.provider]}</span>
                {active.source === "env" ? (
                  <span className="ml-1 text-muted-foreground">(from environment variable)</span>
                ) : (
                  <span className="ml-1 text-muted-foreground">(workspace config)</span>
                )}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                No AI provider configured. AI features will not work until you add an API key.
              </p>
            </div>
          )}

          <form action={updateAIProvider} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="aiProvider" className="text-sm font-medium">
                Provider
              </label>
              <select
                id="aiProvider"
                name="aiProvider"
                defaultValue={workspace?.aiProvider ?? "openai"}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic (Claude Sonnet)</option>
                <option value="google">Google Gemini (2.5 Flash)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="aiApiKey" className="text-sm font-medium">
                API Key
              </label>
              <input
                id="aiApiKey"
                name="aiApiKey"
                type="password"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder={maskedKey || "sk-... or key-..."}
              />
              <p className="text-xs text-muted-foreground">
                {maskedKey
                  ? `Current key: ${maskedKey}. Leave blank to keep the existing key.`
                  : "No key stored."}{" "}
                You can also set keys via environment variables
                (<code className="font-mono">OPENAI_API_KEY</code>,{" "}
                <code className="font-mono">ANTHROPIC_API_KEY</code>,{" "}
                <code className="font-mono">GOOGLE_API_KEY</code>).
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Save AI settings
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Profile</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name appears in the header and audit logs.
        </p>

        <form action={updateProfile} className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={user?.name ?? ""}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              defaultValue={user?.email ?? ""}
              disabled
              className="w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email updates are disabled for now.
            </p>
          </div>

          <div className="flex items-center justify-end lg:col-span-2">
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Save profile
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
