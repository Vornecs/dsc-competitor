# Cove — Work Log

> Maintained by Claude (lead/orchestrator). Updated each work cycle.  
> Last updated: 2026-06-30 | Current cycle: 30

---

## Hot files — do not edit without coordinating with Claude

| File | Owner | Status |
|------|-------|--------|
| `apps/web/src/App.tsx` | Claude | Heavy edits Cycle 30 — settling |
| `services/core/src/index.ts` | Claude | Snapshot persistence added Cycle 30 |
| `packages/contracts/src/protocol.ts` | Claude | Schema changes require full-stack coordination |
| `PRODUCT_PLAN.md` | Claude | Authoritative delivery record |
| `WORKLOG.md` | Claude | This file |
| `CLAUDE.md` | Claude | Orchestration rules |

---

## In progress — Cycle 30 (2026-06-30)

### Claude — completed
- [x] Community switching (`onClick` on rail buttons, `switchCommunity()`)
- [x] Reactions wired end-to-end (`toggleReaction()`, PUT/DELETE to server)
- [x] Emoji picker for React button (inline popup, 8 common emojis)
- [x] Reply flow (state, composer bar, `replyToId` in POST body)
- [x] Channel message fetch on channel/community switch
- [x] WebSocket exponential backoff reconnection (1s → 30s cap, resets on READY)
- [x] Error toast system (`showToast()`, 4s auto-dismiss)
- [x] Connection banner when disconnected while logged in
- [x] `submitMessage` no longer collapses connection state on failure
- [x] Snapshot persistence (`SNAPSHOT_FILE` env var, 30s autosave, save-on-shutdown)
- [x] CLAUDE.md development guidelines + Definition of Done
- [x] WORKLOG.md (this file)
- [x] Daily orchestration routine scheduled (9 AM)

### Codex — in progress
**Task:** Guard the operator endpoints against unauthenticated access  
**Files:** `services/core/src/app.ts` only — no other files  
**Details:**
- Routes `POST /v1/operator/backup` and `POST /v1/operator/restore` (around line 3475) have no auth check
- Add a guard: read `process.env.OPERATOR_KEY`; if set, require `Authorization: Bearer <OPERATOR_KEY>` on both endpoints; if the header is missing or wrong, return 401
- If `OPERATOR_KEY` is not set in env, log a startup warning (not an error — local dev doesn't need it) but still allow the endpoints (they're internal tooling)
- No schema changes, no new files needed
- Run `npm run typecheck && npm test` before committing
- Mark this task "complete — pending review" in WORKLOG.md when done

**Next task (after above):** Create `services/core/.env.example`  
Document every env var the server reads: `HOST`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `WEB_DIST_DIR`, `CORS_ALLOWED_ORIGINS`, `OPERATOR_KEY`, `SNAPSHOT_FILE`. Include a one-line comment on each explaining what it does and when it's required.

### Antigravity — complete — pending orchestrator review
**Task:** Write backend tests for reactions and the reply flow  
**Files:** `services/core/src/app.test.ts` only — no other files  
**Details:** Added new backend tests covering the reactions lifecycle (PUT/DELETE/deleted message check) and reply flow (replyPreview and invalid cross-channel reply check).
- Add a test block for reactions: `PUT /v1/channels/:id/messages/:id/reactions` (add emoji), then `DELETE` same endpoint (remove emoji); verify reaction count changes; verify you can't react to a deleted message
- Add a test block for replies: send a message with `replyToId` pointing to a prior message; verify `replyPreview` comes back on the response; verify an invalid `replyToId` (wrong channel) returns 400
- Follow the exact same test helper patterns already used in `app.test.ts` (look at how auth, community setup, and channel setup are done in existing tests)
- Run `npm test` to confirm all existing tests still pass and new ones are green
- Mark this task "complete — pending review" in WORKLOG.md when done

**Next task (after above):** Create `apps/web/src/EmojiPicker.tsx` as a standalone component  
Extract the inline emoji picker from `App.tsx` (the `emojiPickerMessageId === message.id` block around line 1640) into its own file. Accept props: `onSelect: (emoji: string) => void; onClose: () => void`. Do NOT edit `App.tsx` — Claude will swap the import. New file only.

---

## Flags for orchestrator

- Test count discrepancy: PRODUCT_PLAN reports 132 tests (19 web) but `App.test.tsx` appears to have only 1 test. Investigate on next review — either the web test count in the plan is wrong or there are additional test files not found in initial exploration.
- Codex's operator endpoints tests ('supports operator backup and restore drill' and 'rejects operator backup and restore without the configured operator key') are currently failing. This is expected as Codex's task to guard these endpoints is currently in progress.

---

## Priority queue — what comes next

Claude picks from this list after integrating Cycle 30 + Codex/Antigravity work.

### P0 — Functional gaps users hit immediately
1. **Attention center panel** — Inbox `<Inbox>` button exists, no panel. Attention items are tracked and in state; just need the drawer/panel UI to show and dismiss them. (`App.tsx`)
2. **"Create or join a space" modal** — `<Plus>` on the community rail has no handler. Need a modal: create community (name, accent) or join by invite code. (`App.tsx`)
3. **Bootstrap loading skeleton** — App shows fake "Ember Party" demo community for ~200ms before real data loads. Replace with a loading state that shows nothing until the first bootstrap fetch resolves. (`App.tsx`)
4. **Remove hardcoded event card** — "Practice run · Tonight · 6 interested" is static markup at line ~1147. Remove until events are a real feature.

### P1 — Reliability
5. **React error boundary** — No `<ErrorBoundary>` in the tree. A thrown exception white-screens with no recovery. New component file + small `App.tsx` addition.
6. **Bootstrap failure UX** — Auth'd user, server down: silent demo data. Should be a full-screen "Can't reach server — retry" state.

### P2 — Architecture
7. **App.tsx component extraction** — 1961 lines, one component. Extract: `MessageList`, `Composer`, `ChannelSidebar`, `CommunityRail`, `VoicePanel`. Prerequisite for testability.
8. **Frontend error reporting** — Errors are `console.error` only. Wire `window.onerror` → `showToast`.

### P3 — Features
9. **Passkey auth UI** — Backend WebAuthn routes exist. Need browser-side attestation/assertion form. New component.
10. **Community settings panel** — `<ChevronDown>` on community header has no handler. Edit name/accent, role management, invite management, export trigger.
11. **Guided report flow** — Phase 3 per product plan.
12. **Attachment approval UX** — Uploads stuck in "pending" quarantine; no operator UI.

### P4 — Deferred by design
- Sealed E2EE (awaiting MLS external review — D-004)
- Native mobile (Phase 5)
- Federation (Year 2+)
- Full-text search

---

## Integration protocol

When Codex or Antigravity marks a task "complete — pending review":
1. Claude reads the diff in the next daily orchestration run
2. Runs `npm run typecheck && npm test` — must be green
3. Verifies all 9 items in the Definition of Done (CLAUDE.md)
4. Merges or requests revision with specific notes
5. Updates this WORKLOG accordingly

---

## Cycle history

| Cycle | What shipped |
|-------|-------------|
| 30 | Foundation repair: community switching, reactions, replies, WS reconnect, snapshot persistence, error toasts, orchestration setup |
| 29 | Attention controls: mark-all-read, dismiss, channel mute |
| 28 | `reconcileParticipantRole` export, stage UI test coverage |
| 27 | Web client voice/stage LiveKit integration, screen share tracks |
| 26 | LiveKit media provider integration |
| 25 | Stage channel UI, hover peek, screen-share badges, desktop PTT |
| 24 | Stage speaking permission gate |
| 23 | Stage broadcast subchannels, hover-to-eavesdrop, screen-share contracts |
| 22 | Authenticated web session/bootstrap, voice participant reconciliation |
| 21 | Community export, web audit log panel |
| 1–20 | See PRODUCT_PLAN.md session checkpoints |
