## Status — Codex — 2026-07-01

**Task completed:** Codex-9 — server-side attention persistence

**Files changed:**

- `services/core/src/app.ts` — persisted reply attention per account, added list/read/dismiss/read-all endpoints, capped items at 100, and returned them from authenticated bootstrap
- `services/core/src/app.test.ts` — added read, dismiss, read-all, bootstrap, ordering, and 100-item cap coverage

**Health checks:**

- `npm run typecheck`: PASSED (5 workspaces)
- `npm test`: PASSED (207 tests: 14 desktop, 75 web, 94 core, 24 contracts)
- `prettier --check` (changed source files): PASSED
- `git diff --check`: PASSED

**Notes / flags for orchestrator:**

- No contract schema changes were needed.
- Attention state is account-scoped in memory and capped at 100 items as assigned.
- Claude must wire `App.tsx` mark-read, dismiss, read-all, and bootstrap refresh behavior to the new endpoints.
- Unrelated Antigravity/frontend worktree changes were preserved.
