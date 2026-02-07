import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-lg">
              🐳
            </div>
            <span className="text-sm font-semibold tracking-wide">Whale</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Create account
            </Link>
          </div>
        </header>

        <main className="pt-16">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="text-sm font-medium text-muted-foreground">
                Self-hosted planner for humans and bots
              </p>
              <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Turn goals into daily momentum.
              </h1>
              <p className="mt-4 max-w-prose text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                Whale converts natural-language intent into structured projects
                (milestones, tasks, daily focus). It stays the source of truth,
                while OpenClaw bots execute.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Start planning
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Intake
                    </p>
                    <p className="mt-2 text-sm">
                      “Ship an MVP for a SaaS billing dashboard.”
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Milestones
                      </p>
                      <p className="mt-2 text-sm">4</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Tasks
                      </p>
                      <p className="mt-2 text-sm">17</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Daily Plan
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      <li className="text-foreground">3 must-do tasks</li>
                      <li>2 nice-to-do tasks</li>
                      <li>1 finish-this task</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Dark mode by default. Self-hosted. Secure-by-design.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

