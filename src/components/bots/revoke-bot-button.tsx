"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

export function RevokeBotButton({ botId }: { botId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const crpc = useCRPC();

  const removeMutation = crpc.bots.remove.useMutation();
  const pending = removeMutation.isPending;

  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  async function revoke() {
    setError(null);

    try {
      await removeMutation.mutateAsync({ id: botId });
      toast("Bot revoked.", "success");
      router.push("/dashboard/bots");
    } catch (err: any) {
      const message = err?.message ?? "Failed to revoke bot.";
      setError(message);
      toast(message, "error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 text-sm font-semibold text-rose-200 hover:bg-rose-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Ban className="h-4 w-4" />
        {pending ? "Revoking..." : "Revoke Bot"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void revoke();
        }}
        title="Revoke this bot?"
        description="It will be signed out and marked offline. You'll need to re-pair it to use it again."
        confirmLabel="Revoke bot"
        variant="danger"
      />

      {error ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
