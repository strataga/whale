# M2 — Bot Integration PRD

## Problem

Whale currently manages projects, tasks, and daily plans — but all execution is manual. The core differentiator is **OpenClaw bot integration**: the ability to pair remote bots (local machines, VPS, cloud) with a Whale workspace, assign tasks to them, and collect results + artifacts. Without this, Whale is just another project tool.

## Goals

- **Pair bots** to a workspace via a one-time pairing token
- **Register bots** with name, host, capabilities, and status
- **Assign tasks** to specific bots
- **Receive results** (output summaries, artifact links) from bots
- **Monitor bot status** (online, offline, busy, error)
- **Audit everything** — all bot actions logged

## Non-Goals (v1)

- Bot-to-bot communication
- Automatic task routing / scheduling (user assigns manually)
- File/artifact storage (bots return links, Whale stores references)
- Real-time WebSocket status (polling is fine for v1)

---

## Data Model

### New Tables

```sql
-- Bots registered to a workspace
bots
  id            TEXT PRIMARY KEY (uuid)
  workspaceId   TEXT NOT NULL → workspaces.id
  name          TEXT NOT NULL
  host          TEXT NOT NULL          -- e.g. "192.168.1.10:8080" or "bot.example.com"
  status        TEXT NOT NULL DEFAULT 'offline'  -- online | offline | busy | error
  capabilities  TEXT NOT NULL DEFAULT '[]'       -- JSON array of strings
  lastSeenAt    INTEGER                -- unix ms timestamp, updated on heartbeat
  tokenHash     TEXT NOT NULL           -- bcrypt hash of the device-scoped bearer token
  createdAt     INTEGER NOT NULL
  updatedAt     INTEGER NOT NULL

-- Task assignments to bots
botTasks
  id              TEXT PRIMARY KEY (uuid)
  botId           TEXT NOT NULL → bots.id
  taskId          TEXT NOT NULL → tasks.id
  status          TEXT NOT NULL DEFAULT 'pending'  -- pending | running | completed | failed
  outputSummary   TEXT DEFAULT ''
  artifactLinks   TEXT NOT NULL DEFAULT '[]'       -- JSON array of URL strings
  startedAt       INTEGER              -- when bot picked it up
  completedAt     INTEGER              -- when bot reported done/failed
  createdAt       INTEGER NOT NULL
  updatedAt       INTEGER NOT NULL

-- Short-lived pairing tokens (consumed on use)
pairingTokens
  id            TEXT PRIMARY KEY (uuid)
  workspaceId   TEXT NOT NULL → workspaces.id
  tokenHash     TEXT NOT NULL           -- bcrypt hash of the one-time token
  expiresAt     INTEGER NOT NULL        -- unix ms, 15 min TTL
  consumedAt    INTEGER                 -- set when used, prevents reuse
  createdAt     INTEGER NOT NULL
```

### Relations

- Workspace → many Bots
- Bot → many BotTasks
- Task → many BotTasks (a task can be reassigned)
- Workspace → many PairingTokens

---

## API Routes

### Bot Management (Dashboard — requires auth + admin role)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/bots` | List all bots in workspace |
| GET | `/api/bots/[botId]` | Get bot details + recent botTasks |
| DELETE | `/api/bots/[botId]` | Revoke bot (deletes token, sets offline) |
| POST | `/api/bots/pairing-tokens` | Generate a one-time pairing token (admin) |

### Bot Self-Service (Bot-authenticated — bearer token)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/bots/register` | Consume pairing token, register bot, get device token |
| POST | `/api/bots/[botId]/heartbeat` | Update status + lastSeenAt |
| GET | `/api/bots/[botId]/tasks` | Get assigned tasks (pending/running) |
| PATCH | `/api/bots/[botId]/tasks/[botTaskId]` | Report progress/completion/failure |

### Task Assignment (Dashboard — requires auth + member role)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/projects/[id]/tasks/[taskId]/assign-bot` | Assign a task to a bot |

---

## Authentication Model

### Two Auth Layers

1. **Dashboard auth** — existing NextAuth JWT sessions (humans)
2. **Bot auth** — long-lived bearer tokens (machines)

### Pairing Flow

```
1. Admin clicks "Generate Pairing Token" in Whale UI
2. Whale creates a random token (32 bytes hex), stores bcrypt hash + 15min expiry
3. Admin copies the raw token and runs: `openclaw pair --token <token> --whale <url>`
4. Bot POSTs to /api/bots/register with:
   - pairingToken (raw)
   - name, host, capabilities
5. Whale verifies token (bcrypt compare, not expired, not consumed)
6. Whale creates bot record + generates device-scoped bearer token (64 bytes hex)
7. Whale returns the bearer token to the bot (ONLY TIME it's visible)
8. Bot stores token locally for future requests
9. Pairing token marked as consumed
```

### Bot Request Auth

Every bot request includes `Authorization: Bearer <device-token>`. Middleware:
1. Extract token from header
2. Find bot by bcrypt-comparing against stored `tokenHash`
3. Verify bot belongs to correct workspace
4. Attach `{ botId, workspaceId }` to request context

**Optimization**: Since bcrypt comparison is expensive and we can't query by hash, we use a `tokenPrefix` column (first 8 chars of the hex token) to narrow the candidate set before bcrypt comparison. This avoids scanning all bots.

---

## UI Pages

### Sidebar Addition
- Add "Bots" nav item (icon: `Bot` from lucide-react) between Projects and Settings

### `/dashboard/bots` — Bot List Page
- Table/grid of registered bots: name, host, status badge, last seen, capabilities
- "Generate Pairing Token" button (admin only) → modal with copyable token + countdown
- Status indicators: green (online), gray (offline), yellow (busy), red (error)

### `/dashboard/bots/[botId]` — Bot Detail Page
- Bot info card (name, host, status, capabilities, registered date)
- Recent bot tasks list with status, task title, output summary
- "Revoke Bot" button (admin, with confirmation dialog)

### Task Assignment UI
- On task detail/card, add "Assign to Bot" dropdown (shows online bots)
- Once assigned, show bot name + botTask status on the task card
- Bot task status updates reflected on the task card

---

## Implementation Phases

### Phase 1: Schema + Core API (backend only)
1. Add `bots`, `botTasks`, `pairingTokens` tables to schema.ts
2. Add relations
3. Add Zod validators for all new inputs
4. Implement bot management routes (GET/DELETE bots, POST pairing tokens)
5. Implement bot self-service routes (register, heartbeat, get tasks, report status)
6. Implement task assignment route
7. Add bot auth middleware (bearer token verification)
8. Add audit logging for all bot mutations

### Phase 2: Dashboard UI
1. Add "Bots" to sidebar navigation
2. Build `/dashboard/bots` list page with pairing token generation
3. Build `/dashboard/bots/[botId]` detail page
4. Add "Assign to Bot" UI to task cards
5. Show botTask status on task cards

### Phase 3: Polish
1. Bot status badges (online/offline/busy/error) with auto-refresh
2. Stale bot detection (mark offline if no heartbeat in 5 min)
3. Rate limiting on bot endpoints
4. Error handling + loading states

---

## Security Considerations

- Pairing tokens expire in 15 minutes and are single-use
- Device tokens are 64-byte hex (256 bits of entropy), stored as bcrypt hashes
- Token prefix optimization prevents full-table bcrypt scans
- Bot can only access its own tasks and update its own status
- Only admins can generate pairing tokens and revoke bots
- Members can assign tasks to bots; viewers cannot
- All bot actions are audit-logged
- Rate limiting on register endpoint (prevent token brute-force)

---

## Files to Create/Modify

### New Files
- `src/app/api/bots/route.ts` — GET (list), middleware
- `src/app/api/bots/[botId]/route.ts` — GET (detail), DELETE (revoke)
- `src/app/api/bots/[botId]/heartbeat/route.ts` — POST
- `src/app/api/bots/[botId]/tasks/route.ts` — GET (assigned tasks)
- `src/app/api/bots/[botId]/tasks/[botTaskId]/route.ts` — PATCH (report status)
- `src/app/api/bots/register/route.ts` — POST (consume pairing token)
- `src/app/api/bots/pairing-tokens/route.ts` — POST (generate token)
- `src/app/api/projects/[id]/tasks/[taskId]/assign-bot/route.ts` — POST
- `src/lib/server/bot-auth.ts` — Bot bearer token verification middleware
- `src/app/(dashboard)/dashboard/bots/page.tsx` — Bot list page
- `src/app/(dashboard)/dashboard/bots/[botId]/page.tsx` — Bot detail page
- `src/components/bots/bot-card.tsx` — Bot display component
- `src/components/bots/pairing-token-modal.tsx` — Token generation + display
- `src/components/bots/bot-task-status.tsx` — BotTask status badge
- `src/components/tasks/assign-bot-dropdown.tsx` — Bot assignment UI

### Modified Files
- `src/lib/db/schema.ts` — Add bots, botTasks, pairingTokens tables + relations
- `src/lib/validators.ts` — Add bot-related Zod schemas
- `src/components/layout/sidebar.tsx` — Add Bots nav item
- `src/components/tasks/task-card.tsx` — Show bot assignment + botTask status

---

## Success Criteria

- [ ] Admin can generate a pairing token
- [ ] Bot can register using the pairing token and receive a device token
- [ ] Bot can send heartbeats and update its status
- [ ] User can assign a task to an online bot
- [ ] Bot can fetch its assigned tasks
- [ ] Bot can report task completion with output summary + artifact links
- [ ] Admin can revoke a bot (deletes token, sets offline)
- [ ] All bot actions appear in audit log
- [ ] Pairing tokens expire after 15 minutes and cannot be reused
- [ ] Device tokens are stored as bcrypt hashes (never in plaintext)
