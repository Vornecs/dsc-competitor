# Cove Product Plan

> Last updated: 2026-07-01 | Cycle: 34 | Phase: 2b — Polish & Identity | Build health: verified; 174 tests passing (86 core + 50 web + 24 contracts + 14 desktop); strict TypeScript clean
>
> Current objective: Build an app you and your friends actually want to use. Phase 2b pivots from platform infrastructure to product feel — landing page, UI bug fixes, custom server emoji, user profiles, rich embeds, file upload previews, and appearance customization. Deploying to cove.demonbox360.net on Oracle Cloud via Caddy. Migrating monorepo from npm to pnpm.
>
> Vision update (2026-06-30): friends-first before world-ready. Cove should be fun and feel like yours before it's a production platform. Polish, customization, and depth now drive the roadmap.

This file is the authoritative product, architecture, and delivery record. A behavior or scope change is incomplete until this file is reconciled in the same work cycle.

## Product contract

### Promise

The fastest, clearest place for friends to hang out — without ads, surveillance, unstable interfaces, or hostage data. Built friends-first: it should be fun and feel like *yours* before it's ready for the world.

### Launch boundary

- Gaming friend groups and private gaming communities; invite-first and 16+.
- Windows desktop and web first; native mobile and federation are deferred.
- No explicit sexual content or graphic gore during alpha and beta.
- Community-funded capacity and storage; core communication quality is never an individual premium feature.
- Open clients, protocol, shared contracts, and community server; hosted operations first and supported self-hosting later.
- No ads, sponsored quests, behavioral profiling, streaks, boosts, infinite feeds, phone-number requirement, or generative-model training on user content.

### Product principles

1. Preserve low-friction, persistent social presence.
2. Prefer stable, information-dense, accessible interaction over novelty.
3. Make privacy and retention visible at the point of use.
4. Make permission denials explainable and moderation appealable.
5. Make reporting feel safe, guided, and low-friction — never intimidating or punitive to the reporter.
6. Keep data portable and deletion self-service.
7. Use audited protocols and maintained media infrastructure; never invent cryptography.
8. Ship narrow vertical slices behind measured quality gates.

### Initial success measures

- Invite to first message: median under 60 seconds.
- Invite to first voice join: median under 2 minutes.
- Same-region message acknowledgement: under 250 ms p95.
- Warm voice connection: under 2 seconds p95.
- Short-interruption media recovery: under 5 seconds p95.
- Public-beta desktop crash-free sessions: 99.9%.
- WCAG 2.2 AA for primary flows.
- North star: a weekly group with at least 3 members, 30 combined voice minutes, and 10 human messages.

## Evidence ledger

| ID    | Finding                                                                                                                                                                             | Evidence                                                                                                                                                                                                                                                                                                                                        | Confidence                         | Product consequence                                                                                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-001 | Persistent themed spaces, autonomy, shared activities, and casual interaction support digital third-place behavior.                                                                 | [Third-place research](https://arxiv.org/abs/2501.09951)                                                                                                                                                                                                                                                                                        | Medium-high                        | Voice rooms and recognizable community structure are core, not optional.                                                                                                                     |
| E-002 | Discord reports more than 200M monthly active users and 1.9B monthly PC gaming hours.                                                                                               | [Discord usage statement](https://discord.com/press-releases/discord-launches-orbs-globally)                                                                                                                                                                                                                                                    | High                               | Migration friction and network effects must be treated as product risks.                                                                                                                     |
| E-003 | Users report UI churn, contrast/accessibility issues, wasted space, and resource regressions.                                                                                       | [Discord UI feedback](https://support.discord.com/hc/en-us/community/posts/30942204080279-It-would-appear-that-an-overwhelming-majority-of-users-dislike-2025-Desktop-UI-changes-for-variety-of-reasons-request-way-to-revert-update)                                                                                                           | Medium                             | Establish density modes, performance budgets, visual regression, and reversible navigation changes.                                                                                          |
| E-004 | Notification overload causes communities to be muted and forgotten.                                                                                                                 | [Notification feedback](https://support.discord.com/hc/en-us/community/posts/4421087955735-New-Notification-Alert-Setting-Alert-only-recently-visited-channels)                                                                                                                                                                                 | Medium                             | Build an explainable attention center instead of relying on badges.                                                                                                                          |
| E-005 | Community operators depend on bots to compensate for incomplete logs and moderation workflows.                                                                                      | [Moderation feedback](https://support.discord.com/hc/en-us/community/posts/360048297852-Changes-to-Permissions-and-Audit-Logs)                                                                                                                                                                                                                  | Medium                             | Cases, evidence, actions, appeals, and audit history are first-party systems.                                                                                                                |
| E-006 | Users request portable chat and server history.                                                                                                                                     | [Export feedback](https://support.discord.com/hc/en-us/community/posts/360035147072-Export-Entire-Chats/comments/4420180099863)                                                                                                                                                                                                                 | Medium                             | Account and community exports are release requirements.                                                                                                                                      |
| E-007 | Discord's reporting system has regressed: the Zendesk form was removed, mobile reporting is inferior to desktop, and users describe it as intentionally difficult and intimidating. | [Reporting system analysis](https://blog.pnly.io/discords-reporting-system/); [Reddit: "worst report system"](https://www.reddit.com/r/discordapp/comments/18ujgp9/discord_has_one_of_the_worst_report_system_i_have/); [Reddit: "so hard to report"](https://www.reddit.com/r/discordapp/comments/kbmvtm/why_is_it_so_hard_to_report_someone/) | Medium-high                        | A guided report flow with progressive disclosure, clear expectations, and a visually unintimidating report area is a release requirement; reporting must never feel like a police encounter. |
| E-008 | LiveKit offers managed and self-hosted WebRTC, E2EE, reconnection, and cross-platform SDKs.                                                                                         | [LiveKit documentation](https://docs.livekit.io/intro/about/)                                                                                                                                                                                                                                                                                   | High                               | Use a media-provider adapter around LiveKit instead of building an SFU.                                                                                                                      |
| E-009 | MLS is standardized for asynchronous group key establishment with forward secrecy and post-compromise security.                                                                     | [RFC 9420](https://www.rfc-editor.org/info/rfc9420/)                                                                                                                                                                                                                                                                                            | High                               | Use a maintained MLS implementation for sealed messaging after external review.                                                                                                              |
| E-010 | Electron directly supports Windows loopback audio in its display-media handler, but its global shortcut callback does not expose key-release state.                                 | [Electron session](https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts), [globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut)                                                                                                                                               | High                               | Use Electron as the executable capture control candidate; require a native press/release adapter before PTT can pass.                                                                        |
| E-011 | Tauri's official global-shortcut plugin exposes pressed/released state, while capture remains dependent on WebView2 or native integration.                                          | [Tauri global shortcut](https://v2.tauri.app/plugin/global-shortcut/)                                                                                                                                                                                                                                                                           | High for shortcut; low for capture | Keep Tauri in the gate until its Windows capture/system-audio behavior is measured.                                                                                                          |

Original research remains required: at least 12 members, 8 hosts/moderators, and 5 usability participants before the Phase 0 exit gate.

## Decision log

| ID    | Decision                                                                                                                        | Rationale                                                                                                                                                                                | Reversal condition                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Start with gaming friend groups.                                                                                                | Tightest path to Discord's durable voice-driven value and a manageable solo-operator scope.                                                                                              | Repeated research shows another segment has materially higher activation without greater safety burden.                                 |
| D-002 | Hosted open core; no federation in year one.                                                                                    | Enables consistent UX and abuse response while preserving portability and a self-host path.                                                                                              | Central operation becomes economically or politically incompatible with the product promise and federation safety is proven.            |
| D-003 | Community-paid only.                                                                                                            | Aligns revenue with hosting cost without degrading individual communication.                                                                                                             | Measured economics cannot sustain a useful free friend-group tier.                                                                      |
| D-004 | Layered privacy: managed channels plus sealed channels/E2EE DMs.                                                                | Preserves search and moderation where expected while offering explicit private spaces.                                                                                                   | User research rejects the mode distinction or external review finds it unsafe/confusing.                                                |
| D-005 | React/TypeScript client and modular TypeScript core.                                                                            | Maximizes shared contracts and delivery speed for a solo-plus-agent team.                                                                                                                | Performance profiling proves a critical workload cannot meet its budget.                                                                |
| D-006 | PostgreSQL, Redis, S3-compatible storage, and LiveKit; no Kafka, Elasticsearch, microservices, or Kubernetes initially.         | Keeps operations comprehensible and reversible.                                                                                                                                          | A measured bottleneck exceeds the documented decomposition trigger.                                                                     |
| D-007 | Select Tauri only through a media/native capability gate; otherwise use Electron.                                               | Resource usage matters, but reliable Windows capture and push-to-talk are non-negotiable.                                                                                                | The chosen shell later fails a release budget and the alternative has demonstrably improved.                                            |
| D-008 | API is versioned REST plus an ordered resumable WebSocket gateway.                                                              | Separates durable commands/state from realtime fanout and permits deterministic recovery.                                                                                                | Contract tests show the split creates correctness or operability problems.                                                              |
| D-009 | Use port 8790 for the local core and integrated preview.                                                                        | Headroom already owns port 8787 in the shared workspace environment.                                                                                                                     | The environment-level port allocation changes.                                                                                          |
| D-010 | Keep the desktop-shell selection open and implement Electron as the first control candidate.                                    | Electron has first-party Windows capture/loopback APIs and runs with the installed toolchain; Tauri requires missing Rust/Visual Studio prerequisites and still needs a capture adapter. | Tauri completes the same measurements or Electron cannot meet PTT/performance budgets after a native adapter spike.                     |
| D-011 | Treat the managed `@everyone` role as the community base policy and assigned roles as role-level permission rules.              | This maps stored roles directly onto the documented precedence engine, makes deny behavior explainable, and avoids implicitly assigning a mutable role ID to every membership.           | Channel overrides or role hierarchy require a richer policy model that cannot preserve the documented precedence.                       |
| D-012 | Keep read state private to its account; soft-delete message content; store only non-content mutation metadata in audit events.  | Read activity should not become moderator surveillance, while deletion accountability must not create a second archive of message content.                                               | A reviewed moderation/evidence design requires narrowly scoped content retention with explicit user-visible policy and access controls. |
| D-013 | Route reply attention only to the original author when they still have `message.read`; suppress self-reply attention.           | Reply notifications must not disclose channel activity after access is lost or create self-generated noise. Notification previews are bounded by the public attention contract.          | User research supports broader thread-following semantics with explicit notification controls and equivalent permission filtering.      |
| D-014 | Prefer a same-origin production web/API/gateway deployment; require exact allowlisted origins when the client is separate.      | One origin removes unnecessary cross-origin exposure and configuration. Explicit API and gateway URLs still support independent hosting without wildcard CORS.                           | Measured scaling or isolation requirements justify split origins and the exact-origin policy becomes operationally inadequate.          |
| D-015 | Gate voice/stage entry with `voice.join` and obtain provider credentials through the `MediaProvider` adapter.                   | One explainable permission works across voice channel kinds while keeping LiveKit replaceable and deterministic in tests.                                                                | Stage moderation or provider capabilities require independently governed join/speak/publish permissions.                                |
| D-016 | Restrict community exports to owners and omit member identities and invite records while preserving counts and message history. | Portability requires usable history, but an export should not become a bulk identity or active-invite disclosure surface.                                                                | A reviewed portability design defines consented member fields or a safer scoped administrator role.                                     |
| D-017 | Enter stages listen-only and change provider-side publish permission only while an authorized `stage.speak` keybind is active.  | A UI-only role flag or replacement token cannot revoke an already granted media capability; the media provider must enforce press and release transitions.                               | The selected provider proves an equivalent shorter-lived capability model with immediate release-time revocation.                       |
| D-018 | Select the production media provider only when all LiveKit credentials are present, and issue ten-minute room-scoped grants.    | Partial configuration must fail at startup; short-lived, least-privilege grants limit credential exposure while server-side participant updates make PTT release immediate.              | Operational evidence requires a different token lifetime or the selected provider changes its permission model.                         |
| D-019 | Friends-first product philosophy: build for you and your friends before the world.                                              | User direction 2026-06-30 — polish and fun matter more than platform compliance for now. Public-platform features (E2EE, guided report flow, federation) are deferred until the core is worth sharing. | User research shows the audience is broader and platform features are the bottleneck to activation.                             |
| D-020 | Migrate monorepo package manager from npm to pnpm.                                                                              | Faster installs, strict dependency isolation, no phantom dependencies, correct workspace hoisting behavior.                                                                               | A measured build issue proves pnpm incompatible with a required tool.                                                                  |
| D-021 | Deploy to cove.demonbox360.net on Oracle Cloud Ampere A1 (free tier) with Caddy as the TLS-terminating reverse proxy.          | User owns the domain and has a running Oracle server; Caddy handles automatic TLS with one config file and no cert management overhead.                                                   | Outgrows free-tier capacity or Oracle changes the free tier terms.                                                                     |
| D-022 | Use Resend for transactional email.                                                                                             | Simplest developer experience, generous free tier, reliable deliverability, straightforward REST API.                                                                                    | Volume or feature requirements (inbound, DKIM on custom domain) require a different provider.                                          |
| D-023 | Landing page: marketing page at /, auth routes at /login and /register.                                                         | Standard SaaS pattern; lets friends learn what Cove is before signing up; keeps auth URLs clean and linkable.                                                                            | User research shows direct-to-auth is strongly preferred.                                                                              |

## Architecture and public contracts

### Repository boundaries

- `apps/web`: React/Vite browser client and shared application surface.
- `apps/desktop`: Windows shell spike and eventual native integrations.
- `services/core`: Fastify HTTP API, WebSocket gateway, jobs, and operator endpoints.
- `packages/contracts`: runtime schemas, public types, gateway envelopes, and generated-client inputs.
- `packages/ui`: accessible design primitives and semantic tokens.
- `packages/crypto`: adapters around reviewed libraries; no primitives.
- `infra`: local dependencies, deployment definitions, and operational dashboards.

### Initial protocol

- REST/JSON under `/v1`; problem responses use `application/problem+json`.
- Retryable mutations require `Idempotency-Key` once persistence is introduced.
- Gateway frames: `READY`, `EVENT`, `ACK`, `HEARTBEAT`, `HEARTBEAT_ACK`, `RESYNC_REQUIRED`.
- Delivery is at least once; clients deduplicate by `eventId` and resume from an account sequence.
- `ChannelPrivacyMode` is `managed` or `sealed`; incompatible server features are explicit in the channel policy.
- Channel `kind` is `text`, `voice`, or `stage`; stage channels support a parent-child hierarchy where audio broadcasts one-way from the stage to subchannels, with an optional keybind gate and hover-to-listen peek from the parent.

### Permission precedence

1. Owner-only capability.
2. Explicit member deny.
3. Explicit member allow.
4. Applicable role deny.
5. Applicable role allow.
6. Community base policy.

Administrator bypass never applies to ownership, billing, security, or private moderation evidence.

## Roadmap

### ✅ Done — Phase 0, cycles 1–6
Repository, CI, design tokens, HTTP/gateway spike, LiveKit spike, Electron/Tauri capability gate, cost model, research kit.

### ✅ Done — Phase 1, cycles 7–25
Email/passkey auth, communities/channels/roles/invites/permissions, PostgreSQL + Redis + attachment pipeline, messages/replies/reactions/read state, presence, audit trail, community export, deployable web client, authenticated bootstrap, voice channels.

### ✅ Done — Phase 2a, cycles 26–31
- ✅ Voice, screen share, stage channels, hover-to-eavesdrop, keybind-gated stage audio
- ✅ Expanded attention controls (mark-all-read, dismiss, channel mute)
- ✅ Cycle 30: foundation repair (community switching, reactions, replies, reconnect, persistence, orchestration)
- ✅ Cycle 31: attention center panel, create/join space modal, bootstrap loading state, auth test fix, toast CSS cleanup

### 🔄 In progress — Phase 2b: Friends-First Polish (cycles 32+)

**Infrastructure:**
- 🔲 pnpm migration — replace npm across monorepo; update lockfile, CI scripts, workspace commands
- 🔲 Deployment — Oracle Cloud Ampere A1 + Caddy config for cove.demonbox360.net; TLS auto
- 🔲 Email — Resend integration for auth verification and notification emails

**UI bugs (from screenshot audit 2026-06-30):**
- 🔲 "Sign In" button shown on bottom bar for already-logged-in users
- 🔲 "Comfortab" placeholder text bleeding through in channel header
- 🔲 Attention panel orphaned × buttons — layout needs a proper pass
- 🔲 Settings button placement (buried under user profile area)
- 🔲 Remove hardcoded "Practice run · Tonight · 6 interested" event card

**Landing & auth:**
- 🔲 Marketing landing page at `/` — feature highlights, screenshots, "Get Started" CTA
- 🔲 Clean `/login` and `/register` routes with proper forms
- 🔲 Post-login redirect back to intended destination

**Identity & customization:**
- 🔲 User avatars — avatar upload, display name, profile card on click
- 🔲 Custom status — "🎮 in ranked", "🎵 vibing", etc. with presence display
- 🔲 Custom server emoji — upload/manage per-community, usable in messages and reactions
- 🔲 Themes & appearance — dark/light toggle + accent color + 2–3 curated presets

**Core messaging polish:**
- 🔲 Rich link embeds — YouTube, Twitter/X, image URLs, generic OG tags unfurl inline
- 🔲 File & image uploads — drag-drop attach; images display inline in chat
- 🔲 Pinned messages — moderators pin, accessible from channel header
- 🔲 Message search — keyword search within channel

**App.tsx component extraction (prerequisite for testability):**
- 🔲 MessageList, Composer, ChannelSidebar, CommunityRail, VoicePanel, AttentionPanel — Antigravity builds; Claude wires

### Later — Phase 3
Community settings panel, DM channels, notification preferences, passkey auth UI, member list sidebar.

### Later — Phase 4
Windows packaging (Tauri/Electron gate), E2EE DMs (MLS review pending), guided report flow, sealed channels.

### Later — Phase 5
Native mobile, supported self-hosting, federation, knowledge channels, curated discovery.

### Blocked

- Original participant research requires recruited target users.
- Managed LiveKit validation requires service credentials.
- Tauri measurement requires an approved Rust and Visual Studio C++ workstation installation.
- Permission-dependent screen/audio/device measurements require an interactive Windows harness session.
- Public beta requires external legal, penetration, and E2EE review.
- Signed Windows distribution requires code-signing credentials.

## Work-item registry

| ID     | Status      | Outcome                                                | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                   | Verification                                                                                                                                                                                                                                                                                                   |
| ------ | ----------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-001 | verified    | Authoritative living plan                              | All required sections exist and current cycle is explicit.                                                                                                                                                                                                                                                                                                                                                            | Manual structure review completed 2026-06-29.                                                                                                                                                                                                                                                                  |
| P0-002 | verified    | Monorepo foundation                                    | Workspaces install; shared typecheck, test, and build commands pass.                                                                                                                                                                                                                                                                                                                                                  | Root test/typecheck/build/format commands pass.                                                                                                                                                                                                                                                                |
| P0-003 | verified    | Public-contract package                                | Runtime validation covers privacy policies, gateway frames, and bootstrap state.                                                                                                                                                                                                                                                                                                                                      | 4 contract/permission tests and strict types pass.                                                                                                                                                                                                                                                             |
| P0-004 | verified    | Core transport spike                                   | Health/bootstrap routes and gateway READY/heartbeat/event behavior run locally.                                                                                                                                                                                                                                                                                                                                       | 3 API/WebSocket tests and integrated runtime probes pass.                                                                                                                                                                                                                                                      |
| P0-005 | implemented | Polished application shell                             | Four-region layout, density/theme controls, privacy card, messaging composition, and responsive behavior render accessibly.                                                                                                                                                                                                                                                                                           | 4 semantic/state UI tests and build pass; browser QA is policy-blocked.                                                                                                                                                                                                                                        |
| P0-006 | verified    | Research kit                                           | Interview guide, survey, consent script, and synthesis rubric exist.                                                                                                                                                                                                                                                                                                                                                  | Structure reviewed; participant sessions remain external.                                                                                                                                                                                                                                                      |
| P0-007 | implemented | Desktop/media gate                                     | Both shell candidates evaluated against capture/PTT/device/performance criteria.                                                                                                                                                                                                                                                                                                                                      | Electron harness, 3 gate tests, renderer smoke, and dated preflight evidence pass; PTT adapter wired through preload bridge + harness UI; uiohook-napi installed + rebuilt against Electron 42 ABI; press/release IPC probe and capture/audio/soak measurements remain blocked on interactive Windows session. |
| P0-008 | implemented | Initial cost model                                     | Bandwidth, media, storage, support, and abuse-cost assumptions produce sensitivity ranges and beta telemetry requirements.                                                                                                                                                                                                                                                                                            | docs/architecture/COST_MODEL.md: sensitivity ranges across 10/50/200 DAU; media dominates; 6 beta telemetry requirements; pricing deferral criteria match D-006.                                                                                                                                               |
| P1-001 | verified    | Passkey & email auth / sessions                        | Email request/verify codes, WebAuthn options/verification, device session lists/revocation.                                                                                                                                                                                                                                                                                                                           | Vitest integration test covers email verify/retry, registration/login options, session listing, and revocation.                                                                                                                                                                                                |
| P1-002 | verified    | Communities, channels, memberships, roles, invites     | Community CRUD, channel CRUD within communities, join/leave membership, role CRUD, invite creation/management, owner-leave guard, permission simulator endpoint.                                                                                                                                                                                                                                                      | 26 core tests pass: community create/list/get, membership join/leave, channel create/list, role CRUD, invite create/list/join, permission simulator precedence/owner-only. Typecheck, build, format clean. 0 production vulns.                                                                                 |
| P1-003 | verified    | Permission-dependent message routing                   | Authenticated message reads/writes filtered by channel permissions and role assignments.                                                                                                                                                                                                                                                                                                                              | Message read/write tests with permission enforcement; 26 core tests pass, message read/write gated by permission engine and roles.                                                                                                                                                                             |
| P1-004 | implemented | PostgreSQL persistence                                 | Initial PostgreSQL schema (10 tables), pg-based repository adapter, DATABASE_URL-driven repository selection, docker-compose for local dev.                                                                                                                                                                                                                                                                           | 54 tests pass (10 contracts + 14 desktop + 4 web + 26 core); typecheck, build (86.41 kB gzip), and format clean. Repository interface is fully async; memory adapter remains default for tests; postgres adapter activated via DATABASE_URL env.                                                               |
| P1-005 | verified    | Attachment pipeline                                    | Two-phase upload (initiate metadata → PUT raw body), per-MIME allowlist (images, video/mp4/webm, audio, pdf, zip, text), 25 MB cap, quarantine status (auto-approve in dev), binary serve endpoint, message `attachmentIds` resolution, PostgreSQL migration 002.                                                                                                                                                     | 64 tests pass (36 core + 10 contracts + 4 web + 14 desktop); strict typecheck, build 86.49 kB gzip, format clean, 0 production vulns. 5 new attachment tests covering initiate/upload/serve/duplicate/message-resolution.                                                                                      |
| P1-006 | verified    | Managed message lifecycle and audit trail              | Author-only edits; author or `message.manage` soft-deletes; idempotent permission-gated reactions; private per-account read state; metadata-only audit events; gateway/client reconciliation; PostgreSQL migration 003.                                                                                                                                                                                               | 69 tests pass (39 core + 11 contracts + 5 web + 14 desktop); strict typecheck; production build 87.55 kB gzip JS / 4.20 kB gzip CSS; format clean; production and full audits report 0 vulnerabilities.                                                                                                        |
| P1-007 | verified    | Ordered migration runner and same-channel replies      | `runMigrations(pool)` creates `schema_migrations` ledger, runs pending `.sql` files in filename order inside transactions, rolls back on failure; `004_replies.sql` adds `reply_to_id` FK; `replyToId` + `replyPreview` on message contract and send route.                                                                                                                                                           | 75 tests pass (45 core + 11 contracts + 5 web + 14 desktop); strict typecheck; production build 87.60 kB gzip JS / 4.20 kB gzip CSS; format clean; 0 production vulnerabilities.                                                                                                                               |
| P1-008 | verified    | Account-targeted reply attention                       | Replies emit a navigable `attention.item.created` event only to the original author when they retain channel read access; self-replies do not notify; the web client deduplicates replayed attention items.                                                                                                                                                                                                           | 78 tests pass (46 core + 12 contracts + 6 web + 14 desktop); strict typecheck; production build 87.66 kB gzip JS / 4.20 kB gzip CSS; changed-scope format clean; production and full audits report 0 vulnerabilities.                                                                                          |
| P1-009 | verified    | Community member presence                              | Online/idle/do-not-disturb/offline contracts and gateway connect/disconnect fanout, with multi-session-safe offline transitions, and web client participant presence reconciliation.                                                                                                                                                                                                                                  | 80 tests pass (47 core + 13 contracts + 6 web + 14 desktop); strict typecheck; production build 87.77 kB gzip JS / 4.20 kB gzip CSS; formatting clean; 0 production vulnerabilities.                                                                                                                           |
| P1-010 | verified    | Operator diagnostics and expanded audit log            | `auditEventSchema.action` expanded to cover membership, role, channel, and invite events; `targetType` enum covers all target categories; `recordAudit()` helper wired at 11 mutation sites; cursor-based paginated audit log endpoint; `GET /v1/communities/:id/stats` returning memberCount/channelCount/messageCount/onlineCount; `communityStatsSchema` contract; web client community header shows member count. | 86 tests pass (51 core + 15 contracts + 6 web + 14 desktop); strict typecheck; production build 87.90 kB gzip JS / 4.20 kB gzip CSS; format clean; 0 production vulnerabilities.                                                                                                                               |
| P1-011 | verified    | Deployable web client configuration                    | Same-origin production static serving; typed `VITE_API_URL`/`VITE_GATEWAY_URL` resolution; exact-origin default-deny CORS; non-root multi-stage container image; documented environment contract.                                                                                                                                                                                                                     | 94 tests pass (55 core + 15 contracts + 10 web + 14 desktop); strict typecheck; production build 88.20 kB gzip JS / 4.20 kB gzip CSS; format clean; production and full audits report 0 vulnerabilities. Container execution is blocked by the unavailable Docker Linux daemon.                                |
| P1-012 | verified    | Voice-room media channels and permission gating        | Voice-room session schemas, stage/voice channel enum, MediaProvider interface, fake/LiveKit media providers, join/leave endpoints, automated room-switching, permission gating.                                                                                                                                                                                                                                       | 97 tests pass (58 core + 15 contracts + 10 web + 14 desktop); typecheck and production build pass.                                                                                                                                                                                                             |
| P1-013 | verified    | Voice participant event reconciliation                 | Voice participant contracts and gateway events update client participant lists idempotently; join/leave API controls and the in-voice dock indicator are wired.                                                                                                                                                                                                                                                       | 99 tests pass (58 core + 16 contracts + 11 web + 14 desktop); strict typecheck; production build 88.59 kB gzip JS / 4.20 kB gzip CSS; format clean (pre-existing warnings unchanged); 0 production vulnerabilities.                                                                                            |
| P1-014 | verified    | Community portability and audit log client             | Versioned owner-only community export includes community/channel/role structure and message history while omitting member identities and invite secrets; web audit panel paginates, deduplicates events, surfaces permission/network failures, and downloads exports.                                                                                                                                                 | 107 tests pass (61 core + 18 contracts + 14 web + 14 desktop); strict typecheck; production build 89.57 kB gzip JS / 4.33 kB gzip CSS; changed-scope format clean; production audit reports 0 vulnerabilities.                                                                                                 |
| P1-015 | verified    | Authenticated web session / bootstrap & voice cleanup  | Wire authenticated web session/bootstrap state for audit, export, stats, messaging, and voice; reconcile voice participants on restart.                                                                                                                                                                                                                                                                               | 108 tests pass (62 core + 18 contracts + 14 web + 14 desktop); strict typecheck and build pass; Prettier clean.                                                                                                                                                                                                |
| P2-001 | verified    | Stage broadcast subchannels and screen-share contracts | Subchannel creation with parentChannelId enforcement (only stage parents, no nesting); subchannel listing endpoint; hover-to-eavesdrop stage peek returning speakers, listeners, and active screen shares; speaker/listener participantRole on voice join; screen-share start/stop endpoints with gateway events.                                                                                                     | 121 tests pass (70 core + 23 contracts + 14 web + 14 desktop); strict typecheck; production build 90.87 kB gzip JS / 4.48 kB gzip CSS; Prettier clean; 0 production vulnerabilities.                                                                                                                           |
| P2-002 | verified    | Permission-gated stage speaking                        | Stage and subchannel entry is listen-only; press/release speaking transitions require membership and `stage.speak` on promotion, require an active stage connection, update participant role, and delegate publish enable/revocation to `MediaProvider`.                                                                                                                                                              | 123 tests pass (71 core + 24 contracts + 14 web + 14 desktop); strict typecheck; production build 90.90 kB gzip JS / 4.48 kB gzip CSS; changed-scope Prettier and production audit pass.                                                                                                                       |
| P2-003 | verified    | Production LiveKit provider integration                | Complete credentials select LiveKit at startup; joins receive signed ten-minute room-scoped grants; stage speaking changes mutate the connected participant's publish permission server-side and return matching replacement credentials; partial credentials and invalid client URLs fail closed.                                                                                                                    | 130 tests pass (75 core + 24 contracts + 17 web + 14 desktop); signed grants are decoded and verified in deterministic tests; strict typecheck, production build at 215.11 kB gzip JS (livekit-client bundled) / 5.09 kB gzip CSS, changed-scope Prettier, and production audit pass. Hosted room validation remains credential-blocked. |
| P2-004 | verified    | Expanded attention controls                            | Mark-all-read sets all attention items to unread: false; per-item dismiss removes a single item by id; channel mute suppresses incoming gateway attention items for a muted channel and persists mute state in localStorage; attention panel UI exposes all three controls with accessible button labels. | 132 tests pass (75 core + 24 contracts + 19 web + 14 desktop); strict typecheck; production build 215.52 kB gzip JS / 5.09 kB gzip CSS; Prettier clean; 0 production vulnerabilities. |

## Quality dashboard

| Area             | Current          | Notes                                                                                                                                                                                         |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install          | in-progress      | Migrating from npm to pnpm (Cycle 32). pnpm install will replace npm install across monorepo.                                                                                                 |
| Unit tests       | verified         | 152 total: 82 core + 32 web + 24 contracts + 14 desktop. Operator auth tests fixed Cycle 32. Emoji content endpoint test added Cycle 32.                                                      |
| Type safety      | verified         | All five workspaces pass strict TypeScript (confirmed Cycle 30).                                                                                                                              |
| Production build | verified         | 215 kB gzip JS (livekit-client bundled) / 5.09 kB gzip CSS; multi-stage non-root container present.                                                                                          |
| API integration  | verified         | All Phase 1–2 endpoints covered. Cycle 30 added snapshot persistence (`SNAPSHOT_FILE`). Operator endpoints auth guard in progress (Codex Cycle 30).                                          |
| Frontend UX      | partial          | Community switching, reactions, replies, WS reconnect, error toasts now wired. Attention panel, create/join modal, loading state still missing (P0 queue).                                   |
| Accessibility    | partial          | Semantic UI tests exist; real-browser review blocked.                                                                                                                                         |
| Performance      | partial          | Electron renderer 2.392 s; 464 MB working-set risk noted. PTT/soak unmeasured (session-blocked).                                                                                             |
| Security         | partial          | CSP, headers, runtime schemas, exact-origin CORS, 0 production vulns. Operator endpoint auth guard in progress. 5 high build-time `tar` findings via electron-rebuild (no fix available).   |
| Reliability      | partial          | WS reconnects with backoff (Cycle 30). Snapshot persistence for local dev (Cycle 30). Container execution and deployment SLO validation environment-blocked.                                 |
| Cost             | modelled         | Initial cost model exists; real-world telemetry pending.                                                                                                                                     |

## Risk register

| Risk                                            | Likelihood  | Impact   | Mitigation / trigger                                                                                                                                                                            |
| ----------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network effects prevent migration               | High        | Critical | Consent-based structure import, expiring bridge, fast invite activation, community templates.                                                                                                   |
| Scope exceeds solo capacity                     | High        | Critical | One active outcome per cycle, hard phase gates, defer discovery/mobile/federation.                                                                                                              |
| Safety operations exceed capacity               | Medium-high | Critical | Invite-only cohorts, 16+, no explicit content, community caps, first-party case tooling, guided low-friction report flow with progressive disclosure and a visually unintimidating report area. |
| Media cost or quality misses target             | Medium      | Critical | LiveKit spike, provider abstraction, participant-minute telemetry, capacity rather than quality tiers.                                                                                          |
| E2EE creates misleading guarantees              | Medium      | Critical | Explicit modes, metadata disclosure, maintained MLS, independent review before marketing.                                                                                                       |
| Desktop shell fails capture or resource targets | Medium-high | High     | Mechanical Tauri/Electron gate; Electron still needs true PTT and idle/soak proof, while Tauri capture remains unresolved.                                                                      |
| Permission bugs cross community boundaries      | Medium      | Critical | Central policy engine, precedence property tests, tenant IDs in every authorization query.                                                                                                      |
| UI becomes unstable or decorative               | Medium      | High     | Semantic design system, visual regression, density modes, measured navigation-change policy.                                                                                                    |

## Recent session checkpoints

Cycles 1–20 are summarized in the table below. Full detail for cycles 21+ follows.

| Cycles | Phase | Summary |
|--------|-------|---------|
| 1–6 | 0 | Monorepo, CI, design tokens, gateway spike, LiveKit spike, Electron/Tauri gate, cost model, research kit |
| 7–10 | 1 | Email/passkey auth, communities, channels, memberships, roles, invites, permission engine |
| 11–14 | 1 | PostgreSQL, migrations, attachment pipeline, managed messages, reactions, read state |
| 15–17 | 1 | Reply attention, presence, audit trail, community export, deployable web client |
| 18–20 | 1 | Voice channels, LiveKit provider interface, voice participant events, join/leave UI, authenticated bootstrap |

---

### Cycle 30 — 2026-06-30 — completed

- Objective: repair foundational gaps found in audit — nothing in the app was functionally wired despite routes and UI existing.
- Delivered: community rail `onClick` — `switchCommunity()` updates `activeCommunityId`, fetches first text channel's messages.
- Delivered: reaction buttons `onClick` — `toggleReaction()` calls `PUT`/`DELETE /reactions` based on current state; WebSocket events already updated UI.
- Delivered: emoji picker — React button opens inline popup with 8 common emojis; clicking one calls `toggleReaction`.
- Delivered: reply flow — `replyToId` state, dismissable reply bar above composer, `replyToId` sent in POST body; server already had the endpoint.
- Delivered: channel message fetch — `useEffect` on `activeChannelId` fetches `GET /v1/channels/:id/messages` on every channel switch.
- Delivered: WebSocket reconnection — exponential backoff (1s → 30s cap) on close; resets on READY; connection banner shown while disconnected.
- Delivered: error toast system — `showToast()` with 4s auto-dismiss; fixed-position bottom-right; `submitMessage` now reverts optimistic message and toasts on failure instead of collapsing connection state.
- Delivered: snapshot persistence — `SNAPSHOT_FILE` env var triggers load-on-startup, 30s autosave, and save-on-shutdown using existing `exportBackup`/`importBackup` methods.
- Delivered: orchestration infrastructure — CLAUDE.md (Definition of Done, error handling rules, hot-file ownership), WORKLOG.md (assignments, priority queue, cycle history), daily 9 AM orchestration routine, task assignments for Codex and Antigravity.
- Evidence: 75 core + 24 contract tests pass; strict TypeScript clean across all workspaces.
- Blockers: desktop keybind proof, LiveKit credentials, Docker, browser QA, signing, participant research, external review — all unchanged.

### Cycle 29 — 2026-06-30 — completed

- Objective: implement expanded attention controls (mark-all-read, per-item dismiss, channel mute) as the next unblocked Phase 2 item.
- Delivered: exported `dismissAttentionItem(items, id)` and `markAllAttentionRead(items)` as pure functions from `apps/web/src/App.tsx`.
- Delivered: `mutedChannelIds: Set<string>` state initialized from and persisted to `localStorage` (`cove_muted_channels`); `toggleChannelMute(channelId)` add/removes from the set.
- Delivered: gateway handler now skips incoming `attention.item.created` events whose `channelId` is in `mutedChannelIds`.
- Delivered: attention panel header gains a "Mark all read" button (disabled when nothing is unread); each attention item gains a per-item "Dismiss" (×) button and a "Mute/Unmute channel" (BellOff) button (shown only when the item carries a `channelId`).
- Delivered: two new web unit tests — `dismissAttentionItem` removes by id and is a no-op for unknown ids; `markAllAttentionRead` sets all to unread: false and preserves identity for already-read items.
- Evidence: 132 tests pass (75 core + 24 contracts + 19 web + 14 desktop); strict typecheck clean; production build 215.52 kB gzip JS / 5.09 kB gzip CSS; Prettier clean on changed scope; production audit 0 vulnerabilities.
- Verification: all five strict TypeScript workspaces pass; production build succeeds; 132 tests pass; changed-scope Prettier clean.
- Blockers: desktop keybind proof and PTT/capture/audio/soak measurements remain blocked on an interactive Windows session. Hosted LiveKit validation remains credential-blocked. Existing Docker, browser-policy, signing, participant-research, and external-review blockers remain.
- Exact next task: perform desktop keybind proof and PTT/capture/audio/soak measurements on a real Windows session (interactive-session-blocked); failing that, implement guided report flow (Phase 3) or notification preference storage (server-side mute persistence) as the next unblocked item.

### Cycle 28 — 2026-06-30 — completed

- Objective: close the test coverage gap from cycle 25 by exporting `reconcileParticipantRole` as a testable unit and adding stage-specific web tests; reconcile the plan's test count with the observed 14 (not 15) web tests.
- Delivered: exported `reconcileParticipantRole(channels, channelId, participantId, role)` from `apps/web/src/App.tsx` (was previously inline in the gateway handler).
- Delivered: gateway handler for `stage.speaking.updated` now calls the exported function instead of repeating the inline mapping logic.
- Delivered: three new web tests — stage focus view renders with hold-to-speak control, subchannel nav nesting shows Squad Alpha and Squad Bravo under Main Stage, and `reconcileParticipantRole` correctly updates and isolates participant role on the target channel.
- Evidence: 130 tests pass (17 web + 14 desktop + 75 core + 24 contracts); test counts corrected from the over-reported 128 (15 web) to the accurate 130 (17 web after the new additions).
- Verification: 130 tests pass (75 core + 24 contracts + 17 web + 14 desktop); strict typecheck clean across all five workspaces; production build passes; changed-scope Prettier clean; production audit reports 0 vulnerabilities.
- Blockers: desktop keybind proof and PTT/capture/audio/soak measurements remain blocked on an interactive Windows session. Hosted LiveKit validation remains credential-blocked. Existing Docker, browser-policy, signing, participant-research, and external-review blockers remain.
- Exact next task: perform desktop keybind proof and PTT/capture/audio/soak measurements on a real Windows session (interactive-session-blocked); failing that, implement expanded attention controls (mark-all-read, per-item dismiss, and channel mute) as the next unblocked Phase 2 item.

### Cycle 27 — 2026-06-30 — completed

- Objective: integrate `livekit-client` in the web voice dock so join credentials establish and cleanly leave a real room, microphone publication follows voice/stage permissions, and screen-share actions publish/unpublish actual tracks; keep the fake provider path deterministic for automated tests.
- Delivered: installed `livekit-client` dependency.
- Delivered: implemented LiveKit Room connection lifecycle in `App.tsx` reacting to `voiceSession` updates, with a deterministic guard ignoring fake tokens.
- Delivered: wired microphone publication to synchronize with `voiceSession.canPublish` permissions and mute state (`isMuted`).
- Delivered: implemented screen share action (`toggleScreenShare`) that publishes/unpublishes actual screen share tracks on LiveKit and invokes the server-side screen share start/stop endpoints.
- Delivered: updated user dock action footer to provide interactive mute, deafen, and screen sharing buttons with state-driven icons and styling.
- Evidence: manual verification paths and local mock validations run cleanly; all unit tests across workspaces pass.
- Verification: 128 tests pass (75 core + 24 contracts + 15 web + 14 desktop); all five strict TypeScript workspaces pass; production build succeeds; changed-scope Prettier and production dependency audit pass.
- Blockers: hosted LiveKit room validation remains blocked by service credentials; interactive desktop keybind proof remains user-session-blocked. Existing Docker, browser-policy, signing, participant-research, and external-review blockers remain.
- Exact next task: perform desktop keybind proof and PTT/capture/audio/soak measurements on a real Windows session.

### Cycle 26 — 2026-06-30 — completed

- Objective: implement the LiveKit media-provider integration and credential loading without claiming unavailable hosted validation.
- Delivered: installed the official server SDK; production startup now selects LiveKit when and only when API key, secret, and WebSocket URL are all present, while entirely unconfigured local/test runs retain the deterministic fake provider.
- Delivered: signed ten-minute identity- and room-scoped join grants with explicit subscribe/publish/data permissions; stage press/release now calls LiveKit's participant update API for immediate server-side capability mutation and returns a matching replacement credential.
- Decision: D-018 records fail-closed partial configuration, short-lived least-privilege grants, and server-side permission mutation.
- Evidence: deterministic token verification covers identity, display name, room, subscribe-only stage entry, and publish promotion; provider tests cover permission API arguments, fake-provider selection, partial configuration rejection, and URL protocol validation.
- Verification: 128 tests pass (75 core + 24 contracts + 15 web + 14 desktop); all five strict TypeScript workspaces pass; production build succeeds at 92.62 kB gzip JavaScript / 5.09 kB gzip CSS; changed-scope Prettier and production dependency audit pass. Full audit retains 5 high build-time `tar` findings through `electron-rebuild`, with no fix available.
- Blockers: hosted LiveKit room validation remains blocked by service credentials; interactive desktop keybind proof remains user-session-blocked. Existing Docker, browser-policy, signing, participant-research, and external-review blockers remain.
- Exact next task: integrate `livekit-client` in the web voice dock so join credentials establish and cleanly leave a real room, microphone publication follows voice/stage permissions, and screen-share actions publish/unpublish actual tracks; keep the fake provider path deterministic for automated tests.

### Cycle 25 — 2026-06-30 — completed

- Objective: implement web stage UI with parent/subchannel hierarchy, hover peek, speaker/listener and screen-share indicators, and press/release controls that call the speaking endpoint; then wire desktop PTT events to those controls.
- Delivered:
  - Nested subchannels list rendered under parent stage channels in the community navigation panel.
  - Hover peek popover (glassmorphic floating tooltip) showing reactive lists of Speakers, Listeners, and Screen sharing badges using computed useMemos and WebSocket events.
  - Active Voice/Stage channel focus panel displays PTT press-and-hold controls, transmitting status, browser keyboard shortcuts (Space / F9), and global desktop keybinds via the native PTT adapter bridge.
  - Integrated `stage.speaking.updated`, `screen.share.started`, and `screen.share.ended` WebSocket events.
- Verification: 124 tests pass (71 core + 24 contracts + 15 web + 14 desktop); strict typecheck is green; production build is successful; changed-scope Prettier is clean; 0 production vulnerabilities.
- Blockers: real LiveKit token creation and permission mutation remain credential-blocked; interactive desktop keybind proof remains user-session-blocked. Existing Docker, browser-policy, signing, participant-research, and external-review blockers remain.
- Exact next task: implement the LiveKit media-provider integration, credential loading, and token validation flow when credentials become available.

### Cycle 24 — 2026-06-30 — completed

- Objective: enforce keybind-gated stage speaking without depending on unavailable LiveKit credentials.
- Delivered: stage and subchannel joins now return listener role and listen-only media credentials; regular voice joins remain publish-capable.
- Delivered: POST `/v1/channels/:channelId/stage/speaking` accepts press/release state, requires an active stage/subchannel connection, enforces `stage.speak` on promotion, updates participant role, delegates immediate publish enable/revocation to `MediaProvider`, and emits `stage.speaking.updated`.
- Contracts: `VoiceSession.canPublish` and `stageSpeakingStateSchema`; the provider boundary now exposes `setPublishPermission` so release cannot be represented as a UI-only demotion or an unrevoked replacement token.
- Decision: D-017 records listen-only entry and provider-enforced press/release capability changes.
- Evidence: contract validation plus core integration coverage for listen-only join, authorized owner press/release, publish-capability transitions, and denied member promotion.
- Verification: 123 tests pass (71 core + 24 contracts + 14 web + 14 desktop); all five strict TypeScript workspaces pass; production build is 90.90 kB gzip JavaScript / 4.48 kB gzip CSS; changed-scope Prettier passes; production audit reports 0 vulnerabilities. Full audit retains 5 high build-time `tar` findings through `electron-rebuild` with no fix available.
- Blockers: real LiveKit token creation and permission mutation remain credential-blocked; interactive desktop keybind proof remains user-session-blocked. Existing Docker, browser-policy, signing, participant-research, and external-review blockers remain.
- Exact next task: implement web stage UI with parent/subchannel hierarchy, hover peek, speaker/listener and screen-share indicators, and press/release controls that call the speaking endpoint; then wire desktop PTT events to those controls.

### Cycle 23 — 2026-06-30 — completed

- Objective: begin Phase 2 with the stage channel parent-child subchannel hierarchy, hover-to-eavesdrop peek, and screen-share contracts, all achievable without LiveKit credentials.
- Delivered:
  - Extended `participantSchema` with optional `participantRole: 'speaker' | 'listener'`; extended `createChannelRequestSchema` with `parentChannelId` and `stageConfig`; added `stageParticipantsSchema`, `screenShareStartedSchema`, `screenShareEndedSchema`, and `participantRole` on `voiceSessionSchema` to `@cove/contracts`.
  - Server: `parentChannelId` is validated on channel creation — parent must exist in the same community, must be a stage channel, and must not itself be a subchannel (no nesting); `parentChannelId` and `stageConfig` are stored on the created channel.
  - New GET `/v1/channels/:channelId/subchannels` endpoint lists all channels parented under a stage channel (requires membership).
  - New GET `/v1/channels/:channelId/stage/peek` endpoint returns speakers (stage participants), listeners (subchannel participants), and active screen shares without joining (hover-to-eavesdrop; requires membership).
  - Voice join now determines `participantRole`: `'listener'` when joining any subchannel (channel with `parentChannelId`), `'speaker'` otherwise; role is stored on the participant and returned in the `VoiceSession` response.
  - New POST `/v1/channels/:channelId/screen/start` and `/screen/stop` endpoints: start validates the actor is already in the channel, generates a `trackId`, stores the session in a per-channel in-memory map, and emits `screen.share.started` gateway event; stop removes the session and emits `screen.share.ended`.
- Evidence: 13 new integration and contract tests covering subchannel creation, invalid-parent rejection, no-nesting enforcement, subchannel listing, stage peek with speakers/listeners, participantRole on join, and screen-share start/stop lifecycle.
- Verification: 121 tests pass (70 core + 23 contracts + 14 web + 14 desktop); strict typecheck; production build 90.87 kB gzip JS / 4.48 kB gzip CSS; Prettier clean; 0 production vulnerabilities.
- Blockers: LiveKit real token generation requires credentials (existing blocker). Screen share `screenShareSessions` map is process-local (not in the repository/PostgreSQL); it will need migration to the repository layer when multi-process deployment is required. Stage audio keybind gate (promote/demote speaker) not yet implemented.
- Exact next task: web client stage channel UI (subchannel list, peek overlay on hover, speaker/listener visual distinction, screen-share indicator), then LiveKit token generation when credentials are available.

### Cycle 22 — 2026-06-30 — completed

- Objective: wire authenticated web session/bootstrap state so protected audit, export, community stats, messaging, and voice controls use the verified auth/session API outside preview mode; then reconcile PostgreSQL voice participant state on restart.
- Delivered:
  - Extended `/v1/bootstrap` endpoint on the server to authenticate requests using standard Bearer token sessions and return user-specific accounts, communities, channels, and messages.
  - Implemented session persistence in the web client, loading and storing the session token in `localStorage`.
  - Added user-facing Sign In (with email & verification code entry modal) and Sign Out UI controls in the user dock footer.
  - Wired Authorization headers and token query parameter to fetch/WebSocket connections so messaging, stats, voice, and audit panels use authenticated sessions.
  - Implemented `reconcileVoiceParticipants` on the repository interfaces and executed it on core service start to clear stale voice participants in postgres/memory.
- Decision: Add `reconcileVoiceParticipants` to clear voice/stage channel participant lists at startup, keeping ephemeral voice states clean across server restarts.
- Evidence: core integration tests verify authenticated bootstrap responses, correct handle mapping, and schema compliance.
- Verification: 108 tests pass (62 core + 18 contracts + 14 web + 14 desktop); strict typecheck and production build pass across all workspaces; Prettier clean; 0 production vulnerabilities.
- Blockers: None (existing LiveKit credentials, interactive Windows media/PTT measurements, Docker Linux daemon, browser-policy QA, code signing, participant research, and external legal/security review blockers remain).
- Exact next task: Phase 2: voice media server (LiveKit) integration, screen share, and stage broadcast subchannels.


> Cycles 1–21 are summarized in the table at the top of this section. Full detail is available via `git log`.
