import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

const features = [
  {
    title: "A2A Protocol",
    desc: "Agents discover and negotiate with each other using the Agent-to-Agent protocol.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
        <path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "x402 Payments",
    desc: "Micropayments settle automatically via HTTP 402 — no invoices, no waiting.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "MCP Tools",
    desc: "Expose your agents as Model Context Protocol tools for any LLM to invoke.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Agent Discovery",
    desc: "Find agents by capability. Browse the registry or query the discovery API.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
        <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "AP2 Mandates",
    desc: "HMAC-signed payment authorizations with expiry — agents pay on your behalf.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0 1 12 2.714Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Commerce",
    desc: "List products, run checkout sessions, fulfill orders — all via agent APIs.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const flowSteps = [
  { label: "Discover", protocol: "A2A", color: "text-blue-400" },
  { label: "Negotiate", protocol: "SLA", color: "text-cyan-400" },
  { label: "Execute", protocol: "MCP", color: "text-emerald-400" },
  { label: "Settle", protocol: "x402", color: "text-amber-400" },
];

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground bg-radial-dark">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
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
              Get started
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="pt-20 pb-16">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                Agentic Economy Hub
              </div>

              <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                The control plane for{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  autonomous agents
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                Agents discover each other, negotiate terms, execute tasks, and
                settle payments — all orchestrated from one self-hosted hub.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                >
                  Deploy your hub
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Agent Economy Flow Card */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-xl shadow-black/10 backdrop-blur">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live agent flow
                </div>

                {/* Flow steps */}
                <div className="grid grid-cols-4 gap-2">
                  {flowSteps.map((step, i) => (
                    <div
                      key={step.label}
                      className="animate-fade-in-up rounded-xl border border-border bg-background p-3 text-center"
                      style={{ animationDelay: `${i * 150}ms` }}
                    >
                      <div className={`text-lg font-semibold ${step.color}`}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-foreground">
                        {step.label}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {step.protocol}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flow connector */}
                <div className="relative my-4 h-px w-full bg-border overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400"
                    style={{ animation: "flow-right 3s ease-in-out infinite" }}
                  />
                </div>

                {/* Example transaction */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 grid place-items-center text-[10px] font-bold text-white">
                          A
                        </div>
                        <span className="text-xs font-medium">code-review-bot</span>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        settled
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>Task: Review PR #142</span>
                      <span>SLA: 30m</span>
                      <span className="font-mono text-emerald-400">$0.12</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 grid place-items-center text-[10px] font-bold text-white">
                          B
                        </div>
                        <span className="text-xs font-medium">deploy-agent</span>
                      </div>
                      <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                        negotiating
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>Task: Deploy v2.1</span>
                      <span>SLA: 15m</span>
                      <span className="font-mono text-cyan-400">$0.08</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Self-hosted. Secure-by-design. Open protocols.
              </p>
            </div>
          </div>
        </main>

        {/* Features Grid */}
        <section className="border-t border-border pt-16 pb-10">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Built on open protocols
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Every layer of the agentic economy — discovery, negotiation, execution, and settlement — is protocol-native.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-cyan-500/30 hover:bg-card/80"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 pb-6 text-center text-xs text-muted-foreground">
          <p>Whale — Agentic Economy Hub. Self-hosted, open-protocol, AI-first.</p>
        </footer>
      </div>
    </div>
  );
}
