"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth } from "better-convex/react";

import { authClient } from "@/lib/convex/auth-client";

function LoginForm() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [router, isAuthenticated]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Invalid email or password.");
        setPending(false);
        return;
      }

      router.push(callbackUrl);
    } catch {
      setError("Invalid email or password.");
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-2">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between bg-radial-dark border-r border-border p-10">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-lg">
            🐳
          </div>
          <span className="text-sm font-semibold tracking-wide">Whale</span>
        </div>

        <div className="max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">
            Command your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              agent fleet
            </span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Orchestrate autonomous agents, settle micropayments, and monitor
            your agentic economy — all from one control plane.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "A2A", desc: "Protocol" },
              { label: "x402", desc: "Payments" },
              { label: "MCP", desc: "Tools" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border bg-card/50 p-3 text-center"
              >
                <div className="text-sm font-semibold text-cyan-400">
                  {item.label}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Self-hosted. Secure-by-design. Open protocols.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-lg">
              🐳
            </div>
            <span className="text-sm font-semibold tracking-wide">Whale</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Access your agent control plane.
            </p>

            {error ? (
              <div
                className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="you@company.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 transition-all"
              >
                {pending ? "Signing in\u2026" : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
              New here?{" "}
              <Link
                href="/register"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Create an account
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
