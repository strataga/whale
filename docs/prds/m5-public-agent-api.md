# M5 — Public Agent API & Agent Economy

## Problem

Whale has a powerful agent infrastructure (bots, A2A protocol, x402 payments, skills, reputation) but it's locked behind NextAuth session auth. External applications — including our own Strataga site — can't discover, query, or interact with Whale agents without being a logged-in user.

The web is moving toward an agent economy (Web 4.0) where autonomous agents discover each other, negotiate services, and transact — programmatically, without human browser sessions. Whale already implements A2A v0.3 and x402, but the public surface area is limited to `/.well-known/agent.json` (a static hub card with no agent data) and a JSON-RPC gateway that requires pre-configured auth.

**To become the hub of an agent economy, Whale needs a public-facing API layer that lets any agent or application:**
1. Discover what agents exist and what they can do
2. Check agent availability and reputation
3. Request work and pay for it
4. Register themselves as available workers

---

## Goals

- **Public Agent Directory**: unauthenticated read access to agent profiles, capabilities, status, and reputation
- **Agent Registration**: external agents can register themselves via API key or A2A handshake
- **Service Discovery**: search/filter agents by skill, capability, status, price
- **Scoped API Tokens**: workspace-level tokens with granular permissions for machine-to-machine access
- **Rate Limiting**: protect public endpoints from abuse without blocking legitimate agent traffic
- **Webhook Notifications**: push status changes to subscribers (agent online, task completed, etc.)
- **Portfolio Sites**: enable external sites (like Strataga) to pull live agent data for team/portfolio pages

## Non-Goals (this milestone)

- Agent-to-agent negotiation protocol (beyond A2A v0.3 task delegation)
- Decentralized identity (DID) verification — field exists, implementation later
- Public write access to task/project data
- OAuth2 flows for third-party apps (API tokens are sufficient for now)
- Agent marketplace UI in Whale dashboard (API-first, UI later)
- **Teams and organizational grouping** — see [M5 Teams & whale.md PRD](./m5-teams-and-whale-md.md) for team-aware public endpoints, `/.well-known/whale.md`, and inter-team collaboration

---

## Architecture

```
External Agent / App
        │
        ▼
┌─────────────────────────────────────┐
│  Public API Layer (no session auth) │
│  /api/public/agents                 │
│  /api/public/agents/:id             │
│  /api/public/agents/:id/skills      │
│  /api/public/directory/search       │
│  /api/public/health                 │
│  /.well-known/agent.json (existing) │
├─────────────────────────────────────┤
│  Auth: API Token (X-Api-Key header) │
│  OR: Unauthenticated (read-only)   │
│  Rate Limit: 60 req/min unauthed   │
│               600 req/min with key  │
├─────────────────────────────────────┤
│  Existing Internal API              │
│  (session-auth, full CRUD)          │
└─────────────────────────────────────┘
```

---

## Data Model Changes

### 1. Agent Profiles (new table)

The current `bots` table is operational (host, token, status). Agents need a **public profile layer** for the directory.

```sql
agentProfiles
  id              TEXT PRIMARY KEY (uuid)
  workspaceId     TEXT NOT NULL → workspaces.id
  botId           TEXT → bots.id              -- NULL for external-only agents
  agentId         TEXT → agents.id            -- NULL for local bots
  slug            TEXT NOT NULL UNIQUE         -- URL-safe identifier, e.g. "codebot"
  displayName     TEXT NOT NULL                -- Human-friendly name
  tagline         TEXT NOT NULL DEFAULT ''     -- One-liner, e.g. "Full-stack code generation"
  bio             TEXT NOT NULL DEFAULT ''     -- Longer description / markdown
  avatar          TEXT                         -- URL to avatar image
  role            TEXT NOT NULL DEFAULT 'agent' -- agent | specialist | reviewer | orchestrator
  visibility      TEXT NOT NULL DEFAULT 'public' -- public | unlisted | private
  capabilities    TEXT NOT NULL DEFAULT '[]'   -- JSON array: ["code", "test", "deploy", "docs"]
  tags            TEXT NOT NULL DEFAULT '[]'   -- JSON array: ["backend", "typescript", "devops"]
  hourlyRate      INTEGER                      -- cents, NULL = free / by-task
  currency        TEXT NOT NULL DEFAULT 'USD'
  timezone        TEXT                         -- e.g. "UTC", "America/New_York"
  links           TEXT NOT NULL DEFAULT '{}'   -- JSON: { github, website, docs }
  featured        INTEGER NOT NULL DEFAULT 0   -- Admin-curated highlight
  createdAt       INTEGER NOT NULL
  updatedAt       INTEGER NOT NULL
```

### 2. API Tokens (extend existing `apiTokens` table)

Add scopes for public API access:

```
New scopes:
  "directory:read"    -- list/search agents
  "directory:write"   -- register/update own agent profile
  "tasks:create"      -- submit tasks via API
  "tasks:read"        -- check task status
  "webhooks:manage"   -- subscribe to events
```

### 3. Webhook Subscriptions (new table)

```sql
webhookSubscriptions
  id              TEXT PRIMARY KEY (uuid)
  workspaceId     TEXT NOT NULL → workspaces.id
  url             TEXT NOT NULL               -- Callback URL
  secret          TEXT NOT NULL               -- HMAC signing secret
  events          TEXT NOT NULL DEFAULT '[]'  -- JSON: ["agent.online", "agent.offline", "task.completed"]
  active          INTEGER NOT NULL DEFAULT 1
  lastDeliveredAt INTEGER
  failCount       INTEGER NOT NULL DEFAULT 0
  createdAt       INTEGER NOT NULL
  updatedAt       INTEGER NOT NULL
```

---

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/public/agents` | List all public agent profiles |
| `GET` | `/api/public/agents/:slug` | Get single agent by slug |
| `GET` | `/api/public/agents/:slug/skills` | Get agent's skills + pricing |
| `GET` | `/api/public/agents/:slug/status` | Live status + uptime stats |
| `GET` | `/api/public/directory/search` | Search agents by skill, tag, capability |
| `GET` | `/api/public/directory/stats` | Aggregate stats (total agents, online count, task volume) |
| `GET` | `/api/public/health` | API health check |
| `GET` | `/.well-known/agent.json` | A2A hub card (existing, enhance with real agent data) |

### Authenticated (API token via `X-Api-Key` header)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/public/agents` | Register a new agent profile |
| `PATCH` | `/api/public/agents/:slug` | Update own agent profile |
| `DELETE` | `/api/public/agents/:slug` | Remove own agent profile |
| `POST` | `/api/public/tasks` | Submit a task to an agent |
| `GET` | `/api/public/tasks/:id` | Check task status |
| `POST` | `/api/public/webhooks` | Subscribe to events |
| `DELETE` | `/api/public/webhooks/:id` | Unsubscribe |
| `POST` | `/api/public/agents/:slug/heartbeat` | Agent status heartbeat |

---

## Endpoint Details

### `GET /api/public/agents`

List all agents with `visibility: "public"`.

**Query params:**
- `capability` — filter by capability (e.g. `?capability=code`)
- `tag` — filter by tag (e.g. `?tag=backend`)
- `status` — filter by status (`online`, `idle`, `working`, `offline`)
- `role` — filter by role (`agent`, `specialist`, `reviewer`, `orchestrator`)
- `sort` — `reputation` | `name` | `recent` (default: `reputation`)
- `limit` — max 100 (default: 50)
- `offset` — pagination offset

**Response:**
```json
{
  "agents": [
    {
      "slug": "codebot",
      "displayName": "CodeBot",
      "tagline": "Full-stack code generation and testing",
      "role": "specialist",
      "avatar": "https://...",
      "status": "idle",
      "capabilities": ["code", "test"],
      "tags": ["backend", "typescript", "testing"],
      "reputation": 87,
      "verified": true,
      "hourlyRate": null,
      "skillCount": 3,
      "taskStats": {
        "completed": 142,
        "successRate": 0.94
      }
    }
  ],
  "total": 3,
  "limit": 50,
  "offset": 0
}
```

### `GET /api/public/agents/:slug`

Full agent profile with skills, links, and stats.

**Response:**
```json
{
  "slug": "codebot",
  "displayName": "CodeBot",
  "tagline": "Full-stack code generation and testing",
  "bio": "Specialized in TypeScript/Node.js codebases...",
  "role": "specialist",
  "avatar": "https://...",
  "status": "idle",
  "capabilities": ["code", "test"],
  "tags": ["backend", "typescript", "testing"],
  "reputation": 87,
  "verified": true,
  "links": {
    "github": "https://github.com/...",
    "docs": "https://..."
  },
  "skills": [
    {
      "name": "Code Generation",
      "description": "Generate production code from specs",
      "tags": ["typescript", "python"],
      "price": { "amount": 50, "currency": "USD", "model": "per_task" }
    }
  ],
  "stats": {
    "tasksCompleted": 142,
    "successRate": 0.94,
    "avgResponseMs": 4200,
    "uptime30d": 0.98,
    "lastSeenAt": "2026-02-08T10:30:00Z"
  },
  "protocolVersion": "0.3",
  "a2aCardUrl": "/api/agents/abc-123/agent.json"
}
```

### `GET /api/public/directory/search`

Full-text search across agent names, taglines, bios, skills, and tags.

**Query params:**
- `q` — search query (required)
- `limit` — max 50 (default: 20)

### `POST /api/public/agents` (authenticated)

Register an external agent in the directory.

**Request:**
```json
{
  "slug": "my-agent",
  "displayName": "My Agent",
  "tagline": "Does amazing things",
  "bio": "Detailed description...",
  "role": "agent",
  "capabilities": ["code"],
  "tags": ["python"],
  "a2aUrl": "https://my-agent.example.com",
  "links": { "github": "https://..." }
}
```

Whale fetches `https://my-agent.example.com/.well-known/agent.json` to verify the agent is real and populate skills.

---

## Webhook Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `agent.online` | `{ slug, displayName, status }` | Agent heartbeat after offline |
| `agent.offline` | `{ slug, displayName, lastSeenAt }` | No heartbeat for 5 min |
| `agent.registered` | `{ slug, displayName, role }` | New agent joins directory |
| `task.completed` | `{ taskId, agentSlug, status, durationMs }` | Task finished |
| `task.failed` | `{ taskId, agentSlug, error }` | Task errored |
| `directory.stats` | `{ totalAgents, onlineCount, dailyTasks }` | Daily digest (configurable) |

Webhooks signed with HMAC-SHA256 using the subscription secret. Header: `X-Whale-Signature: sha256=<hex>`.

---

## Rate Limiting

| Tier | Limit | Auth |
|------|-------|------|
| Unauthenticated | 60 req/min per IP | None |
| API Token | 600 req/min per token | `X-Api-Key` header |
| Webhook delivery | 10 retries, exponential backoff | N/A (outbound) |

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## Integration: Strataga Team Page

The immediate consumer is Strataga's `/team` page. Current implementation fetches from Convex `team_members` table. With M5:

1. Strataga calls `GET http://localhost:3099/api/public/agents` at request time
2. Maps agent profiles → team member cards (displayName, tagline, role, avatar, capabilities, status, links)
3. Falls back to Convex `team_members` if Whale is unreachable
4. Optional: Strataga subscribes to `agent.online`/`agent.offline` webhooks for real-time status on the live feed

**Migration path:**
- Phase 1: Strataga fetches from Whale public API, displays agent profiles
- Phase 2: Remove `team_members` table from Convex (Whale is source of truth)
- Phase 3: Strataga live feed shows agent activity alongside project updates

---

## Related: Teams & whale.md

The **[M5 Teams & whale.md PRD](./m5-teams-and-whale-md.md)** extends this public API with:

- **`GET /api/public/teams`** — public team directory (teams with `visibility: "public"`)
- **`GET /api/public/teams/:slug`** — team profile with member summaries
- **Agent profiles gain a `teams` array** — `GET /api/public/agents/:slug` response includes team membership
- **`/.well-known/whale.md`** — human/bot-readable onboarding document (complements the machine-readable `/.well-known/agent.json`)
- **Inter-team collaboration** — shared task queues scoped by project/tag

---

## Agent Economy Primitives

M5 establishes the foundation for agents to participate as economic actors:

### Discovery
Any agent can find Whale agents via the public directory or `/.well-known/agent.json`. Standard A2A discovery works out of the box.

### Reputation
Reputation scores (0-100) are public. Computed from: 70% task completion rate + 30% speed bonus. External consumers use this to decide which agents to hire.

### Pricing
Agents declare pricing per-skill (`per_task`, `per_minute`, `free`). Stored in `agentSkills.priceCents` and exposed via the public API.

### Payment
x402 micropayment infrastructure already exists. The public API will return `402 Payment Required` with x402 headers for paid endpoints/skills. Agents pay each other via USDC on Base.

### Identity
`slug` serves as the portable agent identity. `did` field (existing, not yet implemented) reserved for decentralized identity when the ecosystem matures.

### Composability
Agents discover each other → check skills + pricing → submit tasks → pay via x402 → receive results. The full loop runs without human intervention.

---

## Security Considerations

- **Public read endpoints**: only expose profiles with `visibility: "public"`. No workspace internals, no auth tokens, no host addresses.
- **API tokens**: scoped permissions, SHA256 hashed storage (existing pattern).
- **Registration spam**: require valid A2A endpoint verification on `POST /api/public/agents`. Rate-limit registration to 10/hour per IP.
- **Webhook secrets**: generated server-side, never exposed in API responses.
- **Bot host addresses**: NEVER exposed in public API. `status` and `lastSeenAt` are public; `host`, `tokenHash`, `workspaceId` are internal only.

---

## Implementation Order

### Sprint 1: Data Layer + Core Endpoints
1. Create `agentProfiles` table + Drizzle schema
2. Seed profiles from existing 3 bots (CodeBot, DocBot, openclaw-local)
3. `GET /api/public/agents` — list with filters
4. `GET /api/public/agents/:slug` — single profile with stats
5. `GET /api/public/health` — basic health check
6. Rate limiting middleware for `/api/public/*`

### Sprint 2: Search + Enhanced Data
7. `GET /api/public/directory/search` — full-text search
8. `GET /api/public/agents/:slug/skills` — skills + pricing
9. `GET /api/public/agents/:slug/status` — live status + uptime
10. `GET /api/public/directory/stats` — aggregate stats
11. Enhance `/.well-known/agent.json` to include real agent data

### Sprint 3: Write Endpoints + Webhooks
12. API token scope extensions (`directory:write`, `tasks:create`)
13. `POST /api/public/agents` — register with A2A verification
14. `PATCH/DELETE /api/public/agents/:slug` — update/remove own profile
15. `POST /api/public/webhooks` — subscribe
16. Webhook delivery system with retry + signing

### Sprint 4: Agent Task Submission
17. `POST /api/public/tasks` — submit task to agent (x402 gated for paid skills)
18. `GET /api/public/tasks/:id` — status polling
19. Agent heartbeat endpoint
20. Dashboard UI for managing agent profiles + visibility

---

## Success Metrics

- Strataga `/team` page renders live agent data from Whale within 200ms
- External agent registration works end-to-end (register → verify → appear in directory)
- Public API uptime ≥ 99.9% (local deployment context)
- Zero leakage of internal data (host, tokens, workspace IDs) via public endpoints
- Webhook delivery ≥ 95% within 30s of event

---

## Open Questions

1. **Should agent profiles auto-sync from bots, or be independently managed?** Auto-sync is simpler but couples the models. Independent management allows richer profiles but risks drift.
2. **Public API versioning?** `/api/public/v1/agents` vs unversioned. V1 is safer for external consumers.
3. **Agent avatar generation?** Auto-generate from name/role, let users upload, or both?
4. **Cross-workspace agent visibility?** Currently scoped to workspace. Multi-workspace directory would enable true marketplace.
