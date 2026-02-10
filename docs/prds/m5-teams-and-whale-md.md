# M5 — Teams & whale.md (Bot Onboarding Endpoint)

## Problem

Whale manages bots and humans within workspaces, but has no concept of **teams** — cross-functional groups that organize people and agents around shared goals. Today:

1. **Bots exist in a flat namespace** within a workspace. There's no way to say "these 3 bots and 2 humans are the Frontend Team."
2. **Bot Groups are operational, not organizational.** `botGroups` pools bots for load balancing and circuit-breaking — it doesn't represent who works together or on what.
3. **Project membership is per-project.** `projectMembers` controls access to a single project, but cross-project collaboration (Team A's bot helping Team B) requires manual task assignment with no structure.
4. **Bot onboarding is manual.** External bots discover Whale via `/.well-known/agent.json` (an A2A protocol card), but there's no human-readable onboarding guide — no equivalent of a `CONTRIBUTING.md` for agents.

**Teams solve the organizational layer.** A team is a named group of humans + bots that can own projects, share task queues, and collaborate across team boundaries. `whale.md` solves the onboarding layer — a public, human-and-bot-readable document that tells any agent how to join and work within the workspace.

---

## Goals

- **Teams as first-class entities**: named groups with mixed human + bot membership, roles, and descriptions
- **Multi-team membership**: a user or bot can belong to multiple teams simultaneously
- **Default team**: every workspace gets a "General" team on bootstrap; new users/bots auto-join it
- **Inter-team collaboration**: teams can link to share task queues, scoped by project or tag
- **whale.md endpoint**: `/.well-known/whale.md` serves a public markdown onboarding guide, with personalized sections for authenticated bots
- **Dashboard UI**: team management pages for creating, editing, and visualizing teams
- **Coexistence with Bot Groups**: teams (organizational) and bot groups (load balancing) remain separate concerns

## Non-Goals (this milestone)

- Cross-workspace teams (teams are scoped to a single workspace)
- Team-level billing or budgets (use workspace-level billing)
- Team chat / messaging (use existing Slack/Discord integrations)
- Replacing `projectMembers` (teams complement project-level access, don't replace it)
- Auto-generated whale.md from AI (admin writes it; we provide the serving infrastructure)

---

## Architecture

```
                        ┌──────────────────────────────────┐
                        │          Workspace               │
                        ├──────────────────────────────────┤
                        │                                  │
                        │  ┌─────────┐    ┌─────────┐     │
                        │  │ Team A  │◄──►│ Team B  │     │
                        │  │ (Front) │    │ (Back)  │     │
                        │  └────┬────┘    └────┬────┘     │
                        │       │              │          │
                        │  ┌────┴────┐    ┌────┴────┐     │
                        │  │Members  │    │Members  │     │
                        │  │─────────│    │─────────│     │
                        │  │ Alice 👤│    │ Bob   👤│     │
                        │  │ UIBot 🤖│    │ APIBot🤖│     │
                        │  │ Bob   👤│    │ DBBot 🤖│     │  ← Bob is on both teams
                        │  └─────────┘    └─────────┘     │
                        │                                  │
                        │  teamCollaborations              │
                        │  ┌───────────────────────┐       │
                        │  │ Team A ↔ Team B       │       │
                        │  │ scope: projectIds,    │       │
                        │  │        taskTags       │       │
                        │  │ bots from A can pick  │       │
                        │  │ up B's scoped tasks   │       │
                        │  └───────────────────────┘       │
                        │                                  │
                        │  /.well-known/whale.md            │
                        │  (public onboarding doc)         │
                        └──────────────────────────────────┘
```

### Teams vs Bot Groups vs Project Members

| Concept | Purpose | Membership | Scope |
|---------|---------|------------|-------|
| **Team** (new) | Organizational grouping | Humans + bots | Workspace-wide, cross-project |
| **Bot Group** (existing) | Load balancing pool | Bots only | Operational routing |
| **Project Members** (existing) | Access control | Humans only | Single project |

A bot can be in Bot Group "GPU Pool" (for task routing) **and** Team "ML Team" (for organizational identity). These are orthogonal.

---

## Data Model

Three new tables added to `src/lib/db/schema.ts`.

### 1. `teams`

```typescript
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),              // URL-safe, unique within workspace
  description: text("description").notNull().default(""),
  avatar: text("avatar"),                     // URL to team avatar/icon
  isDefault: integer("isDefault").notNull().default(0),  // 1 = "General" team
  visibility: text("visibility").notNull().default("workspace"),  // workspace | public
  createdAt: integer("createdAt").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt").notNull().$defaultFn(() => Date.now()),
  deletedAt: integer("deletedAt"),
});

// Indexes
// unique: [workspaceId, slug]    — slug unique within workspace
// index:  [workspaceId]          — list teams for workspace
// index:  [isDefault]            — fast lookup of default team
```

**Notes:**
- `isDefault` is enforced at the application level — exactly one team per workspace has `isDefault = 1`
- `visibility: "public"` makes the team visible in the public agent directory (M5 Public API)
- Follows existing soft-delete pattern (`deletedAt`)
- `slug` generated from `name` on creation, editable by admin

### 2. `teamMembers`

Polymorphic join table — members can be users or bots.

```typescript
export const teamMembers = sqliteTable("teamMembers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamId: text("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  memberType: text("memberType").notNull(),   // "user" | "bot"
  userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
  botId: text("botId").references(() => bots.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),  // "lead" | "member" | "observer"
  joinedAt: integer("joinedAt").notNull().$defaultFn(() => Date.now()),
  removedAt: integer("removedAt"),            // soft removal from team
});

// Indexes
// unique: [teamId, userId]  WHERE memberType = 'user'   — no duplicate user membership
// unique: [teamId, botId]   WHERE memberType = 'bot'    — no duplicate bot membership
// index:  [userId]          — find all teams for a user
// index:  [botId]           — find all teams for a bot
```

**Constraints:**
- Exactly one of `userId` / `botId` must be non-null, matching `memberType`
- Application-level validation: `memberType === "user" ? userId != null : botId != null`
- A member can appear in multiple teams (multi-team membership)

**Roles:**
| Role | Permissions |
|------|-------------|
| `lead` | Manage team membership, edit team settings, manage collaborations |
| `member` | View team, receive tasks from team queue, participate in team projects |
| `observer` | View-only access to team dashboard and metrics (useful for stakeholders) |

### 3. `teamCollaborations`

Links two teams for shared task queue access.

```typescript
export const teamCollaborations = sqliteTable("teamCollaborations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId").notNull().references(() => workspaces.id),
  sourceTeamId: text("sourceTeamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  targetTeamId: text("targetTeamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("{}"),  // JSON: { projectIds?: string[], taskTags?: string[] }
  direction: text("direction").notNull().default("bidirectional"),  // "source_to_target" | "target_to_source" | "bidirectional"
  active: integer("active").notNull().default(1),
  createdAt: integer("createdAt").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt").notNull().$defaultFn(() => Date.now()),
});

// Indexes
// unique: [sourceTeamId, targetTeamId]   — one collaboration link per pair
// index:  [workspaceId]                  — list all collaborations
```

**Scope JSON schema:**
```json
{
  "projectIds": ["proj-abc", "proj-def"],   // Only tasks in these projects
  "taskTags": ["frontend", "urgent"]         // Only tasks with these tags
}
```

An empty scope `{}` means **full access** — the target team's bots can pick up any task from the source team's queue. Scoped collaborations filter by `tasks.projectId` and/or `tasks.tags` (JSON array, already exists on the `tasks` table).

**Direction:**
- `source_to_target`: source team's bots can pick up target team's tasks
- `target_to_source`: target team's bots can pick up source team's tasks
- `bidirectional`: both teams' bots can pick up each other's tasks

### Drizzle Relations

```typescript
export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [teams.workspaceId], references: [workspaces.id] }),
  members: many(teamMembers),
  sourceCollaborations: many(teamCollaborations, { relationName: "sourceTeam" }),
  targetCollaborations: many(teamCollaborations, { relationName: "targetTeam" }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  bot: one(bots, { fields: [teamMembers.botId], references: [bots.id] }),
}));

export const teamCollaborationsRelations = relations(teamCollaborations, ({ one }) => ({
  workspace: one(workspaces, { fields: [teamCollaborations.workspaceId], references: [workspaces.id] }),
  sourceTeam: one(teams, { fields: [teamCollaborations.sourceTeamId], references: [teams.id] }),
  targetTeam: one(teams, { fields: [teamCollaborations.targetTeamId], references: [teams.id] }),
}));
```

---

## whale.md — Bot Onboarding Endpoint

### What is whale.md?

`/.well-known/whale.md` is a markdown document served at a well-known URL that tells bots (and humans) how to work within this Whale workspace. Think of it as `CONTRIBUTING.md` for agents — it describes:

- What the workspace does
- What teams exist and what they work on
- How to register and join a team
- Task conventions (priority levels, tag taxonomy, estimation norms)
- Code and communication standards
- Available tools and integrations

### Public vs Personalized Sections

The endpoint serves different content based on authentication:

**Unauthenticated (public):**
```markdown
# 🐋 Whale Workspace: Acme Corp

## About
We build SaaS products using AI-augmented teams...

## Teams
- **Frontend Team** — UI/UX, React, design systems (3 bots, 2 humans)
- **Backend Team** — APIs, databases, infrastructure (2 bots, 1 human)
- **QA Team** — Testing, monitoring, quality gates (1 bot, 1 human)

## How to Join
1. Register via `POST /api/bots/register` with a pairing token
2. You'll be auto-added to the General team
3. A team lead can add you to specialized teams

## Task Conventions
- Priorities: low, medium, high, urgent
- Tags: use project-specific tags (e.g., "frontend", "api", "docs")
- Estimation: in minutes, max 2400 (40 hours)

## Standards
- Code: TypeScript, ESLint, Prettier
- Commits: Conventional Commits format
- PRs: require at least one approval
```

**Authenticated (bot sends `Authorization: Bearer <token>`):**

Appends personalized sections:
```markdown
---
## Your Status (personalized)
- **Bot ID:** bot-abc-123
- **Teams:** Frontend Team (member), General (member)
- **Current task:** TASK-42 "Implement dark mode toggle"
- **Queue depth:** 3 tasks pending

## Your Team's Active Work
| Task | Assignee | Status | Priority |
|------|----------|--------|----------|
| TASK-42 | You | in_progress | high |
| TASK-43 | UIBot-2 | pending | medium |
| TASK-44 | Unassigned | todo | low |

## Available Tasks (from collaborations)
| Task | Source Team | Tags | Priority |
|------|------------|------|----------|
| TASK-78 | Backend Team | ["api", "urgent"] | urgent |
```

### Storage

The whale.md content is stored as a workspace-level setting, not in a separate table:

```typescript
// Add to workspaces table
whaleMdContent: text("whaleMdContent"),       // Admin-authored markdown content
whaleMdUpdatedAt: integer("whaleMdUpdatedAt"),
```

The admin writes/edits the static content via the dashboard. The personalized sections are dynamically generated at request time by querying the bot's team memberships, current tasks, and collaboration scopes.

### Content-Type Negotiation

| Accept Header | Response |
|---------------|----------|
| `text/markdown` (default) | Raw markdown |
| `application/json` | JSON with `{ content, metadata: { teams, updatedAt } }` |
| `text/html` | Rendered HTML (for browser viewing) |

---

## API Endpoints

### Team CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/teams` | Session (member+) | List all teams in workspace |
| `POST` | `/api/teams` | Session (admin) | Create a new team |
| `GET` | `/api/teams/:id` | Session (member+) | Get team details with members |
| `PATCH` | `/api/teams/:id` | Session (lead+ or admin) | Update team name/description/avatar |
| `DELETE` | `/api/teams/:id` | Session (admin) | Soft-delete team (cannot delete default) |

### Team Membership

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/teams/:id/members` | Session (member+) | List team members (users + bots) |
| `POST` | `/api/teams/:id/members` | Session (lead+ or admin) | Add member (user or bot) |
| `PATCH` | `/api/teams/:id/members/:memberId` | Session (lead+ or admin) | Change member role |
| `DELETE` | `/api/teams/:id/members/:memberId` | Session (lead+ or admin) | Remove member from team |

### Team Collaborations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/teams/:id/collaborations` | Session (member+) | List linked teams |
| `POST` | `/api/teams/:id/collaborations` | Session (lead+ or admin) | Create collaboration link |
| `PATCH` | `/api/teams/:id/collaborations/:collabId` | Session (lead+ or admin) | Update scope/direction |
| `DELETE` | `/api/teams/:id/collaborations/:collabId` | Session (lead+ or admin) | Remove collaboration |

### Bot-Facing Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/bots/me/teams` | Bot token | List teams the bot belongs to |
| `GET` | `/api/bots/me/team-tasks` | Bot token | Get tasks from bot's teams + collaborations |
| `GET` | `/.well-known/whale.md` | Optional (bot token) | Workspace onboarding doc |

### whale.md Management (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/settings/whale-md` | Session (admin) | Get current whale.md content |
| `PUT` | `/api/settings/whale-md` | Session (admin) | Update whale.md content |
| `POST` | `/api/settings/whale-md/preview` | Session (admin) | Preview rendered whale.md |

### Public API (extends M5 Public Agent API)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/public/teams` | None / API token | List public-visibility teams |
| `GET` | `/api/public/teams/:slug` | None / API token | Get public team profile with member summaries |

---

## Endpoint Details

### `POST /api/teams`

**Request:**
```json
{
  "name": "Frontend Team",
  "description": "UI/UX, React, design systems, accessibility",
  "avatar": "https://example.com/frontend-icon.png",
  "visibility": "workspace"
}
```

**Response (201):**
```json
{
  "id": "team-uuid",
  "name": "Frontend Team",
  "slug": "frontend-team",
  "description": "UI/UX, React, design systems, accessibility",
  "avatar": "https://example.com/frontend-icon.png",
  "isDefault": false,
  "visibility": "workspace",
  "createdAt": 1707350400000,
  "memberCount": 0
}
```

**Validation:**
- `name`: 1–100 chars, sanitized HTML
- `slug`: auto-generated from name, can be overridden. Must be `[a-z0-9-]`, 1–50 chars, unique within workspace
- `visibility`: `"workspace"` | `"public"`

### `POST /api/teams/:id/members`

**Request:**
```json
{
  "memberType": "bot",
  "botId": "bot-uuid",
  "role": "member"
}
```

Or for a user:
```json
{
  "memberType": "user",
  "userId": "user-uuid",
  "role": "lead"
}
```

**Response (201):**
```json
{
  "id": "membership-uuid",
  "teamId": "team-uuid",
  "memberType": "bot",
  "botId": "bot-uuid",
  "role": "member",
  "joinedAt": 1707350400000,
  "member": {
    "name": "CodeBot",
    "status": "idle",
    "capabilities": ["task_execution", "code_generation"]
  }
}
```

**Validation:**
- Exactly one of `userId` / `botId` required, must match `memberType`
- Referenced user/bot must exist in the same workspace
- No duplicate memberships (409 Conflict if already a member)

### `POST /api/teams/:id/collaborations`

**Request:**
```json
{
  "targetTeamId": "other-team-uuid",
  "scope": {
    "projectIds": ["proj-abc"],
    "taskTags": ["api"]
  },
  "direction": "bidirectional"
}
```

**Response (201):**
```json
{
  "id": "collab-uuid",
  "sourceTeamId": "team-uuid",
  "targetTeamId": "other-team-uuid",
  "sourceTeamName": "Frontend Team",
  "targetTeamName": "Backend Team",
  "scope": { "projectIds": ["proj-abc"], "taskTags": ["api"] },
  "direction": "bidirectional",
  "active": true,
  "createdAt": 1707350400000
}
```

**Validation:**
- `targetTeamId` must be in the same workspace
- Cannot collaborate with self (400)
- Duplicate pair returns 409 Conflict
- Both team leads (or workspace admin) must exist for the link to be created

### `GET /api/bots/me/team-tasks`

Returns tasks available to the bot based on its team memberships and active collaborations.

**Query params:**
- `status` — filter: `todo` | `pending` | `in_progress` (default: `todo`)
- `priority` — filter: `low` | `medium` | `high` | `urgent`
- `limit` — max 50 (default: 20)

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Implement dark mode toggle",
      "projectId": "proj-abc",
      "priority": "high",
      "tags": ["frontend", "ui"],
      "estimatedMinutes": 120,
      "source": "direct",
      "teamId": "frontend-team-uuid",
      "teamName": "Frontend Team"
    },
    {
      "id": "task-uuid-2",
      "title": "Fix API response caching",
      "projectId": "proj-abc",
      "priority": "urgent",
      "tags": ["api", "performance"],
      "estimatedMinutes": 60,
      "source": "collaboration",
      "teamId": "backend-team-uuid",
      "teamName": "Backend Team",
      "collaborationId": "collab-uuid"
    }
  ],
  "total": 2
}
```

**Task sourcing logic:**
1. Get all teams the bot belongs to
2. Get all active collaborations for those teams
3. For direct team tasks: return unassigned tasks from projects the team works on
4. For collaboration tasks: filter by `scope.projectIds` and `scope.taskTags`
5. Deduplicate (a task visible through multiple paths appears once)
6. Sort by priority desc, then creation date asc

### `GET /.well-known/whale.md`

**No auth → public content only:**
```http
GET /.well-known/whale.md
Accept: text/markdown

200 OK
Content-Type: text/markdown

# 🐋 Acme Corp Workspace
...
```

**With bot auth → public + personalized:**
```http
GET /.well-known/whale.md
Authorization: Bearer whale_abc123...
Accept: text/markdown

200 OK
Content-Type: text/markdown

# 🐋 Acme Corp Workspace
...
---
## Your Status (personalized)
...
```

**JSON format:**
```http
GET /.well-known/whale.md
Accept: application/json

200 OK
Content-Type: application/json

{
  "content": "# 🐋 Acme Corp Workspace\n...",
  "metadata": {
    "workspaceName": "Acme Corp",
    "teams": [
      { "name": "Frontend Team", "slug": "frontend-team", "memberCount": 5 }
    ],
    "updatedAt": 1707350400000,
    "protocolVersion": "0.3"
  }
}
```

---

## Zod Validators

```typescript
// src/lib/validators.ts — additions

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(100).transform(sanitizeHtml),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50).optional(),
  description: z.string().trim().max(1000).transform(sanitizeHtml).optional(),
  avatar: z.string().url().max(500).optional(),
  visibility: z.enum(["workspace", "public"]).optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

export const addTeamMemberSchema = z.object({
  memberType: z.enum(["user", "bot"]),
  userId: z.string().uuid().optional(),
  botId: z.string().uuid().optional(),
  role: z.enum(["lead", "member", "observer"]).optional(),
}).refine(
  (data) => (data.memberType === "user" ? !!data.userId : !!data.botId),
  { message: "userId required for users, botId required for bots" }
);

export const updateTeamMemberSchema = z.object({
  role: z.enum(["lead", "member", "observer"]),
});

export const createCollaborationSchema = z.object({
  targetTeamId: z.string().uuid(),
  scope: z.object({
    projectIds: z.array(z.string().uuid()).optional(),
    taskTags: z.array(z.string().max(50)).optional(),
  }).optional(),
  direction: z.enum(["source_to_target", "target_to_source", "bidirectional"]).optional(),
});

export const updateWhaleMdSchema = z.object({
  content: z.string().max(50_000),
});
```

---

## Migration Path

### Backfill Strategy

When this feature deploys, existing workspaces need a default team with all current users and bots enrolled.

**Migration script (`scripts/migrate-teams.ts`):**

```
For each workspace:
  1. Create "General" team with isDefault = 1
  2. For each user in workspace:
     - Insert teamMembers row (memberType: "user", role: user.role === "admin" ? "lead" : "member")
  3. For each bot in workspace:
     - Insert teamMembers row (memberType: "bot", role: "member")
  4. Set workspace.whaleMdContent to a default template
```

**Idempotency:** Skip workspaces that already have a team with `isDefault = 1`.

### Bot Registration Hook

Update `POST /api/bots/register` to auto-add newly registered bots to the workspace's default team:

```typescript
// In bots/register/route.ts — after successful registration
const defaultTeam = db.select().from(teams)
  .where(and(eq(teams.workspaceId, ctx.workspaceId), eq(teams.isDefault, 1)))
  .get();

if (defaultTeam) {
  db.insert(teamMembers).values({
    teamId: defaultTeam.id,
    memberType: "bot",
    botId: newBot.id,
    role: "member",
  }).run();
}
```

### User Registration Hook

Similarly, when a user is invited to a workspace, auto-add them to the default team.

---

## Dashboard UI

### New Pages

| Page | Route | Purpose |
|------|-------|---------|
| Teams List | `/dashboard/teams` | Overview of all teams with member counts, collaboration links |
| Team Detail | `/dashboard/teams/:id` | Members, stats, collaboration management |
| Team Settings | `/dashboard/teams/:id/settings` | Edit name, description, avatar, visibility |
| whale.md Editor | `/dashboard/settings/whale-md` | Markdown editor with live preview |

### Teams List Page (`/dashboard/teams`)

```
┌──────────────────────────────────────────────────────┐
│  Teams                                    [+ New Team] │
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌────────────────────────┐ ┌────────────────────────┐ │
│  │ ⭐ General (default)   │ │ 🎨 Frontend Team       │ │
│  │ 5 members (3👤 2🤖)   │ │ 4 members (2👤 2🤖)   │ │
│  │ All workspace members  │ │ UI/UX, React, design   │ │
│  │                        │ │ ↔ Backend Team         │ │
│  └────────────────────────┘ └────────────────────────┘ │
│                                                        │
│  ┌────────────────────────┐ ┌────────────────────────┐ │
│  │ ⚙️ Backend Team        │ │ 🧪 QA Team             │ │
│  │ 3 members (1👤 2🤖)   │ │ 2 members (1👤 1🤖)   │ │
│  │ APIs, infra, data      │ │ Testing, monitoring    │ │
│  │ ↔ Frontend Team        │ │                        │ │
│  └────────────────────────┘ └────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Team Detail Page (`/dashboard/teams/:id`)

```
┌──────────────────────────────────────────────────────┐
│  ← Teams / Frontend Team                   [Settings] │
├──────────────────────────────────────────────────────┤
│                                                        │
│  Members                               [+ Add Member] │
│  ┌────────────────────────────────────────────────┐   │
│  │ 👤 Alice Chen        lead      Active  3 tasks │   │
│  │ 👤 Bob Park          member    Active  1 task  │   │
│  │ 🤖 UIBot             member    Idle    0 tasks │   │
│  │ 🤖 DesignBot         member    Working 2 tasks │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Collaborations                    [+ Link Team]       │
│  ┌────────────────────────────────────────────────┐   │
│  │ ↔ Backend Team                                 │   │
│  │   Scope: project "API v2", tags: ["api"]       │   │
│  │   Direction: bidirectional                     │   │
│  │   Status: active         [Edit] [Remove]       │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Team Stats                                            │
│  ┌────────────────────────────────────────────────┐   │
│  │ Tasks: 12 open, 47 completed this week         │   │
│  │ Avg completion: 2.3 hours                      │   │
│  │ Top contributor: DesignBot (18 tasks)           │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### whale.md Editor (`/dashboard/settings/whale-md`)

```
┌──────────────────────────────────────────────────────┐
│  whale.md Editor                       [Save] [Preview]│
├───────────────────────┬──────────────────────────────┤
│                       │                              │
│  # Markdown Editor    │  # Preview                   │
│  (CodeMirror/Monaco)  │  (rendered markdown)         │
│                       │                              │
│  Supports:            │                              │
│  - Live preview       │                              │
│  - Template insert    │                              │
│  - Variable hints:    │                              │
│    {{teams}}          │                              │
│    {{botCount}}       │                              │
│    {{taskConventions}}│                              │
│                       │                              │
├───────────────────────┴──────────────────────────────┤
│  ℹ️ Served at: /.well-known/whale.md                   │
│  Last updated: 2 hours ago by Alice                    │
└──────────────────────────────────────────────────────┘
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `TeamCard` | `src/components/teams/team-card.tsx` | Card for team list with member avatars, collab badges |
| `TeamMemberList` | `src/components/teams/team-member-list.tsx` | Table of members with role badges, status, task counts |
| `AddMemberDialog` | `src/components/teams/add-member-dialog.tsx` | Modal to add user or bot, select role |
| `CollaborationManager` | `src/components/teams/collaboration-manager.tsx` | Manage linked teams, scope editor |
| `WhaleMdEditor` | `src/components/settings/whale-md-editor.tsx` | Markdown editor with preview pane |
| `TeamSelector` | `src/components/teams/team-selector.tsx` | Dropdown/combobox for selecting teams (reusable) |

---

## Audit Logging

All team operations generate audit log entries (using existing `logAudit` infrastructure):

| Action | Metadata |
|--------|----------|
| `team.create` | `{ teamId, name, slug }` |
| `team.update` | `{ teamId, changes }` with before/after diff |
| `team.delete` | `{ teamId, name }` |
| `team.member.add` | `{ teamId, memberType, memberId, role }` |
| `team.member.remove` | `{ teamId, memberType, memberId }` |
| `team.member.role_change` | `{ teamId, memberId, oldRole, newRole }` |
| `team.collaboration.create` | `{ collaborationId, sourceTeamId, targetTeamId, scope }` |
| `team.collaboration.delete` | `{ collaborationId }` |
| `workspace.whale_md.update` | `{ contentLength, updatedBy }` |

---

## Security Considerations

- **Team operations require session auth** — no public write access to teams
- **Role hierarchy enforced**: only `lead` or workspace `admin` can modify team membership
- **Default team cannot be deleted** — application-level guard
- **Collaboration scope validation**: `projectIds` must reference projects in the same workspace
- **whale.md content sanitized** — stored as-is (markdown), but rendered HTML is sanitized before serving as `text/html`
- **Bot personalized sections** — only show data the bot already has access to (its own tasks, its teams)
- **Rate limiting** on whale.md endpoint: 60 req/min unauthenticated, 600 req/min with bot auth (same as M5 public API tiers)

---

## Relationship to M5 Public Agent API

This PRD extends the [M5 Public Agent API](./m5-public-agent-api.md) with team-aware endpoints:

1. **Public team listing** (`GET /api/public/teams`) — teams with `visibility: "public"` appear in the public API, enabling external consumers (like Strataga) to see team structure
2. **Agent profiles include team membership** — the `GET /api/public/agents/:slug` response gains a `teams` array showing which teams an agent belongs to
3. **whale.md as discovery complement** — `/.well-known/agent.json` is machine-readable (A2A protocol), `/.well-known/whale.md` is human/bot-readable (onboarding). Both are served from well-known paths
4. **Webhook events** — new events: `team.member.added`, `team.member.removed`, `team.created`

### Changes to M5 Public Agent API response

The agent profile response (`GET /api/public/agents/:slug`) adds:

```json
{
  "teams": [
    { "slug": "frontend-team", "name": "Frontend Team", "role": "member" },
    { "slug": "general", "name": "General", "role": "member" }
  ]
}
```

---

## Implementation Sequencing

### Sprint 1: Schema + Team CRUD (foundation)

1. Add `teams`, `teamMembers`, `teamCollaborations` tables to `schema.ts`
2. Add Drizzle relations
3. Add Zod validators to `validators.ts`
4. Write migration script for default "General" team backfill
5. `GET/POST /api/teams` — list and create teams
6. `GET/PATCH/DELETE /api/teams/:id` — team detail and management
7. Audit logging for team operations

### Sprint 2: Membership + Auto-Join

8. `GET/POST/PATCH/DELETE /api/teams/:id/members` — full membership CRUD
9. Update `POST /api/bots/register` — auto-add bot to default team
10. Update user invite flow — auto-add user to default team
11. `GET /api/bots/me/teams` — bot-facing team list
12. Dashboard: Teams List page + Team Detail page

### Sprint 3: Collaborations + Team Tasks

13. `GET/POST/PATCH/DELETE /api/teams/:id/collaborations` — collaboration CRUD
14. `GET /api/bots/me/team-tasks` — team-aware task queue with collaboration scoping
15. Dashboard: Collaboration Manager component
16. Dashboard: Team Settings page

### Sprint 4: whale.md + Public API

17. Add `whaleMdContent` / `whaleMdUpdatedAt` to workspaces table
18. `GET /.well-known/whale.md` — public + personalized serving
19. `GET/PUT /api/settings/whale-md` — admin management
20. Dashboard: whale.md Editor page with live preview
21. `GET /api/public/teams` + `GET /api/public/teams/:slug` — public team endpoints
22. Update `GET /api/public/agents/:slug` to include `teams` array

---

## Success Metrics

- Every workspace has exactly one default team after migration
- Existing users and bots are enrolled in the default team with correct roles
- Team CRUD operations are fully audited
- Bot registration auto-enrolls in default team within the same transaction
- Collaboration-scoped tasks appear in `GET /api/bots/me/team-tasks` correctly filtered
- `/.well-known/whale.md` serves public content in < 50ms, personalized in < 200ms
- whale.md editor saves and previews correctly with no XSS vectors
- Zero cross-workspace data leakage through team or collaboration queries

---

## Open Questions

1. **Should team leads require workspace admin approval to create collaborations?** Currently any lead can link their team. For larger workspaces, admin approval might be needed.
2. **Task assignment via teams** — should tasks have an optional `teamId` field, or is the current `assigneeId` (user) + `botTasks` (bot) sufficient? Adding `teamId` to tasks would enable "assign to team" (any team member can pick it up).
3. **whale.md templating** — should we support dynamic variables like `{{teams}}` that auto-expand, or keep it as static markdown that the admin manually updates?
4. **Team capacity metrics** — should we aggregate `userAvailability` data at the team level for capacity planning dashboards?
5. **Collaboration approval flow** — should creating a collaboration require acceptance from the target team's lead (like a "friend request"), or is unilateral linking acceptable?
