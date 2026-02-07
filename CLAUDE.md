# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whale is a self-hosted, multi-user, AI-first project planner that integrates with OpenClaw bots. It converts natural-language goals into structured plans (milestones, tasks, daily priorities) and can delegate work to OpenClaw bots running locally or on remote hosts. Whale is the **source of truth** for projects and tasks; bots are execution endpoints.

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
│   ├── (auth)/          # Login + register (unauthenticated routes)
│   ├── (dashboard)/     # All authenticated routes under /dashboard
│   │   └── dashboard/   # Projects, settings, daily plan pages
│   └── api/
│       ├── auth/        # NextAuth handlers + register endpoint
│       ├── projects/    # CRUD: projects, milestones, tasks
│       └── ai/          # generate-plan, daily-plan, replan
├── components/
│   ├── ai/              # Plan review, daily plan display
│   ├── layout/          # Sidebar, header
│   ├── projects/        # Project card, milestone form, replan button
│   └── tasks/           # Task card, add task form
├── lib/
│   ├── db/              # Drizzle schema, connection, migration
│   ├── auth.ts          # NextAuth config (credentials + JWT)
│   ├── ai.ts            # Vercel AI SDK provider setup + Zod output schemas
│   ├── validators.ts    # Zod input validation schemas
│   └── server/          # Auth context helper
└── types/               # Drizzle-inferred types + NextAuth augmentation
```

## Key Patterns

- **Route handlers**: Next.js 15 uses `Promise<{ id: string }>` for `params` — always `await params` before use
- **Auth**: Call `getAuthContext()` from `@/lib/server/auth-context` in API routes; returns `{ userId, workspaceId }` or null
- **AI calls**: Use `generateObject()` from Vercel AI SDK with Zod schemas for structured output. Provider selected by env var (OPENAI_API_KEY or ANTHROPIC_API_KEY)
- **DB**: Synchronous better-sqlite3 queries via Drizzle ORM. All tables use UUID text IDs with `crypto.randomUUID()` defaults
- **First user bootstrap**: First registration auto-creates a workspace and assigns admin role

## Data Model

Workspace → Users (Admin/Member/Viewer) → Projects → Milestones → Tasks. AuditLog tracks mutations. Schema in `src/lib/db/schema.ts`. See `docs/PRD.md` §8 for full spec.

## Repo Conventions

- Docs in `/docs`, PRDs in `/docs/prds`
- Small, focused commits with clear messages
- Typed APIs and explicit Zod schemas
- Security first: no hardcoded secrets, auth on all API routes

## MVP Milestones

- **M1** (DONE): Core planner — auth, project intake, tasks + milestones, daily plan, AI integration
- **M2**: Bot integration — pairing flow, task assignment, result collection
- **M3**: Security hardening — encryption at rest, audit logs
- **M4**: Reporting — daily summaries, activity logs

## Codebase Map

For architecture diagrams, data model ERD, and user flow diagrams, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).
