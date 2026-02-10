"use client";

import * as React from "react";
import { Bot } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

export function AssignBotDropdown({
  projectId,
  taskId,
  disabled,
}: {
  projectId: string;
  taskId: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const uid = React.useId();
  const crpc = useCRPC();

  const botsQuery = crpc.bots.list.useQuery({});
  const assignMutation = crpc.botTasks.assign.useMutation();

  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onlineBots = React.useMemo(() => {
    if (!botsQuery.data) return [];
    const staleBefore = Date.now() - 120_000;
    return botsQuery.data.filter(
      (b) => b.lastSeenAt && b.lastSeenAt > staleBefore && b.status !== "offline",
    );
  }, [botsQuery.data]);

  async function assignBot(botId: string) {
    setError(null);
    try {
      await assignMutation.mutateAsync({ botId, taskId });
      setOpen(false);
      toast("Bot assigned to task.", "success");
    } catch (err: any) {
      const message = err?.message ?? "Failed to assign bot.";
      setError(message);
      toast(message, "error");
    }
  }

  const pending = assignMutation.isPending;

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
              disabled={pending || botsQuery.isPending}
              defaultValue=""
              onChange={(e) => {
                const botId = e.target.value;
                if (!botId) return;
                void assignBot(botId);
              }}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              <option value="" disabled>
                {botsQuery.isPending ? "Loading\u2026" : "Select a bot"}
              </option>
              {onlineBots.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only bots marked as <span className="font-medium">online</span>{" "}
              appear here.
            </p>
          </div>

          {!botsQuery.isPending && onlineBots.length === 0 ? (
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
