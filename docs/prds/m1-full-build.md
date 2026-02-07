# M1 Full Build — Whale Core Planner

## Problem
Whale has a complete PRD but zero application code. We need to build the entire MVP: project intake, task management, daily planning, and AI-powered plan generation.

## Tech Stack
- **Framework**: Next.js 15 (App Router, TypeScript, `src/` directory)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Auth**: NextAuth.js v5 (credentials provider — email/password)
- **AI**: Vercel AI SDK (`ai` package) — provider-agnostic (user configures OpenAI, Anthropic, etc.)
- **UI**: Tailwind CSS v4 + shadcn/ui components
- **Package Manager**: pnpm
- **Validation**: Zod

## Data Model (Drizzle Schema)

All tables in a single `src/lib/db/schema.ts`:

```typescript
// Workspace
workspaces: id (text, uuid), name (text), timezone (text), createdAt, updatedAt

// User
users: id (text, uuid), workspaceId (fk), email (text, unique), passwordHash (text), name (text), role (text: 'admin'|'member'|'viewer'), createdAt, updatedAt

// Project
projects: id (text, uuid), workspaceId (fk), name (text), description (text), status (text: 'draft'|'active'|'completed'|'archived'), createdAt, updatedAt

// Milestone
milestones: id (text, uuid), projectId (fk), name (text), dueDate (integer, unix timestamp), position (integer), createdAt, updatedAt

// Task
tasks: id (text, uuid), projectId (fk), milestoneId (fk, nullable), title (text), description (text), status (text: 'todo'|'in_progress'|'done'), priority (text: 'low'|'medium'|'high'|'urgent'), assigneeId (fk, nullable), dueDate (integer, nullable), tags (text, JSON array), position (integer), createdAt, updatedAt

// AuditLog
auditLogs: id (text, uuid), workspaceId (fk), userId (fk, nullable), action (text), metadata (text, JSON), createdAt
```

Bot/BotTask tables are deferred to M2.

## Directory Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing / redirect to dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard shell (sidebar + header)
│   │   ├── page.tsx            # Dashboard home (workspace overview)
│   │   ├── projects/
│   │   │   ├── page.tsx        # Project list
│   │   │   ├── new/page.tsx    # AI project intake
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Project detail (milestones + tasks)
│   │   │       └── plan/page.tsx  # Daily plan view
│   │   └── settings/
│   │       └── page.tsx        # Workspace + AI provider settings
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── projects/route.ts
│       ├── projects/[id]/route.ts
│       ├── projects/[id]/milestones/route.ts
│       ├── projects/[id]/tasks/route.ts
│       ├── projects/[id]/tasks/[taskId]/route.ts
│       ├── ai/generate-plan/route.ts
│       ├── ai/daily-plan/route.ts
│       └── ai/replan/route.ts
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── projects/
│   │   ├── project-card.tsx
│   │   ├── project-intake-form.tsx
│   │   ├── milestone-list.tsx
│   │   └── task-board.tsx
│   ├── tasks/
│   │   ├── task-card.tsx
│   │   ├── task-form.tsx
│   │   └── task-filters.tsx
│   └── ai/
│       ├── plan-review.tsx     # Review/edit AI-generated plan
│       └── daily-plan.tsx      # Daily plan display
├── lib/
│   ├── db/
│   │   ├── index.ts            # DB connection
│   │   ├── schema.ts           # Drizzle schema
│   │   └── migrate.ts          # Migration runner
│   ├── auth.ts                 # NextAuth config
│   ├── ai.ts                   # Vercel AI SDK setup
│   └── validators.ts           # Zod schemas
└── types/
    └── index.ts                # Shared TypeScript types
```

## Implementation Phases

### Phase 1: Project Skeleton + DB + Auth
- Initialize Next.js 15 with TypeScript, `src/` dir, App Router
- Install deps: drizzle-orm, better-sqlite3, @auth/drizzle-adapter, next-auth, ai, @ai-sdk/openai, @ai-sdk/anthropic, zod, tailwindcss, class-variance-authority, clsx, tailwind-merge, lucide-react
- Set up Drizzle schema + migration
- Set up NextAuth with credentials provider
- Create login + register pages
- Create root layout with Tailwind + shadcn setup
- Seed a default workspace on first register

### Phase 2: Dashboard + Project CRUD
- Dashboard layout (sidebar with navigation, header with user menu)
- Project list page with cards
- Create project page (manual — name, description)
- Project detail page (milestones + task list)
- Full CRUD API routes for projects, milestones, tasks
- Task board with status columns (todo, in_progress, done)
- Task editing (inline or modal)
- Milestone management

### Phase 3: AI Integration
- AI settings page (configure provider + API key, stored in DB or .env)
- AI project intake: natural language form → calls AI → returns structured plan (milestones + tasks)
- Plan review component: user sees generated plan, can edit before accepting
- Daily plan generator: AI picks 3 must-do, 2 nice-to-do, 1 finish-what-you-started from active tasks
- "Replan" button on project detail to regenerate/update plan
- All AI calls use Vercel AI SDK `generateObject` with Zod schemas for structured output

### Phase 4: Polish + Settings
- Workspace settings (name, timezone)
- User profile
- Audit log table (record all mutations)
- Responsive layout
- Loading states, error boundaries
- Empty states with helpful prompts

## API Routes

All routes require auth (NextAuth session). Return JSON.

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/projects | List projects for workspace |
| POST | /api/projects | Create project |
| GET | /api/projects/[id] | Get project with milestones + tasks |
| PATCH | /api/projects/[id] | Update project |
| DELETE | /api/projects/[id] | Delete project |
| POST | /api/projects/[id]/milestones | Create milestone |
| PATCH | /api/projects/[id]/milestones/[mid] | Update milestone |
| DELETE | /api/projects/[id]/milestones/[mid] | Delete milestone |
| POST | /api/projects/[id]/tasks | Create task |
| PATCH | /api/projects/[id]/tasks/[tid] | Update task |
| DELETE | /api/projects/[id]/tasks/[tid] | Delete task |
| POST | /api/ai/generate-plan | AI: natural language → structured plan |
| POST | /api/ai/daily-plan | AI: generate daily focus plan |
| POST | /api/ai/replan | AI: re-evaluate and update project plan |

## AI Prompt Strategy

### Generate Plan (intake)
System prompt: "You are a project planning assistant. Given a user's goal description, generate a structured project plan."
Input: { goal: string, context?: string }
Output (Zod schema): { scope: string, milestones: [{ name, tasks: [{ title, description, priority, estimatedDays }] }], risks: string[], successCriteria: string[] }

### Daily Plan
System prompt: "You are a daily planning assistant. Given a list of active tasks with priorities and due dates, select the optimal daily plan."
Input: { tasks: Task[], today: string }
Output: { mustDo: Task[3], niceToDo: Task[2], finishThis: Task[1], reasoning: string }

### Replan
System prompt: "You are a project replanning assistant. Given current project state, suggest task updates, reprioritizations, and new tasks."
Input: { project: Project, milestones: Milestone[], tasks: Task[] }
Output: { updates: [{ taskId, changes }], newTasks: [{ title, description, priority }], removals: string[], reasoning: string }

## Files to Create
- Every file listed in Directory Structure above
- `drizzle.config.ts` — Drizzle config
- `package.json` — with all deps
- `tsconfig.json` — strict TypeScript
- `.env.example` — template for env vars
- `Dockerfile` + `docker-compose.yml` — for self-hosting

## Success Criteria
- User can register, log in
- User can create a project via AI intake (type a goal → get a plan)
- User can view/edit milestones and tasks
- User can generate a daily plan
- User can replan a project
- All data persists in SQLite
- App runs in Docker
