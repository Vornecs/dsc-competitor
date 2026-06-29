# Competitor Product Plan

> Last updated: 2026-06-29 | Cycle: 1 | Phase: 0 — Foundation | Build health: verified; browser visual QA blocked
>
> Current objective: Cycle 1 foundation completed; preserve the verified baseline and reset browser QA.
>
> Next gate: complete browser-rendered desktop/narrow-viewport QA, then execute P0-007's Windows desktop/media capability harness.

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
5. Keep data portable and deletion self-service.
6. Use audited protocols and maintained media infrastructure; never invent cryptography.
7. Ship narrow vertical slices behind measured quality gates.

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

| ID    | Finding                                                                                                             | Evidence                                                                                                                                                                                                                              | Confidence  | Product consequence                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| E-001 | Persistent themed spaces, autonomy, shared activities, and casual interaction support digital third-place behavior. | [Third-place research](https://arxiv.org/abs/2501.09951)                                                                                                                                                                              | Medium-high | Voice rooms and recognizable community structure are core, not optional.                            |
| E-002 | Discord reports more than 200M monthly active users and 1.9B monthly PC gaming hours.                               | [Discord usage statement](https://discord.com/press-releases/discord-launches-orbs-globally)                                                                                                                                          | High        | Migration friction and network effects must be treated as product risks.                            |
| E-003 | Users report UI churn, contrast/accessibility issues, wasted space, and resource regressions.                       | [Discord UI feedback](https://support.discord.com/hc/en-us/community/posts/30942204080279-It-would-appear-that-an-overwhelming-majority-of-users-dislike-2025-Desktop-UI-changes-for-variety-of-reasons-request-way-to-revert-update) | Medium      | Establish density modes, performance budgets, visual regression, and reversible navigation changes. |
| E-004 | Notification overload causes communities to be muted and forgotten.                                                 | [Notification feedback](https://support.discord.com/hc/en-us/community/posts/4421087955735-New-Notification-Alert-Setting-Alert-only-recently-visited-channels)                                                                       | Medium      | Build an explainable attention center instead of relying on badges.                                 |
| E-005 | Community operators depend on bots to compensate for incomplete logs and moderation workflows.                      | [Moderation feedback](https://support.discord.com/hc/en-us/community/posts/360048297852-Changes-to-Permissions-and-Audit-Logs)                                                                                                        | Medium      | Cases, evidence, actions, appeals, and audit history are first-party systems.                       |
| E-006 | Users request portable chat and server history.                                                                     | [Export feedback](https://support.discord.com/hc/en-us/community/posts/360035147072-Export-Entire-Chats/comments/4420180099863)                                                                                                       | Medium      | Account and community exports are release requirements.                                             |
| E-007 | LiveKit offers managed and self-hosted WebRTC, E2EE, reconnection, and cross-platform SDKs.                         | [LiveKit documentation](https://docs.livekit.io/intro/about/)                                                                                                                                                                         | High        | Use a media-provider adapter around LiveKit instead of building an SFU.                             |
| E-008 | MLS is standardized for asynchronous group key establishment with forward secrecy and post-compromise security.     | [RFC 9420](https://www.rfc-editor.org/info/rfc9420/)                                                                                                                                                                                  | High        | Use a maintained MLS implementation for sealed messaging after external review.                     |

Original research remains required: at least 12 members, 8 hosts/moderators, and 5 usability participants before the Phase 0 exit gate.

## Decision log

| ID    | Decision                                                                                                                | Rationale                                                                                   | Reversal condition                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Start with gaming friend groups.                                                                                        | Tightest path to Discord's durable voice-driven value and a manageable solo-operator scope. | Repeated research shows another segment has materially higher activation without greater safety burden.                      |
| D-002 | Hosted open core; no federation in year one.                                                                            | Enables consistent UX and abuse response while preserving portability and a self-host path. | Central operation becomes economically or politically incompatible with the product promise and federation safety is proven. |
| D-003 | Community-paid only.                                                                                                    | Aligns revenue with hosting cost without degrading individual communication.                | Measured economics cannot sustain a useful free friend-group tier.                                                           |
| D-004 | Layered privacy: managed channels plus sealed channels/E2EE DMs.                                                        | Preserves search and moderation where expected while offering explicit private spaces.      | User research rejects the mode distinction or external review finds it unsafe/confusing.                                     |
| D-005 | React/TypeScript client and modular TypeScript core.                                                                    | Maximizes shared contracts and delivery speed for a solo-plus-agent team.                   | Performance profiling proves a critical workload cannot meet its budget.                                                     |
| D-006 | PostgreSQL, Redis, S3-compatible storage, and LiveKit; no Kafka, Elasticsearch, microservices, or Kubernetes initially. | Keeps operations comprehensible and reversible.                                             | A measured bottleneck exceeds the documented decomposition trigger.                                                          |
| D-007 | Select Tauri only through a media/native capability gate; otherwise use Electron.                                       | Resource usage matters, but reliable Windows capture and push-to-talk are non-negotiable.   | The chosen shell later fails a release budget and the alternative has demonstrably improved.                                 |
| D-008 | API is versioned REST plus an ordered resumable WebSocket gateway.                                                      | Separates durable commands/state from realtime fanout and permits deterministic recovery.   | Contract tests show the split creates correctness or operability problems.                                                   |

| D-009 | Use port 8790 for the local core and integrated preview. | Headroom already owns port 8787 in the shared workspace environment. | The environment-level port allocation changes. |

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

### Next — Phase 1, cycles 7–25

- Passkey/email authentication and device sessions.
- Accounts, communities, memberships, roles, channels, invites, and permission simulator.
- PostgreSQL persistence, migrations, Redis coordination, and object-storage quarantine.
- Managed messages, replies, reactions, edits, deletes, read state, and attachment pipeline.
- Audit events, backups, restore drill, deployable web client, and operator diagnostics.

### Later

- Phase 2: voice, screen share, Windows packaging, attention center, presence, and E2EE DMs.
- Phase 3: private alpha moderation, exports, deletion, migration bridge, sealed channels, and billing sandbox.
- Phase 4: external beta hardening, load, legal review, independent security/E2EE review, and gradual cohorts.
- Phase 5: native mobile, other desktop platforms, supported self-hosting, apps, curated discovery, and knowledge channels.

### Blocked

- Original participant research requires recruited target users.
- Managed LiveKit validation requires service credentials.
- Public beta requires external legal, penetration, and E2EE review.
- Signed Windows distribution requires code-signing credentials.

## Work-item registry

| ID     | Status      | Outcome                    | Acceptance criteria                                                                                                         | Verification                                                            |
| ------ | ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0-001 | verified    | Authoritative living plan  | All required sections exist and current cycle is explicit.                                                                  | Manual structure review completed 2026-06-29.                           |
| P0-002 | verified    | Monorepo foundation        | Workspaces install; shared typecheck, test, and build commands pass.                                                        | Root test/typecheck/build/format commands pass.                         |
| P0-003 | verified    | Public-contract package    | Runtime validation covers privacy policies, gateway frames, and bootstrap state.                                            | 4 contract/permission tests and strict types pass.                      |
| P0-004 | verified    | Core transport spike       | Health/bootstrap routes and gateway READY/heartbeat/event behavior run locally.                                             | 3 API/WebSocket tests and integrated runtime probes pass.               |
| P0-005 | implemented | Polished application shell | Four-region layout, density/theme controls, privacy card, messaging composition, and responsive behavior render accessibly. | 4 semantic/state UI tests and build pass; browser QA is policy-blocked. |
| P0-006 | verified    | Research kit               | Interview guide, survey, consent script, and synthesis rubric exist.                                                        | Structure reviewed; participant sessions remain external.               |
| P0-007 | planned     | Desktop/media gate         | Both shell candidates evaluated against capture/PTT/device/performance criteria.                                            | Recorded Windows measurements.                                          |

## Quality dashboard

| Area             | Current          | Gate                                                                                                    |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| Install          | verified         | `npm install` completed and generated a locked workspace graph.                                         |
| Unit tests       | verified         | 11 tests pass: 4 web, 3 core transport, and 4 contract/permission.                                      |
| Type safety      | verified         | All four workspaces pass strict TypeScript.                                                             |
| Production build | verified         | Client output is 85.54 kB gzip JavaScript and 4.20 kB gzip CSS.                                         |
| API integration  | verified         | Health, bootstrap, mutation, gateway, integrated HTML, and assets pass.                                 |
| Accessibility    | partial          | Semantic UI tests and accessible modes exist; real-browser review remains blocked.                      |
| Performance      | unmeasured       | Budgets measured after desktop/media spike.                                                             |
| Security         | baseline partial | CSP, headers, runtime schemas, redacted logs, threat model, and zero-vulnerability npm audits verified. |
| Reliability      | local only       | Backup/restore and deployment SLOs begin in Phase 1.                                                    |
| Cost             | unmeasured       | Alpha cost model before managed-service commitment.                                                     |

## Risk register

| Risk                                            | Likelihood  | Impact   | Mitigation / trigger                                                                                   |
| ----------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Network effects prevent migration               | High        | Critical | Consent-based structure import, expiring bridge, fast invite activation, community templates.          |
| Scope exceeds solo capacity                     | High        | Critical | One active outcome per cycle, hard phase gates, defer discovery/mobile/federation.                     |
| Safety operations exceed capacity               | Medium-high | Critical | Invite-only cohorts, 16+, no explicit content, community caps, first-party case tooling.               |
| Media cost or quality misses target             | Medium      | Critical | LiveKit spike, provider abstraction, participant-minute telemetry, capacity rather than quality tiers. |
| E2EE creates misleading guarantees              | Medium      | Critical | Explicit modes, metadata disclosure, maintained MLS, independent review before marketing.              |
| Desktop shell fails capture or resource targets | Medium      | High     | Mechanical Tauri/Electron gate with real Windows testing.                                              |
| Permission bugs cross community boundaries      | Medium      | Critical | Central policy engine, precedence property tests, tenant IDs in every authorization query.             |
| UI becomes unstable or decorative               | Medium      | High     | Semantic design system, visual regression, density modes, measured navigation-change policy.           |

## Recent session checkpoints

### Cycle 1 — 2026-06-29 — completed

- Objective: create the living plan and runnable web/API foundation.
- Environment: empty workspace; Node.js 24.15.0 and npm 11.12.1 available; no Git repository yet.
- Delivered: living plan, Git repository, npm workspaces, contracts and permission engine, Fastify API/WebSocket gateway, React UI shell, CI, research kit, and threat model.
- Runtime: moved the core/default preview to port 8790 because Headroom owns 8787; integrated HTML, assets, health, and message creation responded successfully.
- Verification: `npm test` (11 passing), `npm run typecheck`, `npm run build`, `npm run format:check`, production dependency audit, and full dependency audit all pass. The integrated preview returned HTTP 200 for both the application mount and `/v1/health`.
- QA corrections: removed the external font request, made message actions keyboard reachable, prevented optimistic/gateway message duplication, reduced mid-width header pressure, and corrected integrated-preview path resolution.
- Limitation: the initial sandbox-bound server attempt left the in-app browser's only tab on an internal `data:` network-error page. Browser URL policy then blocked inspection and explicitly prohibited another automation surface; P0-005 remains implemented rather than verified.
- Repository: Git is initialized, but the first commit remains pending because the required `rtk` executable became unavailable in both sandboxed and approved shells before index/ref writes could be performed.
- Next: reset the in-app browser tab, complete responsive visual QA, then begin the P0-007 desktop/media shell harness.
