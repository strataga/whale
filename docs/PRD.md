# Whale — Product Requirements Document (PRD)

## 0. TL;DR
Whale is a self‑hosted, multi‑user, AI‑first project planner that integrates with OpenClaw bots anywhere. It is the **source of truth** for projects, tasks, and plans, while bots are isolated execution endpoints. Whale must be secure by default and “just work.”

---

## 1. Problem Statement
People have ideas but lose momentum. Existing project tools are either too rigid (traditional PM tools) or too loose (notes). OpenClaw users want a **single control center** that:
- Converts intent into structured plans
- Keeps daily priorities current
- Coordinates **multiple OpenClaw bots** (local, VPS, anywhere)
- Works self‑hosted with strong security

---

## 2. Goals & Non‑Goals
### Goals
- **Self‑hosted**: runs on user infrastructure
- **Multi‑user**: teams/agency workflows
- **Source‑of‑truth**: Whale owns projects/tasks/plans
- **OpenClaw integration**: pair, send tasks, receive results
- **Just‑works UX**: minimal setup, fast onboarding
- **Secure by default**: encryption, audit logs, least‑privilege

### Non‑Goals (v1)
- Native mobile app
- Real‑time collaborative editing (Google Docs‑style)
- Marketplace of agents/templates (later)

---

## 3. Target Users & Personas
1) **Solo Founder (ADHD)**
- Needs daily structure and momentum
- Wants quick plans and reminders

2) **Agency Owner**
- Multiple clients + bots + projects
- Needs delegation + visibility

3) **Ops/PM**
- Needs actionable plans and progress tracking
- Wants AI summaries and next actions

---

## 4. Core Use Cases
- Create a project from a goal → get milestones + tasks + daily plan
- Connect multiple OpenClaw bots (local + VPS)
- Assign tasks to a specific bot
- Receive results, store artifacts, update plan
- Daily check‑ins with focused next actions

---

## 5. Product Principles
- **Universal**: works for any domain
- **Minimal friction**: no heavy config
- **Traceable**: decisions and progress logged
- **Secure**: least‑privilege + audit

---

## 6. Functional Requirements

### 6.1 Onboarding & Workspace
- Create workspace (name, timezone)
- Add users (roles: Admin, Member, Viewer)
- Default daily check‑in schedule

### 6.2 Project Intake
- Natural language intake form
- AI parses into:
  - scope
  - milestones
  - tasks
  - risks
  - success criteria
- User approves/edits

### 6.3 Planning & Tasks
- Tasks with: title, description, status, assignee, due date, priority, tags
- Milestones grouping
- Daily plan generator: 3 must‑do, 2 nice‑to‑do, 1 finish‑what‑you‑start
- “Replan” button to refresh tasks

### 6.4 OpenClaw Bot Integration
- Connect bots via **pairing command** with one‑time token
- Register bot with:
  - name
  - host
  - capabilities
  - status
- Assign tasks to a bot
- Receive results + artifacts

### 6.5 AI Features
- Project summarization
- Daily plan generation
- Task breakdown
- Bot output summarization

### 6.6 Security
- Encrypted secrets at rest
- Device‑scoped tokens
- Short‑lived pairing tokens
- Signed requests
- Audit log
- Optional IP allowlist

### 6.7 Reporting
- Project status snapshot
- Completed tasks per day/week
- Bot activity log

---

## 7. Non‑Functional Requirements
- Self‑hostable (Docker)
- Fast: plan generation < 10s
- Secure defaults
- Extensible

---

## 8. Data Model (Core)
**Workspace**
- id, name, timezone

**User**
- id, email, role

**Project**
- id, workspace_id, name, description, status

**Milestone**
- id, project_id, name, due_date

**Task**
- id, project_id, milestone_id?, title, desc, status, priority, assignee_id, due_date, tags

**Bot**
- id, workspace_id, name, host, status, capabilities

**BotTask**
- id, bot_id, task_id, status, output_summary, artifact_links

**AuditLog**
- id, user_id, action, timestamp, metadata

---

## 9. Architecture (Proposed)
- **Frontend**: Next.js (App Router)
- **Backend**: API + DB (SQLite or Postgres)
- **Auth**: local accounts + optional SSO later
- **OpenClaw integration**: pairing command, signed API

---

## 10. MVP Scope (Milestones)

### M1 — Core Planner
- Workspace + project intake
- Tasks + milestones + daily plan
- Basic UI

### M2 — Bot Integration
- Pairing flow
- Assign tasks to bots
- Receive results

### M3 — Security
- Encryption at rest
- Audit logs

### M4 — Reporting
- Daily summary
- Activity log

---

## 11. Success Metrics
- Plan generated in <2 min
- Daily plan delivered reliably
- ≥3 tasks completed per day for active users

---

## 12. Open Questions
- DB choice: SQLite vs Postgres (for multi‑user)
- Hosted vs local user auth approach
- Bot protocol details (OpenClaw integration)

---

## 13. Next Actions
- Confirm tech stack (DB + auth)
- Define pairing command protocol
- Create project skeleton + initial UI
