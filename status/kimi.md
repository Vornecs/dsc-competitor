## Status — Kimi — 2026-06-30

**Task completed:** P4 — Test coverage gap report for `services/core/src/app.ts` vs `app.test.ts`

**Files changed:**
- None (read-only analysis task)

**Health checks:**
- `npm run typecheck`: N/A — no code changes
- `npm test`: N/A — no code changes

**Notes / flags for orchestrator:**
- Scanned `services/core/src/app.ts` and identified **60 registered HTTP routes**.
- Scanned `services/core/src/app.test.ts` for all `app.inject` calls and WebSocket gateway tests.
- **59 of 60 routes have corresponding test coverage** in `app.test.ts`.
- **1 untested route:**
  - `GET /v1/communities/:communityId/emoji/:emojiId/content` — serves the binary content of a custom server emoji. The upload test (line 1240) asserts the returned `url` *contains* this path, but no test actually fetches the endpoint. The list and delete emoji tests also do not exercise it.
- `GET /v1/gateway` was flagged as uncovered by the automated scan because it is tested via `new WebSocket(...)` rather than `app.inject(...)`; it **is** covered by the realtime-gateway tests (lines 98, 140, 1738).
- No other routes are missing tests. Backend tasks on the Codex queue (`/accounts/me/muted-channels`, message pagination, etc.) are not yet implemented in `app.ts` and therefore not counted.
