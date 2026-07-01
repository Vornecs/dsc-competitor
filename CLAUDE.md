# Cove — Development Guidelines

## Orchestration model

**Claude** is the lead/orchestrator on this project. All architectural decisions, integration of parallel work, prioritization, and cross-cutting changes run through Claude. Codex and Antigravity are implementers for well-scoped, parallel tasks that Claude assigns.

**Before starting any task:**

1. Check `WORKLOG.md` — if the file you need to touch is listed under "Hot files", coordinate first
2. Find your assignment under your agent name in WORKLOG.md; if none exists, check the P4 queue for safe opportunistic tasks
3. Do not touch files outside the scope you were assigned
4. When done, write your completion report to `status/<your-name>.md` — never edit WORKLOG.md directly
5. The `status/` directory is always safe to write to; read `status/README.md` for the format

**Lead responsibilities (Claude):**

- Owns `App.tsx`, `index.ts`, `protocol.ts`, and `PRODUCT_PLAN.md`
- Makes all schema changes
- Decides what gets merged and when
- Assigns parallel tasks to Codex/Antigravity

---

## Orchestration routine — run every Claude session

1. **Read status files** — `status/codex.md`, `status/antigravity.md`, and any others present
2. **Check health** — `npm run typecheck && npm test`; note failure count
3. **Reconcile** — mark completed tasks done in WORKLOG; resolve flags; add cycle history row
4. **Backlog check** — before writing any new assignments, verify all minimums are met:
   - Each active agent (Codex, Antigravity) has **3+ tasks queued** in their next-task list
   - P4 queue has **6+ tasks** for opportunistic agents
   - P0–P3 combined has **10+ items** remaining
   - If any minimum is not met, add tasks before moving on
5. **Write assignments** — update WORKLOG.md with Cycle N+1 assignments; each agent entry must show current task + full queue
6. **Update PRODUCT_PLAN.md** — mark completed features; update cycle counter, test count, and quality dashboard
7. **Clear hot-file locks** — remove entries from the hot-file table if work has settled and no agent is active on that file
8. **Increment cycle** — update `Current cycle:` at the top of WORKLOG.md

**Never close a cycle with fewer than 3 queued tasks per active agent or fewer than 6 P4 tasks.**

When drafting new tasks for agent queues, prefer:

- Backend tasks for Codex: new endpoints, middleware, persistence, rate limiting, pagination, tests
- Frontend component tasks for Antigravity: new `.tsx` files only (no App.tsx edits), CSS additions, unit tests for pure functions
- Analysis/audit tasks for P4: read-only scans, reports written to `status/<name>.md`

---

## Stack at a glance

- **Frontend**: React 19, Vite, TypeScript — single entry `apps/web/src/App.tsx`
- **Backend**: Fastify, Node 24+ — `services/core/src/app.ts` (routes) + `index.ts` (bootstrap)
- **Shared types**: `packages/contracts/src/protocol.ts` (Zod schemas)
- **Voice**: LiveKit (fake provider when env vars absent)
- **Storage**: in-memory default; PostgreSQL via `DATABASE_URL`; Redis via `REDIS_URL`

## Run locally

```bash
npm install
npm run dev   # core on :8790, web on :5173
```

Set env vars in `services/core/.env` (copy `.env.example`).

## The #1 trap: in-memory storage wipes on restart

Without `DATABASE_URL`, ALL state (users, messages, communities) lives in RAM and is gone on restart.
Set `SNAPSHOT_FILE=.cove-data.json` in `.env` for local dev persistence, or set a real `DATABASE_URL`.

---

## Definition of done — every feature, every time

A feature is NOT done until all of the following are true:

1. **UI element has a handler** — `onClick`, `onSubmit`, etc. wired, not just rendered
2. **Handler calls the correct API endpoint** — verify in Network tab
3. **Server responds 2xx** — check for error conditions too
4. **UI updates** — optimistically or via WebSocket event
5. **Errors are surfaced** — toast or banner on failure; never silent
6. **Persists across refresh** — state lives on the server, not just in React
7. **Backend test added** — in `services/core/src/app.test.ts`
8. **TypeScript clean** — `npm run typecheck` passes
9. **Tests pass** — `npm test` green

If any of these is missing, the feature is still in progress.

---

## Error handling rules (non-negotiable)

- **Never** swallow errors silently in user-triggered actions
- **Never** set global connection state to `'preview'` because one API call failed
- Always show a toast (`showToast()` in App.tsx) for recoverable errors
- WebSocket close → reconnect with exponential backoff (already wired — don't change this)

## History of silent failures (do not repeat)

Identified 2026-06-30 — all now fixed, listed here to prevent regression:

- Community rail buttons: rendered but no `onClick`
- Reaction buttons: rendered but no `onClick`
- Reply button: no state, no handler, no API call
- WebSocket close/error: set `connection = 'preview'`, no reconnect
- Message send failure: set global `connection = 'preview'`
- Bootstrap failure: silent fallback to demo data

---

## Persistence quick reference

| Scenario                   | Setup                                     |
| -------------------------- | ----------------------------------------- |
| Tests / zero-config        | In-memory (automatic)                     |
| Local dev with persistence | `SNAPSHOT_FILE=.cove-data.json` in `.env` |
| Staging / Production       | `DATABASE_URL=postgres://...`             |
| Multi-node                 | `DATABASE_URL` + `REDIS_URL`              |

## Adding new features

1. Schema change in `packages/contracts/src/protocol.ts` if needed (Claude owns this)
2. Backend route in `services/core/src/app.ts`
3. Test in `services/core/src/app.test.ts`
4. Wire UI: state + handler + render in `App.tsx` (or a component file)
5. Verify all 9 definition-of-done checks above
