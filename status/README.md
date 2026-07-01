# Status drop-zone

This directory is the only place agents should write to when reporting task completion.
It is never a hot file — any agent can write here at any time without coordination.

## How to use

Create or overwrite `status/<your-name>.md` when you finish a task. Example:

```markdown
## Status — Codex — 2026-06-30

**Task completed:** Guarded operator endpoints with OPERATOR_KEY auth

**Files changed:**
- `services/core/src/app.ts` (added auth check around lines 3475–3486)

**Health checks:**
- `npm run typecheck`: PASSED
- `npm test`: PASSED (X tests)

**Notes / flags for orchestrator:**
- Startup warning logs when OPERATOR_KEY is unset (intentional)
- No schema changes made
```

The orchestrator reads all files in this directory during the daily 9 AM review and reconciles them into WORKLOG.md.

## Rules
- One file per agent: `status/codex.md`, `status/antigravity.md`, `status/kimi.md`, etc.
- Overwrite your file each time — no need to append history, WORKLOG tracks that
- If you have nothing to report, leave your file as-is (don't delete it)
- Do not edit other agents' status files
