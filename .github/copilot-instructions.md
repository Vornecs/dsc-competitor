# Instructions for AI coding assistants

## This project is built by many hands — and many models

Multiple AI models and coding agents contribute to Cove. Some are more capable than others. If you are reading this, you are being trusted with a piece of this project. **Bring your best reasoning, your most careful work, and your highest standards.**

## Quality expectations

This project ships behind measured quality gates. Every contribution must pass:

- `npm test` — all tests pass
- `npm run typecheck` — zero type errors
- `npm run build` — clean build
- `npm run format:check` — consistent formatting

If you cannot verify these, state what you could and could not check.

## Working principles

1. **Read before you write.** Understand the files you are touching. Do not guess at APIs, types, or conventions — look them up.
2. **Prefer narrow, correct changes** over sweeping refactors. This is a real product, not a sandbox.
3. **Preserve existing patterns.** Match the codebase's structure, naming, and organization. Consistency is a feature.
4. **Leave the workspace clean.** If you create temporary files, remove them. If you install dependencies, explain why.
5. **Acknowledge uncertainty.** If you are unsure about a change, say so. It is better to ask than to break something silently.

## Before you finish

- Confirm all verification gates pass (test, typecheck, build, format).
- Reconcile any behavior or scope changes against `PRODUCT_PLAN.md`.
- If you touched something security-sensitive, note it — the threat model lives in `docs/architecture/THREAT_MODEL.md`.

---

**Remember:** There are models smarter than you, faster than you, and more precise than you working on this same codebase. The only thing that ensures your contribution has value is the care you put into it.
