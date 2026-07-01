# Cove — Work Log

> Maintained by Claude (lead/orchestrator). Updated each work cycle.  
> Last updated: 2026-06-30 | Current cycle: 32

---

## How agents report completion

**Do not edit WORKLOG.md directly.** Instead, write your status to `status/<your-name>.md` (e.g. `status/codex.md`, `status/antigravity.md`). The orchestrator reads all status files during the daily review and updates this log.

Your status file should contain:
- Task you completed (one line)
- Files you changed
- Whether `npm run typecheck && npm test` passed
- Any blockers or flags you noticed

The `status/` directory is always safe to write to — it is never a hot file.

---

## Hot files — do not edit without coordinating with Claude

These files are actively in flux or architecturally owned by the orchestrator. Touching them without explicit assignment risks merge conflicts and broken state.

| File | Reason |
|------|--------|
| `apps/web/src/App.tsx` | Claude active Cycle 32 (UI bug fixes + landing page wiring) |
| `services/core/src/app.ts` | **Codex active Cycle 32** — emoji endpoints, pagination, rate limit, presence |
| `services/core/src/index.ts` | Snapshot persistence settled — no active edits |
| `packages/contracts/src/protocol.ts` | Schema changes require Claude — `serverEmojiSchema` added Cycle 32, no further changes pending |
| `PRODUCT_PLAN.md` | Authoritative delivery record |
| `CLAUDE.md` | Orchestration rules |

> Note: `WORKLOG.md` is **not** hot — but write to `status/<name>.md` instead of editing it directly. The orchestrator reconciles status files into this log during the daily review.

---

## Completed — Cycle 31 (2026-06-30)

- ✅ Operator auth test stubs fixed (Bearer header, correct 200/401 expectations)
- ✅ Toast CSS cleanup (inline styles → className in App.tsx)
- ✅ Attention center panel
- ✅ Create/join space modal
- ✅ Bootstrap loading state

---

## In progress — Cycle 32 (2026-06-30)

### Vision update
Product direction changed 2026-06-30: friends-first before world-ready. Roadmap now prioritizes feel, polish, and customization over platform infrastructure. See PRODUCT_PLAN.md D-019.

### Claude — in progress

**UI bug fixes (from screenshot audit):**
- [ ] Fix "Sign In" button rendered for already-authenticated users — conditional render bug in bottom bar
- [ ] Remove "Comfortab" placeholder text from channel header top bar
- [ ] Fix attention panel orphaned × button layout
- [ ] Fix settings button placement (currently buried under user profile area)
- [ ] Remove hardcoded "Practice run · Tonight · 6 interested" event card (bootstrap state now handled — remove the static fallback)

**Landing page:**
- [ ] Marketing page at `/` — hero section, feature highlights (voice, communities, emoji, privacy), "Get Started" and "Sign In" CTAs; links to `/login` and `/register`
- [ ] `/login` route — clean sign-in form wired to existing auth endpoints
- [ ] `/register` route — sign-up form; post-register redirect to app

**pnpm migration:**
- [ ] Replace npm with pnpm across monorepo: add `pnpm-workspace.yaml`, remove `package-lock.json`, install with pnpm, update `package.json` scripts, update CLAUDE.md run instructions

---

### Codex — ready for next task

**Current task:** Document every env var in `services/core/.env.example`  
**Files:** `services/core/.env.example` only  
**Details:** Add a one-line `# comment` above each var: `HOST`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `WEB_DIST_DIR`, `CORS_ALLOWED_ORIGINS`, `OPERATOR_KEY`, `SNAPSHOT_FILE`. Run `npm run typecheck && npm test` before finishing; note that 2 operator auth tests may fail while Claude's Cycle 31 reconciliation is in flight — report the count either way.

**Queue — pick in order after current task:**

**Codex-2:** Custom server emoji — upload and list  
Files: `services/core/src/app.ts` + `packages/contracts/src/protocol.ts` (schema) + test  
Details: Add `POST /v1/communities/:id/emoji` (multipart, requires `community.manage`): accepts name + image file (PNG/GIF, max 256 KB), stores in attachment pipeline, returns `{ id, name, url }`. Add `GET /v1/communities/:id/emoji` (auth required): returns `{ emoji: Array<{id, name, url}> }`. Add `DELETE /v1/communities/:id/emoji/:emojiId` (requires `community.manage`). Add 3 tests: upload creates emoji; list returns it; delete removes it. Claude will wire into bootstrap and message renderer after.

**Codex-3:** Resend email integration  
Files: `services/core/src/app.ts`, `services/core/package.json`  
Details: Install `resend` package. Replace any stub/console-log email sends with real Resend API calls. Auth verify-code email: subject "Your Cove code is {{code}}", plain text body. Use `RESEND_API_KEY` env var; if absent, fall back to console.log (dev mode). Add `RESEND_API_KEY` and `EMAIL_FROM` (`noreply@cove.demonbox360.net`) to `.env.example`. No new tests needed beyond what exists; verify typecheck passes.

**Codex-4:** Message cursor pagination  
Files: `services/core/src/app.ts` + test  
Details: Add `before` (messageId) and `limit` (integer, default 50, max 200) query params to `GET /v1/channels/:id/messages`. Sort descending, slice at cursor. Return a `nextCursor` field (oldest messageId in the page, omit if page is full). Add 2 tests: paginated fetch returns correct slice; `limit` clamps at 200.

**Codex-5:** Server-side channel mute persistence  
Files: `services/core/src/app.ts` + test  
Details: Add `POST /v1/accounts/me/muted-channels` (body: `{ channelId: string }`) and `GET /v1/accounts/me/muted-channels` (returns `{ channelIds: string[] }`). Auth required. Store in an in-memory map keyed by accountId. Add 2 integration tests.

**Codex-6:** Rate limiting on message send  
Files: `services/core/src/app.ts` + `services/core/package.json` (if needed) + test  
Details: Check if `@fastify/rate-limit` is already in `package.json`; add if not. Apply `{ max: 10, timeWindow: '1s', keyGenerator: req => req.accountId ?? req.ip }` to `POST /v1/channels/:id/messages`. Return 429 with a `Retry-After` header. Add 1 test: rapid burst of 11 messages returns 429 on the 11th.

---

### Antigravity — in progress

**Current task:** Extract emoji picker into `apps/web/src/EmojiPicker.tsx`  
**Files:** `apps/web/src/EmojiPicker.tsx` (new) only — do NOT edit App.tsx  
**Details:** Props: `onSelect: (emoji: string) => void; onClose: () => void`. Extract the `emojiPickerMessageId === message.id` block (~line 1640 in App.tsx). Render 8 common emojis as buttons; clicking one calls `onSelect(emoji)`. Add `export default EmojiPicker`.

**Queue — pick in order after current task:**

**AG-2:** ErrorBoundary component  
Files: `apps/web/src/ErrorBoundary.tsx` (new), `apps/web/src/styles.css`  
Details: React class-based error boundary. Props: `children: React.ReactNode; fallback?: React.ReactNode`. On error: render `fallback` if provided, otherwise render a centered card: "Something went wrong", error message in a `<code>` block, and a "Reload" button. Add `.error-boundary` CSS. Do NOT edit App.tsx.

**AG-3:** UserAvatar component  
Files: `apps/web/src/UserAvatar.tsx` (new), `apps/web/src/styles.css`  
Details: `<UserAvatar src?: string; name: string; size?: 'sm' | 'md' | 'lg'; status?: 'online' | 'idle' | 'dnd' | 'offline' />`. Renders an `<img>` if `src` is set, otherwise a colored circle with the first letter of `name`. Status shows as a small colored dot (bottom-right corner). Export `UserAvatarProps`. Do NOT edit App.tsx.

**AG-4:** Skeleton component  
Files: `apps/web/src/Skeleton.tsx` (new), `apps/web/src/styles.css`  
Details: `<Skeleton width?: string; height?: string; className?: string />` — div with `.skeleton` class. Add `@keyframes shimmer` in styles.css: gradient sweep from `var(--surface)` to `var(--surface-raised)`, 1.5s infinite. Do NOT edit App.tsx.

**AG-5:** MessageList component  
Files: `apps/web/src/MessageList.tsx` (new)  
Details: Extract message list rendering from App.tsx. Props: `messages`, `currentUserId`, `onReact`, `onReply`, `onEmojiPickerOpen`, `emojiPickerMessageId`. Export `MessageListProps`. Do NOT edit App.tsx.

**AG-6:** Composer component  
Files: `apps/web/src/Composer.tsx` (new)  
Details: Extract the message composer (text input + reply bar). Props: `value`, `onChange`, `onSend`, `replyTo: { id: string; preview: string } | null`, `onCancelReply`, `disabled`. Export `ComposerProps`. Do NOT edit App.tsx.

**AG-7:** ChannelSidebar component  
Files: `apps/web/src/ChannelSidebar.tsx` (new)  
Details: Extract channel list sidebar. Props: `channels`, `activeChannelId`, `onSelectChannel`, `mutedChannelIds: Set<string>`, `onToggleMute`. Export `ChannelSidebarProps`. Do NOT edit App.tsx.

---

## Flags for orchestrator

- **Test spec mismatch (resolving Cycle 31):** Codex's Bearer auth implementation is correct per spec. The 2 failing tests used `x-operator-key` header. Claude fixing in Cycle 31.
- **Toast inline styles (resolving Cycle 31):** Deepseek flagged inline styles on toast container in App.tsx lines 2099–2121. CSS classes already exist in `styles.css`. Claude fixing in Cycle 31.
- **Antigravity Cycle 30 status file absent:** Backend reaction/reply tests are committed (git `e12122f`) — task is complete; status file was not written. No action needed.

---

## Priority queue

Claude pulls from here when agent work is integrated. Agents work from their own queues above.

### P0 — UI bugs (from screenshot audit 2026-06-30, Claude Cycle 32)
1. ✅ ~~Attention center panel~~ — done Cycle 31
2. ✅ ~~Create/join space modal~~ — done Cycle 31
3. ✅ ~~Bootstrap loading state~~ — done Cycle 31
4. **"Sign In" button shown for authenticated users** — conditional render bug, App.tsx bottom bar
5. **"Comfortab" placeholder text** — bleeds through in channel header top bar
6. **Attention panel orphaned × buttons** — layout needs a proper pass
7. **Settings button buried under user profile** — needs to be accessible
8. **Hardcoded event card** — remove the "Practice run" static fallback now that bootstrap handles loading

### P1 — Landing page (Claude Cycle 32)
9. **Marketing page at `/`** — hero, feature highlights, "Get Started" + "Sign In" CTAs
10. **`/login` route** — clean form wired to auth endpoints
11. **`/register` route** — sign-up form with post-register redirect

### P2 — Identity & customization
12. **User avatars** — upload, display name, profile card on click
13. **Custom status** — text + emoji, shows in presence display
14. **Custom server emoji** — Codex-2 builds backend; Claude wires message renderer + emoji picker
15. **Themes & appearance** — dark/light toggle + accent color + presets

### P3 — Core messaging polish
16. **Rich link embeds** — YouTube, Twitter/X, images, OG tags unfurl inline
17. **File & image uploads** — drag-drop, inline previews
18. **Pinned messages** — mod-accessible, shown in channel header
19. **Message search** — keyword search within channel
20. **React error boundary** — AG-2 builds; Claude wires into App.tsx
21. **Bootstrap failure UX** — full-screen retry with countdown, not silent demo
22. **Frontend error reporting** — `window.onerror` → `showToast()`

### P2 — Architecture
7. **App.tsx component extraction** (multi-step — Antigravity builds, Claude wires):
   - MessageList.tsx → AG-4
   - Composer.tsx → AG-5
   - ChannelSidebar.tsx → AG-6
   - CommunityRail.tsx → AG-7
   - VoicePanel.tsx → future AG queue
   - AttentionPanel.tsx → future AG queue (after Claude builds the panel)

### P3 — Features
8. **Passkey auth UI** — WebAuthn browser-side form. Backend routes exist at `/v1/auth/passkey/*`. New `PasskeyFlow.tsx` component + wiring in App.tsx sign-in modal.
9. **Community settings panel** — `<ChevronDown>` on community header: modal with name edit (`PATCH /v1/communities/:id`), channel list management, member list with role assignment.
10. **Guided report flow** — Multi-step modal: select report type → context → submit to `POST /v1/reports`. Phase 3 per product plan.
11. **Attachment approval UX** — Uploads stuck in "pending" quarantine need an admin approve/reject button. Backend quarantine route exists; needs UI badge + action.
12. **User profile panel** — Click on username/avatar → side panel with display name, presence status, roles in this community, and DM button placeholder.
13. **Member list sidebar** — Right-side panel listing community members grouped by role with online/offline presence. `GET /v1/communities/:id/members` exists.
14. **Channel topic/description** — Add `topic` field to channel create/edit; show below channel header. Small schema + backend + UI change.
15. **Notification preference panel** — Per-channel settings beyond mute: all-messages, @mention-only, nothing. Requires Codex backend + AG component.
16. **DM channels** — Direct messaging between two users. New channel `kind: 'dm'`, private to participants. Backend schema change (Claude) + routes (Codex) + UI (AG).
17. **Server-side notification mute persistence** — Codex queue covers the API; after Codex-2 ships, wire the fetch into bootstrap and sync localStorage.

### P4 — Other agents (Kimi, Deepseek, Qwen, etc.)
Safe for any agent regardless of codebase familiarity. Read `CLAUDE.md` before starting. Write output to `status/<agent-name>.md`. Do not edit any source files unless the task explicitly says to.

- **Test coverage gap report** — List every HTTP route registered in `services/core/src/app.ts` that has no corresponding test in `app.test.ts`. Do not add tests. Report in status file.
- **Dead import scan** — Check `apps/web/src/App.tsx` imports against what's actually used. List any unused symbols. Do not edit the file. Report in status file.
- **Bundle size report** — Run `npm run build` and report JS/CSS gzip sizes per workspace. Flag any that have grown >5% since the baseline in PRODUCT_PLAN.md (215.52 kB gzip JS / 5.09 kB gzip CSS for web). Report in status file.
- **Dependency audit report** — Run `npm audit` and summarize all findings by severity. Do not run `npm audit fix`. Report in status file.
- **packages/ui audit** — List what's in `packages/ui/src/`, what's exported, and what's actually imported anywhere in the repo. Flag anything exported but unused, or used directly bypassing the package. Report in status file.
- **Spell-check and prose cleanup** — Scan `PRODUCT_PLAN.md`, `README.md`, and `CLAUDE.md` for typos, awkward phrasing, stale references. Propose changes in status file; do not edit.
- **status/ directory cleanup** — List all files in `status/` older than Cycle 31. Suggest which ones can be archived or cleared. Do not delete anything. Report in status file.
- **PRODUCT_PLAN.md quality gate audit** — For every work-item with status `verified`, check that a test count and build-size snapshot are recorded. Flag any that are missing. Report in status file.

### P5 — Deferred by design
- Sealed E2EE (awaiting MLS external review — D-004)
- Native mobile (Phase 5)
- Federation (Year 2+)
- Full-text message search (use `/messages/search` stub once PostgreSQL FTS is configured)

---

## Integration protocol

When an agent writes to `status/<name>.md`:
1. Orchestrator reads the file during daily review
2. Runs `npm run typecheck && npm test`
3. Verifies Definition of Done (CLAUDE.md)
4. Updates this WORKLOG — marks done or flags revision needed
5. Assigns next task from the agent's queue

---

## Cycle history

| Cycle | What shipped |
|-------|-------------|
| 32 | Vision pivot (friends-first, D-019–D-023), custom emoji endpoints + Resend email (Codex), ErrorBoundary + UserAvatar components (AG), operator auth test fix, emoji content test, 152 tests green |
| 31 | Operator auth test fix, toast CSS cleanup, attention panel, create/join modal, bootstrap loading state |
| 30 | Foundation repair: community switching, reactions, replies, WS reconnect, snapshot persistence, error toasts, orchestration setup |
| 29 | Attention controls: mark-all-read, dismiss, channel mute |
| 28 | `reconcileParticipantRole` export, stage UI test coverage |
| 27 | Web client voice/stage LiveKit integration, screen share track publication |
| 26 | LiveKit media provider integration |
| 25 | Stage channel UI, hover peek, screen-share badges, desktop PTT |
| 24 | Stage speaking permission gate |
| 23 | Stage broadcast subchannels, hover-to-eavesdrop, screen-share contracts |
| 22 | Authenticated web session/bootstrap, voice participant reconciliation |
| 21 | Community export, web audit log panel |
| 1–20 | See PRODUCT_PLAN.md session checkpoints |
