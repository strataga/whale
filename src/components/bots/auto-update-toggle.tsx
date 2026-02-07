"use client";

import * as React from "react";

import { useToast } from "@/components/ui/toast";

type ApiError = { error?: string };

export function AutoUpdateToggle({
  botId,
  initialValue,
}: {
  botId: string;
  initialValue: boolean;
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(initialValue);
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    const nextValue = !enabled;
    setPending(true);

    const res = await fetch(`/api/bots/${botId}/auto-update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoUpdate: nextValue }),
    });

    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      const message = data?.error ?? "Failed to update auto-update setting.";
      toast(message, "error");
      setPending(false);
      return;
    }

    setEnabled(nextValue);
    setPending(false);
    toast(
      nextValue ? "Auto-update enabled." : "Auto-update disabled.",
      "success",
    );
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <span className="text-sm font-medium text-foreground">Auto-update</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
