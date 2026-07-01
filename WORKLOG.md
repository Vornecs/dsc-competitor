# Cove — Work Log

> Maintained by Claude (lead/orchestrator). Updated each work cycle.  
> Last updated: 2026-07-01 | Current cycle: 34

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
| `apps/web/src/App.tsx` | **Claude active Cycle 34** — wiring MessageList/Composer/ChannelSidebar/Skeleton/EmojiPicker/UserAvatar (all built, still unwired), channel-creation UI, first-run empty-space onboarding view |
| `services/core/src/app.ts` | **Codex active Cycle 34** — rate limiting (Codex-6), pinned messages (Codex-8), new attention-persistence endpoints (Codex-9). Claude made two more surgical fixes this cycle (see Completed section): message pagination + mute persistence (previously assigned as Codex-4/5, shipped by Claude directly to unblock Cycle 33), and the demo-data bootstrap leak fix. Pull latest before starting. |
| `services/core/src/index.ts` | Snapshot persistence settled — no active edits |
| `packages/contracts/src/protocol.ts` | Schema changes require Claude — `serverEmojiSchema` added Cycle 32, no further changes pending |
| `PRODUCT_PLAN.md` | Authoritative delivery record |
| `CLAUDE.md` | Orchestration rules |

> Note: `WORKLOG.md` is **not** hot — but write to `status/<name>.md` instead of editing it directly. The orchestrator reconciles status files into this log during the daily review.

---

## Completed — Cycle 33 (2026-06-30 – 2026-07-01)

- ✅ Landing page gated on `sessionToken`: unauthenticated users see `Landing.tsx` (marketing page + "Get Early Access"/"Sign In" both opening the existing email-code modal); demo/preview bootstrap fully removed from the authenticated code path
- ✅ Bootstrap now starts from a `LOADING_BOOTSTRAP` placeholder instead of `demoBootstrap`, closing the last place fake data could flash on screen for a real session
- ✅ Community creation and invite-join responses now include `channels`, merged into `bootstrap.channels` client-side; `EMPTY_CHANNEL_PLACEHOLDER` prevents a render crash for a zero-channel community
- ✅ **Verified live** (curl against the running dev server, 2026-07-01): `POST /v1/communities` returns `201` with a default `general` channel included — the "creating a server shows an error" report from the operator note is fixed
- ✅ Message cursor pagination shipped (Codex-4 spec): `before`/`limit` query params on `GET /v1/channels/:id/messages`, sorted newest-first, `nextCursor` in the response, clamped at 200; 2 new tests
- ✅ Server-side muted-channel persistence shipped (Codex-5 spec): `POST`/`GET /v1/accounts/me/muted-channels`, in-memory per-account map, auth required; 2 new tests
- ✅ **Bug: demo data leaked into every brand-new account** — `GET /v1/bootstrap` fell back to `demoBootstrap.communities/channels/messages` whenever a real account had zero community memberships, so new sign-ups landed inside the fake "nightshift" space with pre-existing messages instead of a genuinely empty account (this is what the operator note meant by "when a user signs in, they shouldn't be added to a demo account"). Fixed: real (empty) arrays are returned with sentinel `activeCommunityId`/`activeChannelId`; **verified live** — a fresh `@test.cove.chat` account now bootstraps with `communities: []`. Frontend already falls back gracefully (no crash) via the Cycle 33 placeholder logic above, but there's no proper "create your first space" prompt yet — see Cycle 34 queue below.
- ✅ Skeleton, MessageList, Composer, ChannelSidebar components built with full unit test suites (AG-4/5/6/7); `.select-control` overflow fix for the Density/Theme dropdowns (AG-8) — all committed (`43862b3`), **still unwired into App.tsx**
- ✅ 174 tests passing (86 core + 50 web + 24 contracts + 14 desktop), typecheck clean across all workspaces

---

## In progress — Cycle 34 (2026-07-01)

### Claude — in progress

**Wire built-but-unwired components into App.tsx (carried over, growing list):**
- [ ] `EmojiPicker.tsx` → message reaction/composer flow
- [ ] `UserAvatar.tsx` → message author display + user dock
- [ ] `Skeleton.tsx` → loading placeholders (replace ad-hoc loading markup)
- [ ] `MessageList.tsx`, `Composer.tsx`, `ChannelSidebar.tsx` → extract corresponding inline JSX out of `App.tsx` in favor of the built components (shrinks the 2100+ line file substantially)

**New from this cycle's live verification + operator note:**
- [ ] **Channel-creation UI** — backend route already exists and works (`POST /v1/communities/:communityId/channels`, owner/admin only, `services/core/src/app.ts:2466`); there is no button/modal to call it. This is why servers with few channels have no way to add more.
- [ ] **First-run empty-space onboarding view** — now that `GET /v1/bootstrap` correctly returns `communities: []` for new accounts (fixed this cycle) instead of injecting demo data, the frontend needs an actual "create or join your first space" screen for that state (`bootstrap.activeCommunityId === 'no-community'`) instead of falling through to the anonymous loading-placeholder community.
- [ ] **Empty/short channel-list layout bug** — reported by operator: on communities with 0-1 channels, the bottom user dock (mute/settings/etc.) grows upward and overlaps the channel list. Root cause not yet isolated — likely a flex/height rule assuming a minimum channel-list height. Needs a CSS pass once channel-creation UI exists to test against (can't fully verify the empty case without it).
- [ ] Fix attention panel orphaned × button layout
- [ ] Fix settings button placement (currently buried under user profile area)
- [ ] Remove hardcoded "Practice run · Tonight · 6 interested" event card

**pnpm migration:**
- [ ] Replace npm with pnpm across monorepo: add `pnpm-workspace.yaml`, remove `package-lock.json`, install with pnpm, update `package.json` scripts, update CLAUDE.md run instructions

---

### Codex — ready for next task

**Current task:** Rate limiting on message send (Codex-6)  
**Files:** `services/core/src/app.ts` + `services/core/package.json` (if needed) + test  
**Details:** Check if `@fastify/rate-limit` is already in `package.json`; add if not. Apply `{ max: 10, timeWindow: '1s', keyGenerator: req => req.accountId ?? req.ip }` to `POST /v1/channels/:id/messages`. Return 429 with a `Retry-After` header. Add 1 test: rapid burst of 11 messages returns 429 on the 11th.

**Note:** Codex-4 (message pagination) and Codex-5 (mute persistence) from your previous queue are already shipped — Claude implemented both directly this cycle to unblock the landing-page work that depended on a stable `app.ts`. Pull latest before starting; your local `app.ts` is stale.

**Queue — pick in order after current task:**

**Codex-7:** Fill the one test-coverage gap Kimi flagged (P4 report, Cycle 32)  
Files: `services/core/src/app.test.ts` only  
Details: `GET /v1/communities/:communityId/emoji/:emojiId/content` (serves binary emoji content) has no direct test — the existing upload test only asserts the returned `url` *contains* the path. Add a test that actually fetches the endpoint and checks the response body/content-type match what was uploaded.

**Codex-8:** Pinned messages backend (P3 item 18)  
Files: `services/core/src/app.ts` + `packages/contracts/src/protocol.ts` (flag Claude if a schema change is needed) + test  
Details: Add `POST /v1/channels/:id/messages/:messageId/pin` and `DELETE /v1/channels/:id/messages/:messageId/pin` (requires `message.manage` or channel-admin permission). Add `GET /v1/channels/:id/pinned` returning pinned messages newest-first. Add 3 tests: pin, unpin, list.

**Codex-9:** Server-side attention/notification persistence (new — P0, from operator note)  
Files: `services/core/src/app.ts` + `packages/contracts/src/protocol.ts` (flag Claude if a schema change is needed) + test  
Details: Attention items (`bootstrap.attention`) are currently always `[]` on bootstrap and mark-as-read/dismiss (`App.tsx` `markAllAttentionRead`/`dismissAttentionItem`) only mutate client state — they reset on every bootstrap refetch/reconnect, which reads to the user as "the mark-as-read button does nothing." Add `GET /v1/accounts/me/attention` (returns items, most recent first, capped at 100), `POST /v1/accounts/me/attention/:id/read`, `POST /v1/accounts/me/attention/:id/dismiss`, `POST /v1/accounts/me/attention/read-all`. Persist in an in-memory map keyed by accountId, capped at 100 items (oldest dropped past the cap — also addresses the operator's "no limit on notifications" concern). Wire into `GET /v1/bootstrap` so it returns real items instead of `[]`. Add 4 tests covering read/dismiss/read-all/cap behavior. Flag Claude for the App.tsx wiring once this ships.

---

### Antigravity — in progress

**Current task:** New-channel modal component (AG-9)  
**Files:** `apps/web/src/NewChannelModal.tsx` (new), unit tests  
**Details:** A modal for community owners/admins to create a channel — matches the backend contract at `POST /v1/communities/:communityId/channels` (`services/core/src/app.ts:2466`, see `createChannelRequestSchema` in `packages/contracts/src/protocol.ts` for the exact fields: `name`, `kind`, `category`, `topic?`, `privacy?`). Props: `open`, `onClose`, `onCreate: (payload) => Promise<void>`, `loading`, `error`. Do NOT edit App.tsx — Claude wires it in once built (this closes the "no way to create channels" gap from the operator note).

**Queue — pick in order after current task:**

**AG-10:** AttentionPanel.tsx extraction  
Files: `apps/web/src/AttentionPanel.tsx` (new), unit tests  
Details: Extract the attention/notification preview section (`App.tsx` ~line 2040-2110: header with "Mark all read", list of items with mute/dismiss actions) into a standalone component. Props: `items`, `mutedChannelIds`, `onMarkAllRead`, `onDismiss`, `onToggleMute`. Export `AttentionPanelProps`. Do NOT edit App.tsx.

**AG-11:** Empty/short channel-list layout fix  
Files: `apps/web/src/styles.css` or `Landing.css` (CSS only — check which stylesheet currently owns `.channel-list`/user-dock rules before choosing)  
Details: Operator-reported bug: when a community has 0-1 channels, the bottom user dock (mute/settings/profile) grows upward and overlaps the channel sidebar. Add a `min-height` to the channel-list container or `flex-shrink: 0` to the user dock so it stays pinned to the bottom regardless of channel-list content height. Do NOT edit App.tsx — class names already exist.

**AG-12:** VoicePanel.tsx extraction  
Files: `apps/web/src/VoicePanel.tsx` (new), unit tests  
Details: Extract the voice/stage participant panel rendering from `App.tsx` into a standalone component (mirrors the AG-5/6/7 extraction pattern). Export `VoicePanelProps`. Do NOT edit App.tsx.

---

## Flags for orchestrator

- **Route/response contract drift is a recurring bug class:** two of the three P0 bugs this cycle (community creation, invite join) were frontend `fetch()` calls that didn't match the backend route or response shape. The P4 audit task below (still unclaimed) exists to catch this systematically.
- **A third instance of the same bug class surfaced this cycle:** the bootstrap demo-data leak wasn't a contract mismatch, but the same root cause — a backend fallback path nobody had exercised with a real zero-community account. Consider adding "test the empty/zero state, not just the happy path" to the P4 audit scope.
- **EmojiPicker, UserAvatar, Skeleton, MessageList, Composer, ChannelSidebar are all built-but-unwired** — six components now, growing each cycle. Claude's Cycle 34 queue above tackles the wiring; this needs to actually happen next cycle rather than be pushed again, or "component built" will keep outpacing "component wired."
- **`/register` route and path-based channel URLs are both unresolved routing decisions.** The operator note this cycle asked for real paths (`cove.demonbox360.net/[server]/[channel]`), which is the same underlying decision as the `/register` route: the app has no client router today. Recommending React Router be adopted in Cycle 35 — it would resolve both asks at once (deep-linkable channels + a real `/register` path) rather than continuing to bolt state-based workarounds onto a single-page shell. Flagging for explicit go-ahead rather than starting a router migration unprompted.
- **Employee/staff/admin user type** — operator flagged this as a longer-term want, not urgent. Added to P3 backlog (item 34) rather than scheduled; needs a role-model decision (separate from community-level roles) before scoping.
- **Antigravity Cycle 30 status file absent:** Backend reaction/reply tests are committed (git `e12122f`) — task is complete; status file was not written. No action needed.

---

## Priority queue

Claude pulls from here when agent work is integrated. Agents work from their own queues above.

### P0 — UI bugs and broken flows
1. ✅ ~~Attention center panel~~ — done Cycle 31
2. ✅ ~~Create/join space modal~~ — done Cycle 31
3. ✅ ~~Bootstrap loading state~~ — done Cycle 31
4. ✅ ~~"Sign In" button shown for authenticated users~~ — moot, resolved by the landing-page gate (Cycle 33)
5. ✅ ~~"Comfortab" placeholder text~~ — done Cycle 33 (AG-8, `.select-control` overflow fix, committed)
6. **Attention panel orphaned × buttons** — layout needs a proper pass — Claude Cycle 34 queue
7. **Settings button buried under user profile** — needs to be accessible — Claude Cycle 34 queue
8. **Hardcoded event card** — remove the "Practice run" static fallback — Claude Cycle 34 queue
8a. ✅ ~~Blank screen on community creation~~ — done Cycle 33 (default channel + fallback placeholder)
8b. ✅ ~~"Join a space" 404/crash~~ — done Cycle 33 (URL + response contract fix)
8c. ✅ ~~Demo data leaked into new accounts~~ — done Cycle 33 (bootstrap fix, verified live)
8d. **No UI to create channels** — backend route exists and works; frontend has no entry point. Assigned AG-9 (component) + Claude (wiring).
8e. **Empty/short channel-list pushes the user dock up** — CSS layout bug. Assigned AG-11.
8f. **No first-run onboarding for zero-community accounts** — Claude Cycle 34 queue.
8g. **Attention mark-as-read/dismiss don't persist** — client-state only, reset on bootstrap refetch. Assigned Codex-9 (backend) + Claude (wiring once shipped).

### P1 — Landing page & routing
9. ✅ ~~Marketing page at `/`~~ — done Cycle 33 (`Landing.tsx`)
10. ✅ ~~Sign-in flow~~ — done Cycle 33 (reused existing modal; no separate `/login` route since there's no router)
11. **`/register` route + path-based channel URLs** — both blocked on the same routing decision (adopt React Router vs. continue modal/state-only). Recommending React Router for Cycle 35 — see Flags above; needs explicit go-ahead.

### P2 — Identity & customization
12. **User avatars** — `UserAvatar.tsx` built (AG-3) but not wired into message authors / user dock yet — Claude Cycle 34 queue
13. **Custom status** — text + emoji, shows in presence display
14. **Custom server emoji** — backend done (Codex-2); still needs Claude to wire message renderer + `EmojiPicker.tsx` (also already built, unwired) — Claude Cycle 34 queue
15. **Themes & appearance** — dark/light toggle + accent color + presets

### P3 — Core messaging polish
16. **Rich link embeds** — YouTube, Twitter/X, images, OG tags unfurl inline
17. **File & image uploads** — drag-drop, inline previews
18. **Pinned messages** — mod-accessible, shown in channel header. Backend assigned Codex-8.
19. **Message search** — keyword search within channel
20. ✅ ~~React error boundary~~ — component built Cycle 32 (AG-2), wired into `main.tsx` Cycle 33
21. **Bootstrap failure UX** — full-screen retry with countdown, not silent demo
22. **Frontend error reporting** — `window.onerror` → `showToast()`

### P2 — Architecture
23. **App.tsx component extraction** (multi-step — Antigravity builds, Claude wires):
   - EmojiPicker.tsx → AG-1 ✅ built, unwired
   - ErrorBoundary.tsx → AG-2 ✅ built, wired
   - UserAvatar.tsx → AG-3 ✅ built, unwired
   - Skeleton.tsx → AG-4 ✅ built, unwired
   - MessageList.tsx → AG-5 ✅ built, unwired
   - Composer.tsx → AG-6 ✅ built, unwired
   - ChannelSidebar.tsx → AG-7 ✅ built, unwired
   - NewChannelModal.tsx → AG-9 (current)
   - AttentionPanel.tsx → AG-10
   - VoicePanel.tsx → AG-12

### P3 — Features
24. **Passkey auth UI** — WebAuthn browser-side form. Backend routes exist at `/v1/auth/passkey/*`. New `PasskeyFlow.tsx` component + wiring in App.tsx sign-in modal.
25. **Community settings panel** — `<ChevronDown>` on community header: modal with name edit (`PATCH /v1/communities/:id`), channel list management, member list with role assignment.
26. **Guided report flow** — Multi-step modal: select report type → context → submit to `POST /v1/reports`. Phase 3 per product plan.
27. **Attachment approval UX** — Uploads stuck in "pending" quarantine need an admin approve/reject button. Backend quarantine route exists; needs UI badge + action.
28. **User profile panel** — Click on username/avatar → side panel with display name, presence status, roles in this community, and DM button placeholder.
29. **Member list sidebar** — Right-side panel listing community members grouped by role with online/offline presence. `GET /v1/communities/:id/members` exists.
30. **Channel topic/description** — Add `topic` field to channel create/edit; show below channel header. Small schema + backend + UI change.
31. **Notification preference panel** — Per-channel settings beyond mute: all-messages, @mention-only, nothing. Requires Codex-9 (attention persistence) to ship first.
32. **DM channels** — Direct messaging between two users. New channel `kind: 'dm'`, private to participants. Backend schema change (Claude) + routes (Codex) + UI (AG).
33. **Server-side notification mute persistence** — ✅ done Cycle 33 (Codex-5); needs the fetch wired into bootstrap and synced with localStorage — Claude Cycle 34 queue candidate.
34. **Staff/admin user type** — long-term want from operator (2026-07-01), for platform-level management/moderation distinct from per-community roles. No scoping done yet — needs a role-model decision first.

### P4 — Other agents (Kimi, Deepseek, Qwen, etc.)
Safe for any agent regardless of codebase familiarity. Read `CLAUDE.md` before starting. Write output to `status/<agent-name>.md`. Do not edit any source files unless the task explicitly says to.

- ✅ ~~Test coverage gap report~~ — done Cycle 32 (Kimi); 1 gap found, assigned Codex-7
- ✅ ~~Dead import scan~~ — done Cycle 32 (Deepseek); clean at time of scan
- ✅ ~~Spell-check and prose cleanup~~ — done Cycle 32 (Vibe); no critical issues, test count already fixed
- **Bundle size report** — Run `npm run build` and report JS/CSS gzip sizes per workspace. Flag any that have grown >5% since the baseline in PRODUCT_PLAN.md. Report in status file.
- **Dependency audit report** — Run `npm audit` and summarize all findings by severity. Do not run `npm audit fix`. Report in status file.
- **packages/ui audit** — List what's in `packages/ui/src/`, what's exported, and what's actually imported anywhere in the repo. Flag anything exported but unused, or used directly bypassing the package. Report in status file.
- **status/ directory cleanup** — List all files in `status/` older than Cycle 32. Suggest which ones can be archived or cleared. Do not delete anything. Report in status file.
- **PRODUCT_PLAN.md quality gate audit** — For every work-item with status `verified`, check that a test count and build-size snapshot are recorded. Flag any that are missing. Report in status file.
- **Frontend/backend route contract audit** — For every `fetch(`${API_BASE}/v1/...`)` call in `apps/web/src/App.tsx`, find the matching route registration in `services/core/src/app.ts` (same path template and HTTP method) and confirm the response shape the frontend destructures actually matches what the backend sends (status code included — watch for `204`/no-body routes being `.json()`-parsed, and for backend fallback paths that only trigger on empty/zero state — that's how the Cycle 33 demo-data leak slipped through). Report every mismatch found, with file:line for both sides. Do not edit source files — report only.

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
| 34 | (in progress) |
| 33 | Landing page gated on session token, demo/preview bootstrap fully removed from the authenticated path; fixed three P0 bugs verified live (community-creation blank screen, broken invite-join flow, demo-data leak into new accounts); message pagination + mute persistence shipped; Skeleton/MessageList/Composer/ChannelSidebar components built (unwired); 174 tests green |
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
