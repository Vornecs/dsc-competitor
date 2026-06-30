# Cove Product Plan

> Last updated: 2026-06-29 | Cycle: 14 | Phase: 1 — Core Features | Build health: verified; account-targeted reply attention live
>
> Current objective: Cycle 14 delivered account-targeted `attention.item.created` gateway events for replies, permission-safe recipient filtering, navigable attention metadata, and idempotent web attention-center reconciliation.
>
> Next gate: community member presence (online/idle/do-not-disturb/offline contracts and gateway connect/disconnect fanout), followed by presence reconciliation in the web participant surfaces.

This file is the authoritative product, architecture, and delivery record. A behavior or scope change is incomplete until this file is reconciled in the same work cycle.

## Product contract

### Promise

The fastest, clearest place for friends to hang out—without ads, surveillance, unstable interfaces, or hostage data.

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

| ID    | Decision                                                                                                                       | Rationale                                                                                                                                                                                | Reversal condition                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Start with gaming friend groups.                                                                                               | Tightest path to Discord's durable voice-driven value and a manageable solo-operator scope.                                                                                              | Repeated research shows another segment has materially higher activation without greater safety burden.                                 |
| D-002 | Hosted open core; no federation in year one.                                                                                   | Enables consistent UX and abuse response while preserving portability and a self-host path.                                                                                              | Central operation becomes economically or politically incompatible with the product promise and federation safety is proven.            |
| D-003 | Community-paid only.                                                                                                           | Aligns revenue with hosting cost without degrading individual communication.                                                                                                             | Measured economics cannot sustain a useful free friend-group tier.                                                                      |
| D-004 | Layered privacy: managed channels plus sealed channels/E2EE DMs.                                                               | Preserves search and moderation where expected while offering explicit private spaces.                                                                                                   | User research rejects the mode distinction or external review finds it unsafe/confusing.                                                |
| D-005 | React/TypeScript client and modular TypeScript core.                                                                           | Maximizes shared contracts and delivery speed for a solo-plus-agent team.                                                                                                                | Performance profiling proves a critical workload cannot meet its budget.                                                                |
| D-006 | PostgreSQL, Redis, S3-compatible storage, and LiveKit; no Kafka, Elasticsearch, microservices, or Kubernetes initially.        | Keeps operations comprehensible and reversible.                                                                                                                                          | A measured bottleneck exceeds the documented decomposition trigger.                                                                     |
| D-007 | Select Tauri only through a media/native capability gate; otherwise use Electron.                                              | Resource usage matters, but reliable Windows capture and push-to-talk are non-negotiable.                                                                                                | The chosen shell later fails a release budget and the alternative has demonstrably improved.                                            |
| D-008 | API is versioned REST plus an ordered resumable WebSocket gateway.                                                             | Separates durable commands/state from realtime fanout and permits deterministic recovery.                                                                                                | Contract tests show the split creates correctness or operability problems.                                                              |
| D-009 | Use port 8790 for the local core and integrated preview.                                                                       | Headroom already owns port 8787 in the shared workspace environment.                                                                                                                     | The environment-level port allocation changes.                                                                                          |
| D-010 | Keep the desktop-shell selection open and implement Electron as the first control candidate.                                   | Electron has first-party Windows capture/loopback APIs and runs with the installed toolchain; Tauri requires missing Rust/Visual Studio prerequisites and still needs a capture adapter. | Tauri completes the same measurements or Electron cannot meet PTT/performance budgets after a native adapter spike.                     |
| D-011 | Treat the managed `@everyone` role as the community base policy and assigned roles as role-level permission rules.             | This maps stored roles directly onto the documented precedence engine, makes deny behavior explainable, and avoids implicitly assigning a mutable role ID to every membership.           | Channel overrides or role hierarchy require a richer policy model that cannot preserve the documented precedence.                       |
| D-012 | Keep read state private to its account; soft-delete message content; store only non-content mutation metadata in audit events. | Read activity should not become moderator surveillance, while deletion accountability must not create a second archive of message content.                                               | A reviewed moderation/evidence design requires narrowly scoped content retention with explicit user-visible policy and access controls. |
| D-013 | Route reply attention only to the original author when they still have `message.read`; suppress self-reply attention.          | Reply notifications must not disclose channel activity after access is lost or create self-generated noise. Notification previews are bounded by the public attention contract.          | User research supports broader thread-following semantics with explicit notification controls and equivalent permission filtering.      |

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

### Now — Phase 0, cycles 1–6

- Living plan, repository conventions, CI, linting, tests, and local runtime.
- Product research guide, survey, and first wireframes.
- Accessible design tokens and core shell.
- HTTP/bootstrap and resumable gateway spike.
- LiveKit voice/screen-share/E2EE spike.
- Tauri/Electron Windows capability gate.
- Managed-versus-sealed threat model and initial cost model.
- Electron/Tauri desktop gate with dated, reproducible evidence rather than an assumption-based selection.

### Next — Phase 1, cycles 7–25

- Passkey/email authentication and device sessions.
- Accounts, communities, memberships, roles, channels, invites, and permission simulator.
- PostgreSQL persistence, migrations, Redis coordination, and object-storage quarantine.
- Managed messages, replies, reactions, edits, deletes, read state, and attachment pipeline.
- Account-targeted reply attention and community member presence.
- Audit events, backups, restore drill, deployable web client, and operator diagnostics.

### Later

- Phase 2: voice, screen share, stage channels (broadcast with listen-only subchannels, hover-to-eavesdrop, and keybind-gated stage audio), Windows packaging, expanded attention controls, and E2EE DMs.
- Phase 3: private alpha moderation with guided report flow and unintimidating report area, exports, deletion, migration bridge, sealed channels, and billing sandbox.
- Phase 4: external beta hardening, load, legal review, independent security/E2EE review, and gradual cohorts.
- Phase 5: native mobile, other desktop platforms, supported self-hosting, apps, curated discovery, and knowledge channels.

### Blocked

- Original participant research requires recruited target users.
- Managed LiveKit validation requires service credentials.
- Tauri measurement requires an approved Rust and Visual Studio C++ workstation installation.
- Permission-dependent screen/audio/device measurements require an interactive Windows harness session.
- Public beta requires external legal, penetration, and E2EE review.
- Signed Windows distribution requires code-signing credentials.

## Work-item registry

| ID     | Status      | Outcome                                            | Acceptance criteria                                                                                                                                                                                                                                               | Verification                                                                                                                                                                                                                                                                                                   |
| ------ | ----------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-001 | verified    | Authoritative living plan                          | All required sections exist and current cycle is explicit.                                                                                                                                                                                                        | Manual structure review completed 2026-06-29.                                                                                                                                                                                                                                                                  |
| P0-002 | verified    | Monorepo foundation                                | Workspaces install; shared typecheck, test, and build commands pass.                                                                                                                                                                                              | Root test/typecheck/build/format commands pass.                                                                                                                                                                                                                                                                |
| P0-003 | verified    | Public-contract package                            | Runtime validation covers privacy policies, gateway frames, and bootstrap state.                                                                                                                                                                                  | 4 contract/permission tests and strict types pass.                                                                                                                                                                                                                                                             |
| P0-004 | verified    | Core transport spike                               | Health/bootstrap routes and gateway READY/heartbeat/event behavior run locally.                                                                                                                                                                                   | 3 API/WebSocket tests and integrated runtime probes pass.                                                                                                                                                                                                                                                      |
| P0-005 | implemented | Polished application shell                         | Four-region layout, density/theme controls, privacy card, messaging composition, and responsive behavior render accessibly.                                                                                                                                       | 4 semantic/state UI tests and build pass; browser QA is policy-blocked.                                                                                                                                                                                                                                        |
| P0-006 | verified    | Research kit                                       | Interview guide, survey, consent script, and synthesis rubric exist.                                                                                                                                                                                              | Structure reviewed; participant sessions remain external.                                                                                                                                                                                                                                                      |
| P0-007 | implemented | Desktop/media gate                                 | Both shell candidates evaluated against capture/PTT/device/performance criteria.                                                                                                                                                                                  | Electron harness, 3 gate tests, renderer smoke, and dated preflight evidence pass; PTT adapter wired through preload bridge + harness UI; uiohook-napi installed + rebuilt against Electron 42 ABI; press/release IPC probe and capture/audio/soak measurements remain blocked on interactive Windows session. |
| P0-008 | implemented | Initial cost model                                 | Bandwidth, media, storage, support, and abuse-cost assumptions produce sensitivity ranges and beta telemetry requirements.                                                                                                                                        | docs/architecture/COST_MODEL.md: sensitivity ranges across 10/50/200 DAU; media dominates; 6 beta telemetry requirements; pricing deferral criteria match D-006.                                                                                                                                               |
| P1-001 | verified    | Passkey & email auth / sessions                    | Email request/verify codes, WebAuthn options/verification, device session lists/revocation.                                                                                                                                                                       | Vitest integration test covers email verify/retry, registration/login options, session listing, and revocation.                                                                                                                                                                                                |
| P1-002 | verified    | Communities, channels, memberships, roles, invites | Community CRUD, channel CRUD within communities, join/leave membership, role CRUD, invite creation/management, owner-leave guard, permission simulator endpoint.                                                                                                  | 26 core tests pass: community create/list/get, membership join/leave, channel create/list, role CRUD, invite create/list/join, permission simulator precedence/owner-only. Typecheck, build, format clean. 0 production vulns.                                                                                 |
| P1-003 | verified    | Permission-dependent message routing               | Authenticated message reads/writes filtered by channel permissions and role assignments.                                                                                                                                                                          | Message read/write tests with permission enforcement; 26 core tests pass, message read/write gated by permission engine and roles.                                                                                                                                                                             |
| P1-004 | implemented | PostgreSQL persistence                             | Initial PostgreSQL schema (10 tables), pg-based repository adapter, DATABASE_URL-driven repository selection, docker-compose for local dev.                                                                                                                       | 54 tests pass (10 contracts + 14 desktop + 4 web + 26 core); typecheck, build (86.41 kB gzip), and format clean. Repository interface is fully async; memory adapter remains default for tests; postgres adapter activated via DATABASE_URL env.                                                               |
| P1-005 | verified    | Attachment pipeline                                | Two-phase upload (initiate metadata → PUT raw body), per-MIME allowlist (images, video/mp4/webm, audio, pdf, zip, text), 25 MB cap, quarantine status (auto-approve in dev), binary serve endpoint, message `attachmentIds` resolution, PostgreSQL migration 002. | 64 tests pass (36 core + 10 contracts + 4 web + 14 desktop); strict typecheck, build 86.49 kB gzip, format clean, 0 production vulns. 5 new attachment tests covering initiate/upload/serve/duplicate/message-resolution.                                                                                      |
| P1-006 | verified    | Managed message lifecycle and audit trail          | Author-only edits; author or `message.manage` soft-deletes; idempotent permission-gated reactions; private per-account read state; metadata-only audit events; gateway/client reconciliation; PostgreSQL migration 003.                                           | 69 tests pass (39 core + 11 contracts + 5 web + 14 desktop); strict typecheck; production build 87.55 kB gzip JS / 4.20 kB gzip CSS; format clean; production and full audits report 0 vulnerabilities.                                                                                                        |
| P1-007 | verified    | Ordered migration runner and same-channel replies  | `runMigrations(pool)` creates `schema_migrations` ledger, runs pending `.sql` files in filename order inside transactions, rolls back on failure; `004_replies.sql` adds `reply_to_id` FK; `replyToId` + `replyPreview` on message contract and send route.       | 75 tests pass (45 core + 11 contracts + 5 web + 14 desktop); strict typecheck; production build 87.60 kB gzip JS / 4.20 kB gzip CSS; format clean; 0 production vulnerabilities.                                                                                                                               |
| P1-008 | verified    | Account-targeted reply attention                   | Replies emit a navigable `attention.item.created` event only to the original author when they retain channel read access; self-replies do not notify; the web client deduplicates replayed attention items.                                                       | 78 tests pass (46 core + 12 contracts + 6 web + 14 desktop); strict typecheck; production build 87.66 kB gzip JS / 4.20 kB gzip CSS; changed-scope format clean; production and full audits report 0 vulnerabilities.                                                                                          |

## Quality dashboard

| Area             | Current          | Gate                                                                                                                                                                                                                             |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install          | verified         | `npm install` completed and generated a locked workspace graph.                                                                                                                                                                  |
| Unit tests       | verified         | 78 tests pass: 6 web, 46 core (including migration, reply, and targeted gateway attention), 12 contracts, 14 desktop (3 gate + 11 PTT), 0 ui.                                                                                    |
| Type safety      | verified         | All five workspaces pass strict TypeScript.                                                                                                                                                                                      |
| Production build | verified         | Client output is 87.66 kB gzip JavaScript and 4.20 kB gzip CSS.                                                                                                                                                                  |
| API integration  | verified         | Health, bootstrap, authenticated community/role/invite/message lifecycle mutations, audit reads, private read state, same-channel replies, targeted reply attention, gateway, device sessions, integrated HTML, and assets pass. |
| Accessibility    | partial          | Semantic UI tests and accessible modes exist; real-browser review remains blocked.                                                                                                                                               |
| Performance      | partial          | Electron renderer loaded in 2.392 s once; a 464 MB summed startup working-set snapshot signals risk. PTT harness UI added; warm/idle p95 and soak remain unmeasured.                                                             |
| Security         | baseline partial | CSP, headers, runtime schemas, redacted logs, metadata-only message audit events, threat model, and 0 vulnerabilities in both production and full dependency audits.                                                             |
| Reliability      | local only       | Backup/restore and deployment SLOs begin in Phase 1.                                                                                                                                                                             |
| Cost             | modelled         | Initial cost model (P0-008) exists; real-world telemetry pending managed-service activation.                                                                                                                                     |

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

### Cycle 14 — 2026-06-29 — completed

- Objective: deliver attention-center notifications for replies without widening channel visibility or notifying the replying account.
- Delivered: optional `communityId`, `channelId`, and `messageId` navigation metadata on `attentionItemSchema`; reply sends now emit `attention.item.created` with a contract-bounded preview.
- Delivery policy: the original message author is the sole audience, self-replies are suppressed, and the existing `message.read` audience is reused so revoked or denied members receive no attention event.
- Delivered: the web gateway handler validates reply attention and reconciles it to the front of the attention center without duplicating replayed events.
- Decision: D-013 records account targeting, current read-permission filtering, and self-reply suppression.
- Verification: 78 tests pass (46 core + 12 contracts + 6 web + 14 desktop); all five workspaces pass strict TypeScript; production build succeeds at 87.66 kB gzip JavaScript and 4.20 kB gzip CSS; changed-scope Prettier passes; production and full dependency audits report 0 vulnerabilities.
- Formatting limitation: root Prettier still flags the pre-existing user-local `.claude/settings.local.json`; it was intentionally left unchanged because it is outside this cycle's scope.
- External blockers unchanged: participant research, LiveKit credentials, interactive Windows media/PTT measurements, Tauri toolchain approval, code signing, browser-policy QA, and external legal/security review. Docker remains unavailable for live PostgreSQL migration execution.
- Exact next task: add community member presence contracts and gateway fanout for authenticated connect/disconnect, with multi-session-safe offline transitions; then reconcile presence in web participant surfaces.

### Cycle 1 — 2026-06-29 — completed

- Objective: create the living plan and runnable web/API foundation.
- Environment: empty workspace; Node.js 24.15.0 and npm 11.12.1 available; no Git repository yet.
- Delivered: living plan, Git repository, npm workspaces, contracts and permission engine, Fastify API/WebSocket gateway, React UI shell, CI, research kit, and threat model.
- Runtime: moved the core/default preview to port 8790 because Headroom owns 8787; integrated HTML, assets, health, and message creation responded successfully.
- Verification: `npm test` (11 passing), `npm run typecheck`, `npm run build`, `npm run format:check`, production dependency audit, and full dependency audit all pass. The integrated preview returned HTTP 200 for both the application mount and `/v1/health`.
- QA corrections: removed the external font request, made message actions keyboard reachable, prevented optimistic/gateway message duplication, reduced mid-width header pressure, and corrected integrated-preview path resolution.
- Limitation: the initial sandbox-bound server attempt left the in-app browser's only tab on an internal `data:` network-error page. Browser URL policy then blocked inspection and explicitly prohibited another automation surface; P0-005 remains implemented rather than verified.
- Repository: baseline committed as `1de8df9` after required index/ref approval became available.
- Next: reset the in-app browser tab, complete responsive visual QA, then begin the P0-007 desktop/media shell harness.

### Cycle 2 — 2026-06-29 — completed

- Objective: turn P0-007 into an executable, evidence-producing Windows desktop/media gate without prematurely choosing a shell.
- Delivered: `apps/desktop` Electron 42.5.1 control candidate, sandboxed/context-isolated preload, explicit display-source selection, Windows loopback request path, device hot-plug probe, shortcut probe, process sampler, JSON evidence view, deterministic gate evaluator, and desktop gate specification.
- Verification: 3 desktop gate tests, strict desktop typecheck, production harness build, zero-vulnerability install audit, renderer smoke contract, and native preflight pass.
- Measured: Windows 11 exposed 20 screen/window sources; F8 registration succeeded; renderer ready was 2.392 s in one run; immediate summed process working sets were 464 MB. These are partial signals, not p95 or soak passes.
- Constraint discovered: Electron's built-in global shortcut API cannot deliver distinct release state, so it fails hold-to-talk without a maintained native adapter. Tauri exposes shortcut state but cannot yet be built here and has no confirmed capture/system-audio path.
- Browser limitation: the in-app browser URL policy still blocks leaving its internal network-error data page; P0-005 remains implemented.
- Next: run user-consented capture/audio/hot-plug and timed idle/soak measurements, spike the narrowest viable Electron PTT adapter, and advance the cost model while Tauri/LiveKit prerequisites are blocked.

### Cycle 3 — 2026-06-29 — completed

- Objective: spike the narrowest viable Electron PTT adapter (press/release semantics) and produce the initial cost model.
- Delivered: `apps/desktop/src/ptt-adapter.ts` — a `PttAdapter` class accepting an injectable `PttHookBackend`, a `probePttBackend()` async probe that tries to dynamic-import `uiohook-napi` and reports availability, and three IPC handlers (`gate:probe-ptt`, `gate:register-ptt-key`, `gate:unregister-ptt-key`) wired into `main.ts`.
- Delivered: `apps/desktop/src/ptt-adapter.test.ts` — 11 hermetic unit tests covering press/release semantics, key filtering, duplicate-press guard, unregister, timestamp shape, and the unavailable-backend path. All use an injected mock backend; no real keyboard or native module required.
- Delivered: `docs/architecture/COST_MODEL.md` — sensitivity ranges across 10/50/200 DAU; media (LiveKit) dominates at 96 % of total cost; 6 beta telemetry requirements before any managed-service commitment; pricing deferral criteria aligned with D-006.
- Architecture decision: PTT adapter uses constructor-level DI rather than module-state patching. The injected backend makes tests hermetic; the production path uses a dynamic import that captures ABI mismatch errors (expected until electron-rebuild runs against Electron 42 ABI).
- Installation blocker: `npm install uiohook-napi` was denied by auto-mode (untrusted native addon). User must run: `npm install --workspace=apps/desktop uiohook-napi && npx --prefix apps/desktop electron-rebuild -f -w uiohook-napi` before the PTT IPC handlers can activate.
- Verification: 25 tests pass (11 PTT-adapter + 3 gate + 4 web + 3 core + 4 contracts); strict TypeScript across all workspaces; production build 85.54 kB gzip; format clean.
- Next: install uiohook-napi with electron-rebuild and run the PTT press/release IPC probe; run user-consented capture/audio/hot-plug and soak measurements; unblock P0-005 browser QA when URL policy permits.

### Cycle 4 — 2026-06-29 — completed

- Objective: wire the PTT adapter through the preload bridge and harness UI, install uiohook-napi with electron-rebuild, and commit the @competitor → @cove project rename.
- Delivered: `preload.cjs` now exposes `probePtt`, `registerPttKey`, `unregisterPttKey`, and `onPttEvent` to the renderer via contextBridge.
- Delivered: `harness/src.ts` DesktopGateApi interface extended with `PttProbeResult`, `PttEvent`, and PTT methods; UI logic added for probe, register (with key-code input), unregister, and live event display.
- Delivered: `harness/index.html` PTT card (05) added between process sample (04) and evidence record (06), with probe button, key-code input (default 67 = F9), register/unregister buttons, and result pre. Warning updated to reference the PTT adapter.
- Delivered: project rename from `@competitor/*` → `@cove/*` across 13 files (package.json files, imports, lockfile, docs).
- Native addon: `npm install uiohook-napi` and `electron-rebuild -f -w uiohook-napi` both succeeded; uiohook-napi is now bound to Electron 42 ABI and `require('uiohook-napi')` resolves.
- Verification: 25 tests pass (14 desktop + 4 web + 3 core + 4 contracts); strict TypeScript across all 5 workspaces; production build 85.54 kB gzip JS / 4.20 kB gzip CSS; formatting clean; 0 production vulnerabilities.
- uiohook installation note: 5 high severity advisories exist in `tar` (deep dependency of `electron-rebuild` via `node-gyp`); these affect build-time only and are a known issue with old electron-rebuild.
- Browser limitation: the in-app browser URL policy still blocks leaving its internal network-error data page; P0-005 remains implemented rather than verified.
- Next: run the interactive harness to verify PTT press/release IPC end-to-end (probe → register key → press/release events → unregister); run user-consented capture/audio/hot-plug and soak measurements; unblock P0-005 browser QA when URL policy permits.

### Cycle 6 — 2026-06-29 — completed

- Objective: implement the first foundational Phase 1 social-structure slice: communities, channels, memberships, and permission simulator.
- Delivered: `createCommunityRequestSchema`, `createChannelRequestSchema`, `permissionSimulatorRequestSchema`, and `permissionDecisionSchema` in `@cove/contracts`.
- Delivered: in-memory stores for communities, memberships, and dynamic channels in `services/core/src/app.ts`.
- Delivered: authenticated endpoints — POST /v1/communities, GET /v1/communities, GET /v1/communities/:id, POST /v1/communities/:id/join, DELETE /v1/communities/:id/members/:memberId (with `me` alias), POST /v1/communities/:id/channels, GET /v1/communities/:id/channels.
- Delivered: POST /v1/permissions/simulate endpoint that wires the existing `resolvePermission` engine with zod-validated requests.
- Behavior: community creator becomes owner; only owners/admins can create channels; owners cannot leave communities that still have other members without transferring ownership; empty communities are auto-deleted on last member leave.
- Verification: 34 tests pass (12 core + 4 web + 14 desktop + 4 contracts); strict TypeScript across all 5 workspaces; production build 85.95 kB gzip JS / 4.20 kB gzip CSS; Prettier clean; 0 production vulnerabilities.
- Limitation: communities, channels, roles, and invites remain in-memory; the web client bootstrap still returns demo data until the UI is wired to the new authenticated endpoints in a future cycle.
- Next: implement permission-dependent message routing, role assignment to members, and begin PostgreSQL persistence migration.

### Cycle 7 — 2026-06-29 — completed

- Objective: implement roles and invites as the next slice of Phase 1 social structure.
- Delivered: `roleSchema`, `createRoleRequestSchema`, `updateRoleRequestSchema`, `inviteSchema`, `createInviteRequestSchema` in `@cove/contracts`.
- Delivered: in-memory stores for roles and invites in `services/core/src/app.ts`.
- Delivered: authenticated endpoints — POST /v1/communities/:id/roles, GET /v1/communities/:id/roles, GET /v1/communities/:id/roles/:roleId, PATCH /v1/communities/:id/roles/:roleId, DELETE /v1/communities/:id/roles/:roleId, POST /v1/communities/:id/invites, GET /v1/communities/:id/invites, POST /v1/invites/:code.
- Delivered: default @everyone role created automatically for each community with basic permissions (message.send, message.read, message.react).
- Behavior: only community owners and admins can create/edit roles and create invites; only owners can delete roles; managed roles (@everyone) cannot be edited or deleted; invites support max uses and expiry; invite codes are 8-character base64url.
- Verification: 43 tests pass (21 core + 4 web + 14 desktop + 4 contracts); strict TypeScript across all 5 workspaces; production build 86.12 kB gzip JS / 4.20 kB gzip CSS; Prettier clean; 0 production vulnerabilities.
- Next: implement permission-dependent message routing, role assignment to members, and PostgreSQL persistence migration.
- Delivered: role create/list/get/update/delete plus owner/admin-controlled member assignment/removal; deleting a role removes stale membership assignments; `@everyone` supplies the documented base policy.
- Delivered: cryptographically random invite codes with bounded use/lifetime inputs, owner/admin-only listing, revocation, expiry/exhaustion enforcement, and sanitized gateway events that do not expose invite codes.
- Delivered: dynamic community message reads/writes now require authentication, membership, and `message.read`/`message.send`; idempotency is scoped by author and channel; dynamic messages no longer leak into the public demo bootstrap.
- Delivered: gateway clients are scoped to public demo communities or authenticated memberships, message events are filtered by read permission, and live access is granted/revoked when memberships change.
- Decision: D-011 maps the managed `@everyone` role to base rules and assigned roles to role rules so the existing precedence engine remains authoritative and denials stay explainable.
- Verification: 49 tests pass (26 core, 5 contracts, 4 web, 14 desktop); all five workspaces pass strict TypeScript; production build succeeds at 86.15 kB gzip JavaScript and 4.20 kB gzip CSS; Prettier passes; production audit reports 0 vulnerabilities.
- Known dependency blocker: the full audit still reports 5 high-severity build-time `tar` dependency findings through `electron-rebuild`; the available forced fix is a breaking downgrade and was not applied. Runtime production dependencies remain clean.
- External blockers unchanged: participant research, LiveKit credentials, interactive Windows media/PTT measurements, Tauri toolchain approval, code signing, browser-policy QA, and external legal/security review.
- Exact next task: add an initial PostgreSQL schema/migration and storage interfaces for accounts, sessions, communities, memberships, channels, roles, role assignments, and invites; migrate the current routes behind repository adapters while keeping an in-memory adapter for deterministic tests.

### Cycle 13 — 2026-06-29 — completed

- Objective: add ordered startup migration runner and same-channel message replies.
- Delivered: `services/core/src/migrations.ts` — `runMigrations(pool)` creates `schema_migrations` ledger, reads `schema/*.sql` files in filename order, executes each pending migration in a transaction, records it in the ledger, and rolls back with an error on failure.
- Delivered: `services/core/schema/004_replies.sql` — `ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL` plus index.
- Delivered: `replyToId: string | undefined` and `replyPreview: { id, content, authorDisplayName, availability } | undefined` added to `messageSchema` and `messageReplyPreviewSchema` in `@cove/contracts`.
- Delivered: `replyToId` optional field on `sendMessageRequestSchema`; send route validates the parent message exists and belongs to the same channel, then embeds a `replyPreview` snapshot; cross-channel and nonexistent-parent attempts return 400.
- Delivered: `runMigrations` wired into `services/core/src/index.ts` before `buildApp()` when `DATABASE_URL` is set.
- Delivered: `services/core/src/migrations.test.ts` — 5 unit tests: ledger-table creation, all-pending run in order, partial-apply skip, idempotent no-op, and rollback-on-failure.
- Verification: 75 tests pass (45 core + 11 contracts + 5 web + 14 desktop); all five workspaces pass strict TypeScript; production build 87.60 kB gzip JS / 4.20 kB gzip CSS; Prettier clean; production and full dependency audits both report 0 vulnerabilities.
- Verification limitation: Docker Desktop's Linux daemon was not running, so migration 004 was not executed against a live PostgreSQL instance. The SQL, runner logic, and FK column are wired correctly; live execution remains gated on Docker availability.
- External blockers unchanged: participant research, LiveKit credentials, interactive Windows media/PTT measurements, Tauri toolchain approval, code signing, browser-policy QA, and external legal/security review.
- Exact next task: attention-center reply notifications (add reply events to `attentionItemSchema` gateway fanout), then community member presence (online/idle/DnD broadcast on gateway connect/disconnect).

### Cycle 12 — 2026-06-29 — completed

- Objective: complete the managed-message lifecycle with edits, soft-deletes, reactions, private read state, and an accountable audit surface.
- Delivered: runtime contracts for edits, reaction mutations/events, channel read state, and audit events; repository methods in both memory and PostgreSQL adapters; and migration `003_message_lifecycle.sql` for reactions, read states, and audit events.
- Delivered: authenticated author-only `PATCH` edits; author or `message.manage` `DELETE` tombstones; idempotent `PUT`/`DELETE` reactions with `message.react` enforcement for adds; private `GET`/`PUT` channel read state; and permission-gated community audit reads capped at 100 events.
- Delivered: `message.updated`, `message.deleted`, `message.reaction.updated`, and account-scoped `channel.read-state.updated` gateway events plus web reconciliation and deleted-message rendering.
- Decision: D-012 makes read state account-private, keeps deleted content out of normal message responses, and records only channel/message/actor mutation metadata in the audit log. Removing one's own reaction remains allowed after reaction permission is revoked.
- Verification: 69 tests pass (39 core + 11 contracts + 5 web + 14 desktop); all five workspaces pass strict TypeScript; production build succeeds at 87.55 kB gzip JavaScript and 4.20 kB gzip CSS; Prettier passes; production and full dependency audits both report 0 vulnerabilities.
- Verification limitation: Docker Desktop's Linux daemon is not running (`npipe:////./pipe/dockerDesktopLinuxEngine` is absent), so migration 003 was not executed against a live PostgreSQL instance this cycle. The SQL is wired through the fresh-database schema mount, but existing volumes still need an ordered migration runner; both repository adapters typecheck, and memory-backed integration tests cover the route behavior.
- External blockers unchanged: participant research, LiveKit credentials, interactive Windows media/PTT measurements, Tauri toolchain approval, code signing, browser-policy QA, and external legal/security review.
- Exact next task: add an ordered, idempotent startup migration runner with a migration ledger for schemas 001–003 and deterministic pool-level tests; execute the live PostgreSQL integration check when Docker is available, then proceed to same-channel replies.

### Cycle 11 — 2026-06-29 — completed

- Objective: implement the attachment pipeline — file upload initiation, raw-body upload, quarantine tracking, serve endpoint, and message attachment resolution.
- Delivered: `attachmentSchema` and `initiateUploadRequestSchema` in `@cove/contracts`; `attachments: []` field on `messageSchema` and optional `attachmentIds` on `sendMessageRequestSchema`; `attachments` field added to demo messages and web client optimistic message.
- Delivered: `services/core/src/object-storage.ts` — `ObjectStorage` interface, `createMemoryObjectStorage()` (Map-backed, for tests), and `createLocalObjectStorage(dir)` (fs-backed, for single-node dev).
- Delivered: `AttachmentRecord` type and five attachment methods added to `Repository` interface, `MemoryRepository`, and `PostgresRepository`; `services/core/schema/002_attachments.sql` migration.
- Delivered: three new authenticated endpoints — `POST /v1/channels/:channelId/attachments/initiate` (validates MIME type and 25 MB cap, creates pending record), `PUT /v1/channels/:channelId/attachments/:attachmentId/upload` (raw binary body, auto-approves in dev), `GET /v1/attachments/:attachmentId/content` (serves approved file with correct Content-Type).
- Delivered: message send updated to resolve `attachmentIds` into approved attachment objects and embed them in the created message.
- Architecture: auto-approve quarantine path (`'pending' → 'approved'`) is the default. Quarantine can be enforced by a future moderation hook without changing the route contract.
- Verification: 64 tests pass (36 core + 10 contracts + 4 web + 14 desktop); strict typecheck across all 5 workspaces; production build 86.49 kB gzip JS / 4.20 kB gzip CSS; Prettier clean; 0 production vulnerabilities. 5 new attachment tests: initiate/upload/serve roundtrip, bad MIME rejection, oversized rejection, duplicate-upload 409, and message-with-attachment resolution.
- Next: message edits, deletes, reactions, read-state tracking, and audit event log (Phase 1 roadmap).

### Cycle 10 — 2026-06-29 — completed

- Objective: wire the Redis gateway coordinator for cluster-wide event sequencing and session state persistence, with graceful fallback to memory when Redis is unavailable.
- Delivered:
  - Updated `services/core/src/index.ts` to import and use `createRedisGatewayCoordinator()` when `REDIS_URL` is set.
  - Added try/catch around coordinator initialization to fall back to `createMemoryGatewayCoordinator()` on Redis errors.
  - Moved `coordinator` declaration outside the try block to allow proper access in the signal handler.
  - Updated graceful shutdown handler to await `coordinator.disconnect()` before exit.
  - Removed `preview.ts` coordinator wiring (kept it inline in index.ts for consistency).
- Configuration: `docker-compose.yml` defines `redis:7-alpine` available via `REDIS_URL=redis://localhost:6379`.
- Behavior: When `REDIS_URL` is not set or Redis fails to start, the app logs a warning and continues with an in-memory coordinator. When Redis is available, sequence numbers and resume state are stored in Redis, enabling hot standby and reconnection recovery.
- Verification: 54 tests pass (26 core, 10 contracts, 4 web, 14 desktop); all five workspaces pass strict TypeScript; production build 86.41 kB gzip JS / 4.20 kB gzip CSS; Prettier clean; 0 production vulnerabilities.
- Git commit: `4d44acb` — "Cycle 10: Wire Redis gateway coordinator with fallback".
- Next: begin the attachment pipeline (file uploads, quarantine, S3-compatible storage) or add Redis unit tests with an external Redis instance.

### Cycle 8 — 2026-06-30 — completed

- Objective: implement repository storage abstraction layer and InMemoryRepository adapter to decouple routing from persistence.
- Delivered: `services/core/src/repository.ts` (Repository interface and internal domain types) and `services/core/src/memory-repository.ts` (InMemoryRepository adapter).
- Delivered: refactored routes, auth helpers, helper functions, and WebSocket gateways in `services/core/src/app.ts` to resolve data entirely via Repository.
- Delivered: refactored `services/core/src/index.ts` and `services/core/src/preview.ts` to instantiate and inject the memory repository into `buildApp()`.
- Verification: 49 tests pass (26 core, 5 contracts, 4 web, 14 desktop); all five workspaces pass strict TypeScript; production build succeeds at 86.15 kB gzip JS; formatting clean; 0 production vulnerabilities.
- Next: add an initial PostgreSQL schema/migration, implement PostgreSQL repository adapter, and integrate PostgreSQL persistence.

### Cycle 9 — 2026-06-29 — completed

- Objective: add PostgreSQL persistence — schema, adapter, and DATABASE_URL-driven wiring — making the Repository interface fully async.
- Delivered: `services/core/schema/001_initial.sql` — initial PostgreSQL schema with 10 tables (accounts, email_challenges, passkeys, sessions, communities, memberships, channels, roles, invites, messages, idempotency) with appropriate indexes, foreign keys, and cascade deletes.
- Delivered: `services/core/src/postgres-repository.ts` — `createPostgresRepository(pool)` implementing the full Repository interface against PostgreSQL via `node-postgres` (pg).
- Delivered: `docker-compose.yml` at repo root — PostgreSQL 17 Alpine with schema auto-load, health check, and persistent volume for local development.
- Delivered: `services/core/src/index.ts` and `preview.ts` updated — when `DATABASE_URL` env is set, the app creates a pg Pool and uses the PostgreSQL adapter; otherwise falls back to the in-memory adapter.
- Refactored: Repository interface made fully async (all methods return Promises). Memory adapter updated with async wrappers. All 30+ route handlers and helper functions in app.ts updated to await repository calls.
- Added: `pg` and `@types/pg` dependencies to `@cove/core`.
- Verification: 54 tests pass (26 core, 10 contracts, 4 web, 14 desktop); all five workspaces pass strict TypeScript; production build 86.41 kB gzip JS / 4.20 kB gzip CSS; Prettier clean; 0 production vulnerabilities.
- Next: add Redis coordination for gateway session state, or begin the attachment pipeline (file uploads, quarantine, S3-compatible storage).
