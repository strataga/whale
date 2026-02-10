# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whale is a **self-hosted, AI-first agent orchestration hub**. It converts natural-language goals into structured plans, delegates work to autonomous agents (local bots or external A2A peers), and settles payments via x402 micropayments or Stripe. Project planning is one vertical built on top of the agent substrate.

**Scale:** 189 API routes | 85 DB tables | 36+ pages | 577 tests | 105+ Zod schemas

## Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # ESLint
pnpm db:push      # Push Drizzle schema to SQLite (interactive)
pnpm exec tsc --noEmit  # TypeScript check without emit
```

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript, `src/` directory)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Auth**: NextAuth v5 (credentials provider — email/password, JWT sessions)
- **AI**: Vercel AI SDK (`ai` package) — provider-agnostic (OpenAI or Anthropic)
- **UI**: Tailwind CSS v4 + custom components (dark mode default)
- **Validation**: Zod
- **Package Manager**: pnpm

## Architecture

```
src/
├── app/
│   ├── (auth)/           # Login + register (unauthenticated)
│   ├── (dashboard)/      # All authenticated routes under /dashboard
│   ├── api/              # 189 route handlers (projects, bots, agents, ai, commerce, cron, ...)
│   └── .well-known/      # A2A Agent Card endpoint
├── components/           # 54+ React components (layout, tasks, bots, commerce, ui)
├── lib/
│   ├── db/schema.ts      # 85 tables (2142 lines) — Drizzle ORM
│   ├── server/           # 35+ server modules (auth, engines, agents, payments, infra)
│   ├── validators.ts     # ~105 Zod schemas
│   └── auth.ts, ai.ts, crypto.ts, rate-limit.ts, ...
└── types/                # A2A, AP2, Drizzle-inferred types
```

## Key Patterns

- **Route handlers**: Next.js 15 uses `Promise<{ id: string }>` for `params` — always `await params` before use
- **Auth**: Call `getAuthContext()` from `@/lib/server/auth-context` in API routes; returns `{ userId, workspaceId }` or null
- **AI calls**: Use `generateObject()` from Vercel AI SDK with Zod schemas for structured output. Provider selected by env var (OPENAI_API_KEY or ANTHROPIC_API_KEY)
- **DB**: Synchronous better-sqlite3 queries via Drizzle ORM. All tables use UUID text IDs with `crypto.randomUUID()` defaults
- **First user bootstrap**: First registration auto-creates a workspace and assigns admin role

## Data Model

Core: Workspace → Users → Projects → Milestones → Tasks → BotTasks.
Agent layer: Agents (wraps bots + external peers) → AgentSkills → AgentProducts.
Commerce: CheckoutSessions → Orders → PaymentProviders. x402Transactions, PaymentMandates (AP2).
Schema in `src/lib/db/schema.ts` (85 tables). Full map in `docs/CODEBASE_MAP.md`.

## Repo Conventions

- Docs in `/docs`, PRDs in `/docs/prds`
- Small, focused commits with clear messages
- Typed APIs and explicit Zod schemas
- Security first: no hardcoded secrets, auth on all API routes

## Milestones

- **M1-M4** (DONE): Core planner, bot integration, security hardening, reporting
- **Round 1** (DONE): 50 items — advanced bot management, AI intelligence, observability
- **Round 2** (DONE): 50 items — workflow/rule/escalation engines, team productivity, 2FA, integrations
- **Round 3** (DONE): 50 items — advanced bot orchestration, fleet management, pipeline templates
- **Round 4** (DONE): 48 items — Agentic Economy Hub (A2A, x402, AP2, ACP, MCP, agent registry, commerce)

## Codebase Map

For full architecture diagrams, 85-table ERD, server module guide, API surface (189 routes), UI navigation map, protocol stack, gotchas, and conventions, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).
