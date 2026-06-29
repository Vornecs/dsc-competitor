# Cove

A gaming-first community communication platform focused on dependable voice, stable and accessible UI, explainable moderation, layered privacy, and portable community data.

The product and delivery source of truth is [PRODUCT_PLAN.md](./PRODUCT_PLAN.md).

## Workspace

- `apps/web` — React/Vite web client.
- `apps/desktop` — Electron/Tauri decision gate and Windows media evidence harness.
- `services/core` — Fastify HTTP API and realtime gateway.
- `packages/contracts` — shared runtime schemas, protocol types, and permission engine.
- `packages/ui` — shared accessible UI primitives.

## Local development

Requires Node.js 24 or later.

```powershell
npm install
npm run dev
```

The web client runs at `http://localhost:5173` and the core service at `http://localhost:8790`. Port 8790 is the project default to avoid the existing Headroom service on 8787.

To inspect the production build through the same origin as the API and realtime gateway:

```powershell
npm run build
npm run preview -w @cove/core
```

Then open `http://127.0.0.1:8790`.

## Windows desktop capability gate

The shell choice remains open. Run the Electron control candidate to measure display capture, system audio, device hot-plug, shortcuts, startup, and resource use:

```powershell
npm run preflight -w @cove/desktop
npm run smoke -w @cove/desktop
npm run harness -w @cove/desktop
```

The automated commands do not grant media permissions. The interactive harness requires explicit source/device choices and explains which observations are partial. See [the gate specification](./docs/architecture/DESKTOP_MEDIA_GATE.md).

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm run format:check
```

The initial runtime uses an in-memory transport spike. PostgreSQL, Redis, object storage, authentication, and durable event cursors enter during Phase 1; the current limitations are tracked in `PRODUCT_PLAN.md`.
