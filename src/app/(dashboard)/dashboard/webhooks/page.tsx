"use client";

import * as React from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { useCRPC } from "@/lib/convex/crpc";

const AVAILABLE_EVENTS = [
  { value: "task.created", label: "Task Created" },
  { value: "task.updated", label: "Task Updated" },
  { value: "task.deleted", label: "Task Deleted" },
  { value: "bot.connected", label: "Bot Connected" },
  { value: "bot.disconnected", label: "Bot Disconnected" },
];

export default function WebhooksPage() {
  const crpc = useCRPC();
  const [showForm, setShowForm] = React.useState(false);
  const [formUrl, setFormUrl] = React.useState("");
  const [formSecret, setFormSecret] = React.useState("");
  const [formEvents, setFormEvents] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);

  const webhooksQuery = crpc.webhooks.list.useQuery();
  const createMutation = crpc.webhooks.create.useMutation();
  const updateMutation = crpc.webhooks.update.useMutation();
  const removeMutation = crpc.webhooks.remove.useMutation();

  const webhooks = (webhooksQuery.data ?? []).map((w) => ({
    id: w._id,
    url: w.url,
    secret: w.secret,
    events: w.events ?? [],
    active: w.active ?? true,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    createdAt: w._creationTime,
  }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        url: formUrl,
        secret: formSecret,
        events: Array.from(formEvents),
      });
      setFormUrl("");
      setFormSecret("");
      setFormEvents(new Set());
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    await updateMutation.mutateAsync({ id, active });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook? This action cannot be undone.")) return;
    await removeMutation.mutateAsync({ id });
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  }

  if (webhooksQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Webhooks</h2>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="h-4 w-4" />
          Add Webhook
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold">Create Webhook</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                URL
              </label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://example.com/webhook"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Secret
              </label>
              <input
                type="text"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="your-secret-key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Events
              </label>
              <div className="mt-2 space-y-2">
                {AVAILABLE_EVENTS.map((evt) => (
                  <label key={evt.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formEvents.has(evt.value)}
                      onChange={() => toggleEvent(evt.value)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">{evt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || formEvents.size === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {webhooks.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">No webhooks</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a webhook to receive real-time notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => {
            const successRate =
              webhook.totalDeliveries > 0
                ? Math.round(
                    (webhook.successfulDeliveries / webhook.totalDeliveries) *
                      100,
                  )
                : 0;

            const maskedUrl =
              webhook.url.length > 23
                ? webhook.url.slice(0, 20) + "..."
                : webhook.url;

            return (
              <div
                key={webhook.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-medium text-foreground">
                        {maskedUrl}
                      </code>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          webhook.active
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : "border-zinc-600 bg-zinc-700/50 text-zinc-400"
                        }`}
                      >
                        {webhook.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {webhook.events.map((evt) => (
                        <span
                          key={evt}
                          className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">
                          {webhook.totalDeliveries}
                        </span>{" "}
                        total deliveries
                      </div>
                      {webhook.totalDeliveries > 0 && (
                        <div>
                          <span className="font-medium text-foreground">
                            {successRate}%
                          </span>{" "}
                          success rate
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhook.active}
                        onChange={(e) =>
                          handleToggleActive(webhook.id, e.target.checked)
                        }
                        className="rounded border-border"
                      />
                      <span className="text-sm text-muted-foreground">
                        Active
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDelete(webhook.id)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Delete webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
