"use client";

import * as React from "react";
import { Send, Terminal } from "lucide-react";

import { useToast } from "@/components/ui/toast";

interface BotCommand {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  status: string;
  createdAt: number;
  acknowledgedAt: number | null;
}

const COMMAND_TYPES = [
  { value: "restart", label: "Restart" },
  { value: "pause", label: "Pause" },
  { value: "resume", label: "Resume" },
  { value: "update", label: "Update" },
  { value: "custom", label: "Custom" },
];

function formatTimeAgo(ts: number) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommandPanel({ botId }: { botId: string }) {
  const { toast } = useToast();

  const [commands, setCommands] = React.useState<BotCommand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [commandType, setCommandType] = React.useState("restart");
  const [payload, setPayload] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadCommands();
    const interval = setInterval(loadCommands, 5000);
    return () => clearInterval(interval);
  }, [botId]);

  async function loadCommands() {
    try {
      const res = await fetch(`/api/bots/${botId}/commands`);
      if (!res.ok) return;
      const data = await res.json();
      setCommands(data.commands ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let parsedPayload: Record<string, unknown> | null = null;
      if (payload.trim()) {
        try {
          parsedPayload = JSON.parse(payload);
        } catch {
          toast("Invalid JSON payload", "error");
          return;
        }
      }

      const res = await fetch(`/api/bots/${botId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: commandType,
          payload: parsedPayload,
        }),
      });
      if (!res.ok) {
        toast("Failed to send command.", "error");
        return;
      }
      const data = await res.json();
      setCommands((prev) => [data.command, ...prev]);
      setPayload("");
      setShowForm(false);
      toast("Command sent.", "success");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">
            Command Center
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Send className="h-4 w-4" />
          Send Command
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSend}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <h4 className="text-sm font-semibold">Send Command</h4>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Command Type
              </label>
              <select
                value={commandType}
                onChange={(e) => setCommandType(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {COMMAND_TYPES.map((cmd) => (
                  <option key={cmd.value} value={cmd.value}>
                    {cmd.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Payload (JSON, optional)
              </label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder='{"key": "value"}'
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Send"}
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

      {commands.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Terminal className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No commands sent yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {commands.map((cmd) => {
            const isPending = cmd.status === "pending";
            const isAcknowledged = cmd.status === "acknowledged";

            return (
              <div
                key={cmd.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-semibold text-foreground">
                        {cmd.type}
                      </code>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          isPending
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : isAcknowledged
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : "border-zinc-600 bg-zinc-700/50 text-zinc-400"
                        }`}
                      >
                        {cmd.status}
                      </span>
                    </div>

                    {cmd.payload && (
                      <pre className="mt-2 overflow-x-auto rounded border border-border bg-background p-2 text-xs text-muted-foreground">
                        {JSON.stringify(cmd.payload, null, 2)}
                      </pre>
                    )}
                  </div>

                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatTimeAgo(cmd.createdAt)}
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
