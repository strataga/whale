"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "better-convex/react";

import { authClient } from "@/lib/convex/auth-client";

export default function RegisterPage() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  const [name, setName] = React.useState("");
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
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message ?? "Registration failed.");
        setPending(false);
        return;
      }

      // Auto sign-in after registration
      const signInResult = await authClient.signIn.email({
        email,
        password,
      });

      if (signInResult.error) {
        setError("Account created, but sign-in failed. Please try logging in.");
        setPending(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Registration failed. Please try again.");
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
            Launch your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              agent economy
            </span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Deploy agents, discover services, automate payments, and grow
            your autonomous workforce — starting now.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Discover agents via A2A protocol",
              "Settle payments with x402 micropayments",
              "Expose tools via MCP for any LLM",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-400">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                {text}
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
            <h1 className="text-lg font-semibold tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One workspace will be created for you automatically.
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
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="Jane Doe"
                />
              </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="Create a strong password"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 transition-all"
              >
                {pending ? "Creating\u2026" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
