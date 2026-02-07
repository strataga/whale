"use client";

import * as React from "react";
import { Copy, KeyRound, RefreshCw, X } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ApiError = { error?: string };

function formatCountdown(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PairingTokenModal({ className }: { className?: string }) {
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [token, setToken] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);

  const [now, setNow] = React.useState(() => Date.now());
  const [copied, setCopied] = React.useState(false);

  const whaleUrl =
    typeof window !== "undefined" ? window.location.origin : "<url>";

  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : null;

  React.useEffect(() => {
    if (!open || !expiresAt) return;

    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [open, expiresAt]);

  async function generateToken() {
    setPending(true);
    setError(null);
    setToken(null);
    setExpiresAt(null);
    setCopied(false);

    const res = await fetch("/api/bots/pairing-tokens", { method: "POST" });
    const data = (await res.json().catch(() => null)) as
      | ({ token?: string; expiresAt?: number } & ApiError)
      | null;

    if (!res.ok) {
      const message = data?.error ?? "Failed to generate pairing token.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    const rawToken = data?.token?.trim();
    const exp = Number(data?.expiresAt ?? Date.now() + 15 * 60 * 1000);

    if (!rawToken) {
      const message = "Pairing token response was missing a token.";
      setError(message);
      toast(message, "error");
      setPending(false);
      return;
    }

    setToken(rawToken);
    setExpiresAt(Number.isFinite(exp) ? exp : Date.now() + 15 * 60 * 1000);
    setPending(false);
  }

  React.useEffect(() => {
    if (!open) return;
    void generateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when modal opens
  }, [open]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  const command = token
    ? `openclaw pair --token ${token} --whale ${whaleUrl}`
    : "openclaw pair --token <token> --whale <url>";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <KeyRound className="h-4 w-4" />
        Generate Pairing Token
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Generate pairing token"
            className="fixed left-1/2 top-1/2 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight">
                  Pairing token
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tokens expire in 15 minutes and can be used once.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error ? (
              <div
                className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Token
                    </div>
                    <div className="mt-2 break-all font-mono text-sm text-foreground">
                      {pending ? "Generating…" : token ?? "—"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {remainingMs === null ? (
                        "—"
                      ) : remainingMs > 0 ? (
                        <>
                          Expires in{" "}
                          <span className="font-semibold text-foreground">
                            {formatCountdown(remainingMs)}
                          </span>
                        </>
                      ) : (
                        <span className="text-rose-200">Expired</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => (token ? copyToClipboard(token) : null)}
                      disabled={!token || pending}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                      {copied ? "Copied" : "Copy"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void generateToken()}
                      disabled={pending}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Generate a new token"
                      title="Generate a new token"
                    >
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="text-sm font-semibold tracking-tight">
                  Pair your bot
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run this on your bot:
                  <span className="ml-1 font-mono">
                    openclaw pair --token &lt;token&gt; --whale &lt;url&gt;
                  </span>
                </p>

                <div className="mt-3 flex items-start gap-2">
                  <pre className="w-full overflow-x-auto rounded-xl border border-border bg-card p-3 text-xs text-foreground">
                    <code>{command}</code>
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(command)}
                    disabled={pending}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Copy command"
                    title="Copy command"
                  >
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
