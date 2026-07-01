## Status — Codex — 2026-07-01

**Task completed:** Codex-6 — rate limiting on message send

**Files changed:**

- `services/core/src/app.ts` — registered route-scoped rate limiting and limited message sends to 10 per second
- `services/core/src/app.test.ts` — covered the 11-message burst and `Retry-After` response
- `services/core/package.json` and `package-lock.json` — added `@fastify/rate-limit`

**Health checks:**

- `npm run typecheck`: PASSED (5 workspaces)
- `npm test`: PASSED (186 tests: 14 desktop, 61 web, 87 core, 24 contracts)

**Notes / flags for orchestrator:**

- The limiter uses `request.accountId` when supplied by request decoration and otherwise falls back to the client IP.
- No contract schema or WORKLOG changes were made; unrelated Antigravity/frontend worktree changes were preserved.
