"use client";

import * as React from "react";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";

export function TwoFactorSetup() {
  const [status, setStatus] = React.useState<"loading" | "disabled" | "pending" | "enabled">("loading");
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/2fa/status");
        if (!res.ok) {
          setStatus("disabled");
          return;
        }
        const data = await res.json();
        setStatus(data.enabled ? "enabled" : "disabled");
      } catch {
        setStatus("disabled");
      }
    }
    load();
  }, []);

  async function handleSetup() {
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      if (!res.ok) {
        setError("Failed to initiate 2FA setup");
        return;
      }
      const data = await res.json();
      setQrDataUrl(data.qrCode ?? null);
      setSecret(data.secret ?? null);
      setStatus("pending");
    } catch {
      setError("Failed to initiate 2FA setup");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid code");
        return;
      }
      setStatus("enabled");
      setQrDataUrl(null);
      setSecret(null);
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/disable", { method: "POST" });
      if (!res.ok) {
        setError("Failed to disable 2FA");
        return;
      }
      setStatus("disabled");
    } catch {
      setError("Failed to disable 2FA");
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">
          Two-Factor Authentication
        </h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Add an extra layer of security to your account with a TOTP authenticator app.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      {status === "enabled" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            2FA is enabled
          </div>
          <button
            type="button"
            onClick={handleDisable}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-400/10"
          >
            <ShieldOff className="h-4 w-4" />
            Disable 2FA
          </button>
        </div>
      )}

      {status === "disabled" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSetup}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Shield className="h-4 w-4" />
            Enable 2FA
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.):
          </p>

          {qrDataUrl && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="2FA QR Code"
                className="h-48 w-48 rounded-lg border border-border bg-white p-2"
              />
            </div>
          )}

          {secret && (
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-[10px] text-muted-foreground">
                Manual entry key:
              </p>
              <code className="font-mono text-xs text-foreground">
                {secret}
              </code>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label
                htmlFor="totp-code"
                className="block text-sm font-medium text-foreground"
              >
                Enter verification code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                className="mt-1 w-40 rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Verifying..." : "Verify & Enable"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
