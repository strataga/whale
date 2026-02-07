# M3+M4 — Security Hardening + Reporting PRD

## Problem

Two remaining MVP gaps:
1. **M3 Security**: API keys are stored as plaintext in SQLite. Anyone with file access can steal them. We need encryption at rest.
2. **M4 Reporting**: Audit logs exist but have no viewer. Users have no visibility into project progress, task completion rates, or bot activity.

---

## M3: Encryption at Rest

### Approach

Use AES-256-GCM symmetric encryption for sensitive fields. A single `ENCRYPTION_KEY` environment variable (32-byte hex) is used for all encryption/decryption.

### What Gets Encrypted
- `workspaces.aiApiKey` — AI provider API keys
- `bots.tokenHash` — Already bcrypt-hashed (no additional encryption needed)
- `pairingTokens.tokenHash` — Already bcrypt-hashed (no additional encryption needed)

Only `aiApiKey` needs encryption since the token fields are already irreversibly hashed.

### Implementation

#### New File: `src/lib/crypto.ts`
```typescript
// AES-256-GCM encrypt/decrypt using ENCRYPTION_KEY env var
// encrypt(plaintext: string): string  — returns "iv:ciphertext:tag" (hex-encoded)
// decrypt(encrypted: string): string  — reverses the above
// isEncrypted(value: string): boolean — checks if value matches encrypted format
```

#### Migration Strategy
- If `ENCRYPTION_KEY` is set, encrypt on write and decrypt on read
- If `ENCRYPTION_KEY` is NOT set, store/read plaintext (graceful degradation for dev)
- The `isEncrypted()` check allows reading both encrypted and plaintext values (migration-friendly)
- Settings page: encrypt before storing, decrypt before using

#### Modified Files
- `src/lib/ai.ts` — Decrypt `aiApiKey` before passing to AI provider
- `src/app/(dashboard)/dashboard/settings/page.tsx` — Encrypt on save
- `.env.example` — Add `ENCRYPTION_KEY` with generation instructions

---

## M4: Reporting

### Audit Log Viewer

#### New Page: `/dashboard/audit-log`
- Server component, admin-only
- Paginated table of audit log entries (newest first)
- Columns: timestamp, user (name/email), action, metadata preview
- Filter by action type (project.create, task.update, bot.register, etc.)
- Expandable metadata JSON per row
- Add "Audit Log" to sidebar (admin-only visibility)

### Project Dashboard Enhancements

#### Updated: `/dashboard` (main dashboard page)
Add summary cards:
- **Total projects** (active count)
- **Tasks completed this week** (count)
- **Active bots** (online count)
- **Recent activity** (last 10 audit log entries as a feed)

#### Updated: Project Detail Page `/dashboard/projects/[id]`
Add a stats section:
- Task completion progress bar (done / total)
- Tasks by status breakdown (todo / in_progress / done)
- Tasks by priority breakdown (low / medium / high / urgent)

### Bot Activity Log

On the bot detail page (`/dashboard/bots/[botId]`), add:
- Activity feed from audit log filtered by bot actions
- This is already partially covered by the botTasks list — just need to wire audit log entries

---

## Implementation Phases

### Phase 1: Encryption (M3)
1. Create `src/lib/crypto.ts` with encrypt/decrypt/isEncrypted
2. Update `src/lib/ai.ts` to decrypt aiApiKey before use
3. Update settings page to encrypt aiApiKey on save
4. Update `.env.example` with ENCRYPTION_KEY docs
5. Verify: existing plaintext keys still work (isEncrypted check)

### Phase 2: Audit Log Viewer
1. Create `/dashboard/audit-log` page
2. Add audit-log API route for pagination: `GET /api/audit-log?page=1&action=...`
3. Add "Audit Log" to sidebar (admin-only)
4. Wire expandable metadata rows

### Phase 3: Dashboard Stats
1. Add summary cards to main dashboard page
2. Add task stats to project detail page
3. Wire bot count from bots table

---

## Files to Create/Modify

### New Files
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt
- `src/app/api/audit-log/route.ts` — Paginated audit log API
- `src/app/(dashboard)/dashboard/audit-log/page.tsx` — Audit log viewer page

### Modified Files
- `src/lib/ai.ts` — Decrypt aiApiKey
- `src/app/(dashboard)/dashboard/settings/page.tsx` — Encrypt aiApiKey on save
- `src/app/(dashboard)/dashboard/page.tsx` — Add summary stat cards
- `src/app/(dashboard)/dashboard/projects/[id]/page.tsx` — Add task stats section
- `src/components/layout/sidebar.tsx` — Add Audit Log nav item (admin-only)
- `.env.example` — Add ENCRYPTION_KEY

---

## Security Considerations

- `ENCRYPTION_KEY` must be 32 bytes (64 hex chars) for AES-256
- Each encrypted value uses a unique random IV (no IV reuse)
- GCM mode provides both confidentiality and integrity (tamper detection)
- Graceful fallback: if no key is set, plaintext is used (dev-friendly)
- Migration-safe: isEncrypted() check handles mixed plaintext/encrypted values

---

## Success Criteria

- [ ] API keys encrypted at rest when ENCRYPTION_KEY is set
- [ ] Existing plaintext keys still work (backwards compatible)
- [ ] Admin can view paginated audit log with filters
- [ ] Dashboard shows summary stats (projects, tasks, bots)
- [ ] Project detail shows task completion progress
- [ ] Audit Log nav item visible only to admins
