"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";

import { useToast } from "@/components/ui/toast";

type ApiError = { error?: string };

type BotLite = {
  id: string;
  name: string;
  status?: string | null;
};

function normalizeBotsResponse(data: unknown): BotLite[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as BotLite[];

  if (typeof data === "object") {
    const maybe = data as { bots?: unknown };
    if (Array.isArray(maybe.bots)) return maybe.bots as BotLite[];
  }

  return [];
}

export function AssignBotDropdown({
  projectId,
  taskId,
  disabled,
}: {
  projectId: string;
  taskId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const uid = React.useId();

  const [open, setOpen] = React.useState(false);
  const [loadingBots, setLoadingBots] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [bots, setBots] = React.useState<BotLite[]>([]);

  async function loadBots() {
    setLoadingBots(true);
    setError(null);

    const res = await fetch("/api/bots", { method: "GET" });
    const data = (await res.json().catch(() => null)) as
      | (ApiError & unknown)
      | null;

    if (!res.ok) {
      const message =
        (data as ApiError | null)?.error ?? "Failed to load bots.";
      setError(message);
      toast(message, "error");
      setLoadingBots(false);
      return;
    }

    const all = normalizeBotsResponse(data);
    const online = all.filter((b) => (b.status ?? "offline") === "online");
    setBots(online);
    setLoadingBots(false);
  }

  React.useEffect(() => {
    if (!open) return;
    void loadBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when dropdown opens
  }, [open]);

  async function assignBot(botId: string) {
    setPending(true);
    setError(null);

    const res = await fetch(
      `/api/projects/${projectId}/tasks/${taskId}/assign-bot`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId }),
      },
    );

    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      const message = data?.error ?? "Failed to assign bot.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    setPending(false);
    setOpen(false);
    toast("Bot assigned to task.", "success");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
        aria-expanded={open}
      >
        <Bot className="h-4 w-4 text-muted-foreground" />
        Assign Bot
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-lg">
          {error ? (
            <div
              className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={`${uid}-bot`} className="text-sm font-medium">
              Choose an online bot
            </label>
            <select
              id={`${uid}-bot`}
              disabled={pending || loadingBots}
              defaultValue=""
              onChange={(e) => {
                const botId = e.target.value;
                if (!botId) return;
                void assignBot(botId);
              }}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              <option value="" disabled>
                {loadingBots ? "Loading…" : "Select a bot"}
              </option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only bots marked as <span className="font-medium">online</span>{" "}
              appear here.
            </p>
          </div>

          {loadingBots ? null : bots.length === 0 ? (
            <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
              No online bots found.
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
