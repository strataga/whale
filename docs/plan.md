# Whale — Planning Doc

## Problem
People have ideas but lose momentum. Tools are either too rigid (project management) or too loose (notes). We need an AI-first planner that adapts to the user and keeps them moving.

## Target Users
- Solo founders
- Agency owners
- PMs + marketers
- ADHD builders who need structure

## Product Requirements (v0)
- Natural-language intake
- Auto-generated plan (milestones, tasks, daily plan)
- Dynamic UI based on intent/project type
- OpenClaw integration for delegation
- Scheduled check-ins + reminders

## MVP Scope
### Must Have
- Project intake → structured plan
- Editable task list + milestones
- Daily plan generator
- “AI Update” button to re-plan

### Nice to Have
- Templates library
- AI status summaries
- OpenClaw task delegation

## Architecture (proposed)
- Frontend: Next.js (App Router)
- Backend: lightweight API + SQLite/Convex
- OpenClaw integration: webhook or local CLI calls

## Open Questions
- Desired UI surface? (web app, desktop, or both)
- Where should data live? (local-first vs hosted)
- How much automation vs manual control?
- Auth: optional? or local-first with no login?

## Success Metrics
- User gets a usable plan in < 2 minutes
- Daily plan produced reliably
- Users complete ≥ 3 tasks/day
