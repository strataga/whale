# AGENTS.md — Whale

## Purpose
Whale is a self‑hosted, multi‑user project planner that integrates with OpenClaw bots.

## Working Agreements
- Keep security first (tokens, encryption, least‑privilege).
- Whale is the source‑of‑truth for projects/tasks; bots are execution endpoints.
- Every change should improve onboarding clarity or planning velocity.

## Repo Conventions
- Docs live in `/docs`.
- Use small, focused commits with clear messages.
- Prefer typed APIs and explicit schemas.

## Next Milestones
- M1: Core planner UI + project intake
- M2: OpenClaw pairing + task delegation
- M3: Security hardening + audit logs
