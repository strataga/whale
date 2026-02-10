"use client";

import { useState } from "react";

import { TwoFactorSetup } from "@/components/settings/two-factor-setup";
import { SessionsList } from "@/components/settings/sessions-list";
import { useCRPC } from "@/lib/convex/crpc";

export default function SettingsPage() {
  const crpc = useCRPC();
  const workspaceQuery = crpc.workspaces.get.useQuery({});
  const userQuery = crpc.users.me.useQuery({});

  const updateWorkspaceMutation = crpc.workspaces.update.useMutation();
  const updateProfileMutation = crpc.users.updateMe.useMutation();

  const [wsName, setWsName] = useState("");
  const [wsTimezone, setWsTimezone] = useState("");
  const [wsIpAllowlist, setWsIpAllowlist] = useState("");
  const [aiProvider, setAiProvider] = useState("openai");
  const [aiApiKey, setAiApiKey] = useState("");
  const [profileName, setProfileName] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form values from queries
  if (!initialized && workspaceQuery.data && userQuery.data) {
    const ws = workspaceQuery.data as any;
    const user = userQuery.data as any;
    setWsName(ws.name ?? "");
    setWsTimezone(ws.timezone ?? "UTC");
    setWsIpAllowlist(ws.ipAllowlist ?? "");
    setAiProvider(ws.aiProvider ?? "openai");
    setProfileName(user.name ?? "");
    setInitialized(true);
  }

  if (workspaceQuery.isPending || userQuery.isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const user = userQuery.data as any;

  const providerLabels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google Gemini",
  };

  async function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    await updateWorkspaceMutation.mutateAsync({
      name: wsName,
      timezone: wsTimezone,
      ipAllowlist: wsIpAllowlist || undefined,
    });
  }

  async function handleSaveAI(e: React.FormEvent) {
    e.preventDefault();
    await updateWorkspaceMutation.mutateAsync({
      aiProvider,
      aiApiKey: aiApiKey || undefined,
    });
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    await updateProfileMutation.mutateAsync({ name: profileName });
  }

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

          <form onSubmit={handleSaveWorkspace} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="workspaceName" className="text-sm font-medium">
                Workspace name
              </label>
              <input
                id="workspaceName"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
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
                value={wsTimezone}
                onChange={(e) => setWsTimezone(e.target.value)}
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
                value={wsIpAllowlist}
                onChange={(e) => setWsIpAllowlist(e.target.value)}
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
                disabled={updateWorkspaceMutation.isPending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
                {updateWorkspaceMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">AI Provider</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your AI provider and enter your API key.
          </p>

          <form onSubmit={handleSaveAI} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="aiProvider" className="text-sm font-medium">
                Provider
              </label>
              <select
                id="aiProvider"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
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
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="sk-... or key-..."
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the existing key. You can also set keys via environment variables.
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={updateWorkspaceMutation.isPending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
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

        <form onSubmit={handleSaveProfile} className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
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
              disabled={updateProfileMutation.isPending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TwoFactorSetup />
        <SessionsList />
      </section>
    </div>
  );
}
